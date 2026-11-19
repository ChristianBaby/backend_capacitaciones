import { BadRequestException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { EmailService } from '../email/email.service';
import {
  instructorInviteTemplate,
  passwordResetTemplate,
  RenderedEmail,
  verifyEmailTemplate,
} from '../email/email.templates';
import { PrismaService } from '../prisma/prisma.service';
import { AuthResult, PublicUser } from './auth.types';
import { ACCESS_TTL_MS, REFRESH_TTL_MS } from './cookies';
import { toPublicUser } from './user.mapper';
import {
  CODE_TTL_MS,
  CodePurposeName,
  INVALID_CODE_MESSAGE,
  VerificationCodeService,
} from './verification-code.service';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
}

const BCRYPT_ROUNDS = 10;
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const SESSION_INVALID = 'Sesión inválida o expirada';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly codes: VerificationCodeService,
    private readonly email: EmailService,
  ) {}

  // ---------- registro y verificacion ----------

  async register(dto: { name: string; email: string; password: string }): Promise<{ message: string }> {
    const generic = { message: 'Te enviamos un código de verificación a tu correo' };
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!existing) {
      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      const user = await this.prisma.user.create({
        data: { email: dto.email, name: dto.name, passwordHash, role: 'STUDENT', status: 'PENDING' },
      });
      await this.sendCode(user, 'EMAIL_VERIFY');
    } else if (existing.status === 'PENDING' && existing.role === 'STUDENT') {
      // Registro sin completar: reenviar codigo (sin tocar la contrasena guardada).
      if (!(await this.codes.isOnCooldown(existing.id, 'EMAIL_VERIFY'))) await this.sendCode(existing, 'EMAIL_VERIFY');
    }
    // Si ya existe y esta activo, respondemos igual para no revelar la existencia de la cuenta.
    return generic;
  }

  async verifyEmail(email: string, code: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'STUDENT' || user.status !== 'PENDING') return this.failCode();
    await this.codes.consume(user.id, 'EMAIL_VERIFY', code);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE', emailVerified: true },
    });
    return this.startSession(updated);
  }

  async resendCode(email: string, purpose?: CodePurposeName): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    let effective: CodePurposeName | null = null;
    if (user.status === 'PENDING' && user.role === 'STUDENT' && (!purpose || purpose === 'EMAIL_VERIFY')) {
      effective = 'EMAIL_VERIFY';
    } else if (user.status === 'PENDING' && user.role === 'INSTRUCTOR' && (!purpose || purpose === 'INSTRUCTOR_INVITE')) {
      effective = 'INSTRUCTOR_INVITE';
    } else if (user.status === 'ACTIVE' && purpose === 'PASSWORD_RESET') {
      effective = 'PASSWORD_RESET';
    }
    if (!effective || (await this.codes.isOnCooldown(user.id, effective))) return;
    await this.sendCode(user, effective);
  }

  // ---------- sesion ----------

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.passwordHash || !ok) throw new UnauthorizedException('Credenciales inválidas');

    if (user.status === 'PENDING') {
      throw new ForbiddenException(
        user.role === 'INSTRUCTOR'
          ? 'Debes activar tu cuenta con el código enviado a tu correo'
          : 'Debes verificar tu correo antes de iniciar sesión',
      );
    }
    if (user.status === 'DISABLED') throw new ForbiddenException('Tu cuenta está deshabilitada');
    return this.startSession(user);
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) throw new UnauthorizedException('No autenticado');
    try {
      await this.jwt.verifyAsync(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException(SESSION_INVALID);
    }

    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (!stored || stored.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException(SESSION_INVALID);
    if (stored.revokedAt) {
      // Reuso de un token ya rotado: se asume robo y se cierran todas las sesiones.
      await this.revokeAllTokens(stored.userId);
      throw new UnauthorizedException(SESSION_INVALID);
    }

    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count !== 1) throw new UnauthorizedException(SESSION_INVALID);

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException(SESSION_INVALID);
    return this.startSession(user);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ---------- contrasenas ----------

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') return;
    if (await this.codes.isOnCooldown(user.id, 'PASSWORD_RESET')) return;
    await this.sendCode(user, 'PASSWORD_RESET');
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') return this.failCode();
    await this.codes.consume(user.id, 'PASSWORD_RESET', code);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS), mustChangePassword: false },
    });
    await this.revokeAllTokens(user.id);
  }

  async changePassword(userId: string, currentPassword: string | undefined, newPassword: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('No autenticado');

    // La contrasena actual solo es opcional cuando el usuario esta obligado a cambiarla.
    if (!user.mustChangePassword && user.passwordHash) {
      if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
        throw new BadRequestException('La contraseña actual es incorrecta');
      }
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS), mustChangePassword: false },
    });
    await this.revokeAllTokens(user.id);
    return this.startSession(updated);
  }

  // ---------- instructores ----------

  async activateInstructor(email: string, code: string, newPassword: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'INSTRUCTOR' || user.status !== 'PENDING') return this.failCode();
    await this.codes.consume(user.id, 'INSTRUCTOR_INVITE', code);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
        status: 'ACTIVE',
        emailVerified: true,
        mustChangePassword: false,
      },
    });
    return this.startSession(updated);
  }

  // ---------- Google ----------

  async loginWithGoogle(profile: GoogleProfile): Promise<AuthResult> {
    const email = profile.email.toLowerCase();
    let user =
      (await this.prisma.user.findUnique({ where: { googleId: profile.googleId } })) ??
      (await this.prisma.user.findUnique({ where: { email } }));

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: profile.name || email,
          googleId: profile.googleId,
          avatarUrl: profile.picture ?? null,
          role: 'STUDENT',
          status: 'ACTIVE',
          emailVerified: true,
        },
      });
      return this.startSession(user);
    }

    if (user.status === 'DISABLED') throw new ForbiddenException('Tu cuenta está deshabilitada');
    // Un instructor invitado debe activar su cuenta con el codigo y definir contrasena.
    if (user.status === 'PENDING' && user.role !== 'STUDENT') {
      throw new ForbiddenException('Debes activar tu cuenta con el código enviado a tu correo');
    }

    if (user.googleId !== profile.googleId || user.status === 'PENDING' || !user.emailVerified) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: profile.googleId,
          status: 'ACTIVE',
          emailVerified: true,
          // Si la cuenta estaba pendiente, la contrasena pudo fijarla un tercero: se descarta.
          ...(user.status === 'PENDING' ? { passwordHash: null } : {}),
          avatarUrl: user.avatarUrl ?? profile.picture ?? null,
        },
      });
    }
    return this.startSession(user);
  }

  // ---------- internos ----------

  async sendCode(user: { id: string; email: string; name: string }, purpose: CodePurposeName): Promise<boolean> {
    const code = await this.codes.issue(user.id, purpose);
    const ttl = CODE_TTL_MS[purpose];
    let mail: RenderedEmail;
    if (purpose === 'EMAIL_VERIFY') mail = verifyEmailTemplate(user.name, code, ttl / 60000);
    else if (purpose === 'PASSWORD_RESET') mail = passwordResetTemplate(user.name, code, ttl / 60000);
    else mail = instructorInviteTemplate(user.name, code, ttl / 3600000);
    try {
      await this.email.send(user.email, user.name, mail);
      return true;
    } catch (err) {
      // No se propaga: evita diferencias observables que permitan enumerar usuarios.
      this.logger.error(`No se pudo enviar el correo (${purpose}): ${(err as Error).message}`);
      return false;
    }
  }

  private async failCode(): Promise<never> {
    // Trabajo equivalente al de un intento real para no filtrar existencia por tiempos.
    await bcrypt.compare('000000', DUMMY_HASH);
    throw new BadRequestException(INVALID_CODE_MESSAGE);
  }

  private async revokeAllTokens(userId: string) {
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async startSession(user: Parameters<typeof toPublicUser>[0]): Promise<AuthResult> {
    const publicUser: PublicUser = toPublicUser(user);
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: Math.floor(ACCESS_TTL_MS / 1000) },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti: randomUUID() },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: Math.floor(REFRESH_TTL_MS / 1000) },
    );
    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: sha256(refreshToken), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
    });
    return { user: publicUser, tokens: { accessToken, refreshToken } };
  }
}

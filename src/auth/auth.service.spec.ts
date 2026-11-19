import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createFakePrisma, FakePrisma } from '../testing/fake-prisma';
import { AuthService } from './auth.service';
import { CODE_TTL_MS, MAX_CODE_ATTEMPTS, VerificationCodeService } from './verification-code.service';

describe('AuthService', () => {
  let prisma: FakePrisma;
  let service: AuthService;
  let sent: { to: string; subject: string; text: string }[];

  const lastCode = (): string => {
    const m = sent[sent.length - 1].text.match(/\b(\d{6})\b/);
    return m![1];
  };

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    prisma = createFakePrisma();
    sent = [];
    const email = { send: async (to: string, _n: string, m: any) => void sent.push({ to, subject: m.subject, text: m.text }) };
    service = new AuthService(prisma as any, new JwtService(), new VerificationCodeService(prisma as any), email as any);
  });
  afterEach(() => jest.useRealTimers());

  describe('register -> verify-email -> login', () => {
    it('creates a PENDING student, emails a code, blocks login until verified, then logs in', async () => {
      const res = await service.register({ name: 'Ana', email: 'ana@test.com', password: 'secret123' });
      expect(res.message).toBeDefined();

      const user = prisma.user.rows[0];
      expect(user).toMatchObject({ role: 'STUDENT', status: 'PENDING', emailVerified: false });
      expect(user.passwordHash).not.toBe('secret123');
      expect(sent).toHaveLength(1);

      await expect(service.login('ana@test.com', 'secret123')).rejects.toThrow(ForbiddenException);

      const verified = await service.verifyEmail('ana@test.com', lastCode());
      expect(verified.user).toMatchObject({ email: 'ana@test.com', status: 'ACTIVE', role: 'STUDENT' });
      expect(verified.tokens.accessToken).toBeDefined();
      expect(prisma.user.rows[0].emailVerified).toBe(true);

      const login = await service.login('ana@test.com', 'secret123');
      expect(login.user.id).toBe(user.id);
      expect(login.user).not.toHaveProperty('passwordHash');
    });

    it('does not reveal an existing account: same response, no email for active users', async () => {
      await service.register({ name: 'Ana', email: 'ana@test.com', password: 'secret123' });
      await service.verifyEmail('ana@test.com', lastCode());
      sent.length = 0;
      const res = await service.register({ name: 'Otro', email: 'ana@test.com', password: 'otra-clave-1' });
      expect(res.message).toBeDefined();
      expect(sent).toHaveLength(0);
      expect(prisma.user.rows).toHaveLength(1);
    });

    it('rejects a wrong verification code', async () => {
      await service.register({ name: 'Ana', email: 'ana@test.com', password: 'secret123' });
      const wrong = lastCode() === '123456' ? '654321' : '123456';
      await expect(service.verifyEmail('ana@test.com', wrong)).rejects.toThrow(BadRequestException);
      expect(prisma.user.rows[0].status).toBe('PENDING');
    });
  });

  describe('login', () => {
    it('returns the same generic error for unknown user and wrong password', async () => {
      await prisma.user.create({
        data: { email: 'a@test.com', name: 'A', passwordHash: await bcrypt.hash('right-pass-1', 4), status: 'ACTIVE' },
      });
      const e1 = await service.login('nobody@test.com', 'whatever1').catch((e) => e);
      const e2 = await service.login('a@test.com', 'wrong-pass-1').catch((e) => e);
      expect(e1).toBeInstanceOf(UnauthorizedException);
      expect(e2).toBeInstanceOf(UnauthorizedException);
      expect(e1.message).toBe(e2.message);
    });

    it('forbids DISABLED users with a message (only after valid credentials)', async () => {
      await prisma.user.create({
        data: { email: 'd@test.com', name: 'D', passwordHash: await bcrypt.hash('right-pass-1', 4), status: 'DISABLED' },
      });
      await expect(service.login('d@test.com', 'right-pass-1')).rejects.toThrow('Tu cuenta está deshabilitada');
      await expect(service.login('d@test.com', 'bad-pass-12')).rejects.toThrow(UnauthorizedException);
    });

    it('succeeds with mustChangePassword=true and reports it', async () => {
      await prisma.user.create({
        data: {
          email: 'm@test.com',
          name: 'M',
          passwordHash: await bcrypt.hash('right-pass-1', 4),
          status: 'ACTIVE',
          mustChangePassword: true,
        },
      });
      const res = await service.login('m@test.com', 'right-pass-1');
      expect(res.user.mustChangePassword).toBe(true);
    });
  });

  describe('instructor activation', () => {
    const invite = async () => {
      const u = await prisma.user.create({
        data: { email: 'inst@test.com', name: 'Inst', role: 'INSTRUCTOR', status: 'PENDING', mustChangePassword: true },
      });
      await service.sendCode(u as any, 'INSTRUCTOR_INVITE');
      return u;
    };

    it('activates with a valid code, sets password and returns a session', async () => {
      await invite();
      const res = await service.activateInstructor('inst@test.com', lastCode(), 'nueva-clave-1');
      expect(res.user).toMatchObject({ role: 'INSTRUCTOR', status: 'ACTIVE', mustChangePassword: false });
      const row = prisma.user.rows[0];
      expect(row.emailVerified).toBe(true);
      expect(await bcrypt.compare('nueva-clave-1', row.passwordHash)).toBe(true);
      await expect(service.login('inst@test.com', 'nueva-clave-1')).resolves.toBeDefined();
    });

    it('is single use', async () => {
      await invite();
      const code = lastCode();
      await service.activateInstructor('inst@test.com', code, 'nueva-clave-1');
      await expect(service.activateInstructor('inst@test.com', code, 'otra-clave-12')).rejects.toThrow(BadRequestException);
    });

    it('rejects after 24 h', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      await invite();
      const code = lastCode();
      jest.setSystemTime(Date.now() + CODE_TTL_MS.INSTRUCTOR_INVITE + 1000);
      await expect(service.activateInstructor('inst@test.com', code, 'nueva-clave-1')).rejects.toThrow(BadRequestException);
    });

    it('locks after the maximum number of wrong attempts', async () => {
      await invite();
      const code = lastCode();
      const wrong = code === '000000' ? '111111' : '000000';
      for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
        await expect(service.activateInstructor('inst@test.com', wrong, 'nueva-clave-1')).rejects.toThrow(BadRequestException);
      }
      await expect(service.activateInstructor('inst@test.com', code, 'nueva-clave-1')).rejects.toThrow(BadRequestException);
      expect(prisma.user.rows[0].status).toBe('PENDING');
    });

    it('does not activate students or unknown emails', async () => {
      await prisma.user.create({ data: { email: 's@test.com', name: 'S', role: 'STUDENT', status: 'PENDING' } });
      await expect(service.activateInstructor('s@test.com', '123456', 'nueva-clave-1')).rejects.toThrow(BadRequestException);
      await expect(service.activateInstructor('x@test.com', '123456', 'nueva-clave-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('password flows', () => {
    const activeUser = async (extra: Record<string, unknown> = {}) =>
      prisma.user.create({
        data: { email: 'p@test.com', name: 'P', passwordHash: await bcrypt.hash('old-pass-123', 4), status: 'ACTIVE', ...extra },
      });

    it('forgot-password stays silent for unknown emails and sends a code for active users', async () => {
      await service.forgotPassword('none@test.com');
      expect(sent).toHaveLength(0);
      await activeUser();
      await service.forgotPassword('p@test.com');
      expect(sent).toHaveLength(1);
    });

    it('reset-password changes the password and revokes sessions', async () => {
      await activeUser();
      const session = await service.login('p@test.com', 'old-pass-123');
      await service.forgotPassword('p@test.com');
      await service.resetPassword('p@test.com', lastCode(), 'brand-new-1');
      await expect(service.login('p@test.com', 'old-pass-123')).rejects.toThrow(UnauthorizedException);
      await expect(service.login('p@test.com', 'brand-new-1')).resolves.toBeDefined();
      await expect(service.refresh(session.tokens.refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('change-password requires the current password unless mustChangePassword', async () => {
      const u = await activeUser();
      await expect(service.changePassword(u.id, undefined, 'brand-new-1')).rejects.toThrow(BadRequestException);
      await expect(service.changePassword(u.id, 'wrong-pass-1', 'brand-new-1')).rejects.toThrow(BadRequestException);
      await expect(service.changePassword(u.id, 'old-pass-123', 'brand-new-1')).resolves.toBeDefined();
    });

    it('change-password without current password works when mustChangePassword and clears the flag', async () => {
      const u = await activeUser({ mustChangePassword: true });
      await service.changePassword(u.id, undefined, 'brand-new-1');
      expect(prisma.user.rows[0].mustChangePassword).toBe(false);
    });
  });

  describe('refresh tokens', () => {
    it('rotates the refresh token and revokes everything on reuse of an old one', async () => {
      await prisma.user.create({
        data: { email: 'r@test.com', name: 'R', passwordHash: await bcrypt.hash('right-pass-1', 4), status: 'ACTIVE' },
      });
      const s1 = await service.login('r@test.com', 'right-pass-1');
      const s2 = await service.refresh(s1.tokens.refreshToken);
      expect(s2.tokens.refreshToken).not.toBe(s1.tokens.refreshToken);

      await expect(service.refresh(s1.tokens.refreshToken)).rejects.toThrow(UnauthorizedException);
      // el reuso cerro tambien la sesion rotada
      await expect(service.refresh(s2.tokens.refreshToken)).rejects.toThrow(UnauthorizedException);
    });

    it('logout revokes the refresh token', async () => {
      await prisma.user.create({
        data: { email: 'r@test.com', name: 'R', passwordHash: await bcrypt.hash('right-pass-1', 4), status: 'ACTIVE' },
      });
      const s = await service.login('r@test.com', 'right-pass-1');
      await service.logout(s.tokens.refreshToken);
      await expect(service.refresh(s.tokens.refreshToken)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('google login', () => {
    const profile = { googleId: 'g-1', email: 'G@Test.com', name: 'Gus' };

    it('creates an ACTIVE verified STUDENT for a new email', async () => {
      const res = await service.loginWithGoogle(profile);
      expect(res.user).toMatchObject({ email: 'g@test.com', role: 'STUDENT', status: 'ACTIVE' });
      expect(prisma.user.rows[0]).toMatchObject({ googleId: 'g-1', emailVerified: true });
    });

    it('links googleId to an existing ADMIN without changing the role', async () => {
      await prisma.user.create({ data: { email: 'g@test.com', name: 'Adm', role: 'ADMIN', status: 'ACTIVE', emailVerified: true } });
      const res = await service.loginWithGoogle(profile);
      expect(res.user.role).toBe('ADMIN');
      expect(prisma.user.rows[0].googleId).toBe('g-1');
    });

    it('refuses a pending instructor (must activate with the invite code) and disabled users', async () => {
      await prisma.user.create({ data: { email: 'g@test.com', name: 'I', role: 'INSTRUCTOR', status: 'PENDING' } });
      await expect(service.loginWithGoogle(profile)).rejects.toThrow(ForbiddenException);
      prisma.user.rows[0].status = 'DISABLED';
      await expect(service.loginWithGoogle(profile)).rejects.toThrow(ForbiddenException);
    });

    it('drops a pre-set password when Google activates a pending student account', async () => {
      await prisma.user.create({
        data: { email: 'g@test.com', name: 'S', passwordHash: 'attacker-hash', role: 'STUDENT', status: 'PENDING' },
      });
      await service.loginWithGoogle(profile);
      expect(prisma.user.rows[0]).toMatchObject({ status: 'ACTIVE', passwordHash: null });
    });
  });
});

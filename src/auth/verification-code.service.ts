import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type CodePurposeName = 'EMAIL_VERIFY' | 'INSTRUCTOR_INVITE' | 'PASSWORD_RESET';

export const MAX_CODE_ATTEMPTS = 5;
export const CODE_TTL_MS: Record<CodePurposeName, number> = {
  EMAIL_VERIFY: 15 * 60 * 1000,
  PASSWORD_RESET: 15 * 60 * 1000,
  INSTRUCTOR_INVITE: 24 * 60 * 60 * 1000,
};
export const RESEND_COOLDOWN_MS = 60 * 1000;

export const INVALID_CODE_MESSAGE = 'Código inválido o expirado';

@Injectable()
export class VerificationCodeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Genera un codigo de 6 digitos, invalida los anteriores del mismo proposito y guarda solo el hash. */
  async issue(userId: string, purpose: CodePurposeName): Promise<string> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);
    await this.prisma.verificationCode.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });
    await this.prisma.verificationCode.create({
      data: { userId, purpose, codeHash, expiresAt: new Date(Date.now() + CODE_TTL_MS[purpose]) },
    });
    return code;
  }

  /** true si se emitio un codigo hace menos de RESEND_COOLDOWN_MS. */
  async isOnCooldown(userId: string, purpose: CodePurposeName): Promise<boolean> {
    const last = await this.prisma.verificationCode.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: 'desc' },
    });
    return !!last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS;
  }

  /**
   * Valida y consume un codigo: debe existir sin usar, no expirado y con intentos disponibles.
   * El intento se cuenta antes de comparar; el consumo es atomico (un solo uso).
   * Cualquier fallo lanza el mismo mensaje generico.
   */
  async consume(userId: string, purpose: CodePurposeName, code: string): Promise<void> {
    const record = await this.prisma.verificationCode.findFirst({
      where: { userId, purpose, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.expiresAt.getTime() <= Date.now() || record.attempts >= MAX_CODE_ATTEMPTS) {
      throw new BadRequestException(INVALID_CODE_MESSAGE);
    }

    const updated = await this.prisma.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    if (updated.attempts > MAX_CODE_ATTEMPTS) throw new BadRequestException(INVALID_CODE_MESSAGE);

    const ok = await bcrypt.compare(code, record.codeHash);
    if (!ok) throw new BadRequestException(INVALID_CODE_MESSAGE);

    const claimed = await this.prisma.verificationCode.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new BadRequestException(INVALID_CODE_MESSAGE);
  }
}

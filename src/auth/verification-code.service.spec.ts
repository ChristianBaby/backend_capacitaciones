import { BadRequestException } from '@nestjs/common';
import { createFakePrisma, FakePrisma } from '../testing/fake-prisma';
import { CODE_TTL_MS, MAX_CODE_ATTEMPTS, VerificationCodeService } from './verification-code.service';

describe('VerificationCodeService', () => {
  let prisma: FakePrisma;
  let service: VerificationCodeService;

  beforeEach(() => {
    prisma = createFakePrisma();
    service = new VerificationCodeService(prisma as any);
  });
  afterEach(() => jest.useRealTimers());

  it('issues a 6-digit code and stores only its hash', async () => {
    const code = await service.issue('u1', 'EMAIL_VERIFY');
    expect(code).toMatch(/^\d{6}$/);
    const stored = prisma.verificationCode.rows[0];
    expect(stored.codeHash).not.toContain(code);
    expect(stored.codeHash).toMatch(/^\$2[aby]\$/);
    expect(stored.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(CODE_TTL_MS.EMAIL_VERIFY);
  });

  it('uses 15 min for email verify and 24 h for instructor invite', () => {
    expect(CODE_TTL_MS.EMAIL_VERIFY).toBe(15 * 60 * 1000);
    expect(CODE_TTL_MS.INSTRUCTOR_INVITE).toBe(24 * 60 * 60 * 1000);
  });

  it('accepts a valid code once and rejects reuse (single use)', async () => {
    const code = await service.issue('u1', 'INSTRUCTOR_INVITE');
    await expect(service.consume('u1', 'INSTRUCTOR_INVITE', code)).resolves.toBeUndefined();
    await expect(service.consume('u1', 'INSTRUCTOR_INVITE', code)).rejects.toThrow(BadRequestException);
  });

  it('rejects an expired code', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    const code = await service.issue('u1', 'EMAIL_VERIFY');
    jest.setSystemTime(Date.now() + CODE_TTL_MS.EMAIL_VERIFY + 1000);
    await expect(service.consume('u1', 'EMAIL_VERIFY', code)).rejects.toThrow('Código inválido o expirado');
  });

  it('rejects a code issued for a different purpose', async () => {
    const code = await service.issue('u1', 'PASSWORD_RESET');
    await expect(service.consume('u1', 'EMAIL_VERIFY', code)).rejects.toThrow(BadRequestException);
  });

  it('blocks the code after the maximum number of failed attempts, even with the right code', async () => {
    const code = await service.issue('u1', 'INSTRUCTOR_INVITE');
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
      await expect(service.consume('u1', 'INSTRUCTOR_INVITE', wrong)).rejects.toThrow(BadRequestException);
    }
    expect(prisma.verificationCode.rows[0].attempts).toBe(MAX_CODE_ATTEMPTS);
    await expect(service.consume('u1', 'INSTRUCTOR_INVITE', code)).rejects.toThrow(BadRequestException);
    expect(prisma.verificationCode.rows[0].usedAt).toBeNull();
  });

  it('invalidates the previous code when a new one is issued', async () => {
    const first = await service.issue('u1', 'EMAIL_VERIFY');
    const second = await service.issue('u1', 'EMAIL_VERIFY');
    if (first !== second) {
      await expect(service.consume('u1', 'EMAIL_VERIFY', first)).rejects.toThrow(BadRequestException);
    }
    await expect(service.consume('u1', 'EMAIL_VERIFY', second)).resolves.toBeUndefined();
  });

  it('reports a cooldown right after issuing', async () => {
    expect(await service.isOnCooldown('u1', 'EMAIL_VERIFY')).toBe(false);
    await service.issue('u1', 'EMAIL_VERIFY');
    expect(await service.isOnCooldown('u1', 'EMAIL_VERIFY')).toBe(true);
  });
});

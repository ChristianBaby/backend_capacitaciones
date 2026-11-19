import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  const make = (user: Record<string, unknown> | null) => {
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'new', ...data })),
        update: jest.fn().mockResolvedValue({ id: 'u1' }),
      },
      refreshToken: { updateMany: jest.fn() },
    };
    const auth: any = { sendCode: jest.fn().mockResolvedValue(true) };
    return { prisma, auth, service: new AdminService(prisma, auth) };
  };

  it('creates a PENDING instructor, emails the invite and never returns the code', async () => {
    const { service, auth, prisma } = make(null);
    const res = await service.createInstructor({ name: 'Ines', email: 'i@test.com' });
    expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({ role: 'INSTRUCTOR', status: 'PENDING' });
    expect(auth.sendCode).toHaveBeenCalledWith(expect.anything(), 'INSTRUCTOR_INVITE');
    expect(JSON.stringify(res)).not.toMatch(/\d{6}/);
  });

  it('rejects a duplicate email with 409', async () => {
    const { service } = make({ id: 'x' });
    await expect(service.createInstructor({ name: 'Ines', email: 'i@test.com' })).rejects.toThrow(ConflictException);
  });

  it('does not let an admin disable themself', async () => {
    const { service } = make({ id: 'a1', status: 'ACTIVE' });
    await expect(service.updateStatus('a1', 'a1', 'DISABLED')).rejects.toThrow(BadRequestException);
  });

  it('disables another user and revokes their refresh tokens', async () => {
    const { service, prisma } = make({ id: 'u1', status: 'ACTIVE' });
    await service.updateStatus('a1', 'u1', 'DISABLED');
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
  });

  it('cannot toggle a user that has not activated their account', async () => {
    const { service } = make({ id: 'u1', status: 'PENDING' });
    await expect(service.updateStatus('a1', 'u1', 'ACTIVE')).rejects.toThrow(BadRequestException);
  });

  it('resend-invite only works for pending instructors', async () => {
    const { service } = make({ id: 'u1', role: 'STUDENT', status: 'PENDING' });
    await expect(service.resendInvite('u1')).rejects.toThrow(BadRequestException);
  });
});

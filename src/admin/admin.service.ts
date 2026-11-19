import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInstructorDto, ListUsersQueryDto } from './dto/admin.dto';

const ADMIN_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  phone: true,
  avatarUrl: true,
  emailVerified: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async createInstructor(dto: CreateInstructorDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Ya existe un usuario con ese correo');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        phone: dto.phone,
        role: 'INSTRUCTOR',
        status: 'PENDING',
        mustChangePassword: true,
      },
      select: ADMIN_USER_SELECT,
    });
    const emailSent = await this.auth.sendCode(user, 'INSTRUCTOR_INVITE');
    return { user, emailSent };
  }

  async resendInvite(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.role !== 'INSTRUCTOR' || user.status !== 'PENDING') {
      throw new BadRequestException('Solo se puede reenviar la invitación a instructores pendientes de activar');
    }
    const emailSent = await this.auth.sendCode(user, 'INSTRUCTOR_INVITE');
    return { message: emailSent ? 'Invitación reenviada' : 'No se pudo enviar el correo', emailSent };
  }

  async listUsers(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { email: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: ADMIN_USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async updateStatus(actorId: string, id: string, status: 'ACTIVE' | 'DISABLED') {
    if (id === actorId && status === 'DISABLED') {
      throw new BadRequestException('No puedes deshabilitar tu propia cuenta');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.status === 'PENDING') {
      throw new BadRequestException('El usuario aún no ha activado su cuenta');
    }

    const updated = await this.prisma.user.update({ where: { id }, data: { status }, select: ADMIN_USER_SELECT });
    if (status === 'DISABLED') {
      await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return updated;
  }
}

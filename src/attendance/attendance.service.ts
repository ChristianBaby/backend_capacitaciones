import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import type { PublicUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

const publicSession = { id: true, courseId: true, title: true, startsAt: true, createdAt: true } as const;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
@Injectable()
export class AttendanceService {
  constructor(private readonly db: PrismaService) {}
  private async authorized(user: PublicUser, courseId: string) {
    const course = await this.db.course.findFirst({ where: user.role === 'ADMIN' ? { id: courseId } : { id: courseId, instructors: { some: { instructorId: user.id } } } });
    if (!course) throw new NotFoundException('Curso no encontrado');
    return course;
  }
  async sessions(user: PublicUser, courseId: string) {
    await this.authorized(user, courseId);
    return this.db.trainingSession.findMany({ where: { courseId }, select: publicSession, orderBy: { startsAt: 'asc' } });
  }
  async create(user: PublicUser, courseId: string, dto: {title: string; startsAt: string}) {
    await this.authorized(user, courseId);
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('El título es obligatorio');
    return this.db.trainingSession.create({ data: { courseId, title, startsAt: new Date(dto.startsAt) }, select: publicSession });
  }
  async qr(user: PublicUser, id: string, minutes: number) {
    const session = await this.db.trainingSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    await this.authorized(user, session.courseId);
    const code = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + minutes * 60000);
    await this.db.trainingSession.update({ where: { id }, data: { qrHash: hash(code), qrExpiresAt: expiresAt } });
    return { code, expiresAt };
  }
  async checkIn(user: PublicUser, code: string) {
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{id:string}[]>`SELECT "id" FROM "TrainingSession" WHERE "qrHash" = ${hash(code)} AND "qrExpiresAt" > clock_timestamp() FOR UPDATE`;
      if (!rows.length) throw new BadRequestException('Código inválido o vencido');
      const session = await tx.trainingSession.findUniqueOrThrow({ where: { id: rows[0].id }, select: publicSession });
      await tx.$queryRaw`SELECT "id" FROM "Course" WHERE "id" = ${session.courseId} FOR UPDATE`;
      const fresh = await tx.trainingSession.findUniqueOrThrow({ where: { id: session.id } });
      if (!fresh.qrExpiresAt || fresh.qrExpiresAt <= new Date() || fresh.qrHash !== hash(code)) throw new BadRequestException('Código inválido o vencido');
      const enrollment = await tx.enrollment.findUnique({ where: { courseId_studentId: { courseId: session.courseId, studentId: user.id } } });
      if (!enrollment || enrollment.status !== 'ENROLLED') throw new BadRequestException('Debes estar inscrito en el curso');
      const existing = await tx.attendance.findUnique({ where: { sessionId_studentId: { sessionId: session.id, studentId: user.id } } });
      if (existing) throw new ConflictException('La asistencia ya fue registrada');
      await tx.attendance.create({ data: { sessionId: session.id, studentId: user.id } });
      return { message: 'Asistencia registrada', session };
    });
  }
  async roster(user: PublicUser, id: string) {
    const session = await this.db.trainingSession.findUnique({ where: { id }, select: publicSession });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    await this.authorized(user, session.courseId);
    const records = await this.db.attendance.findMany({ where: { sessionId: id }, orderBy: { registeredAt: 'asc' } });
    const students = await this.db.user.findMany({ where: { id: { in: records.map(r => r.studentId) } }, select: { id: true, name: true, email: true } });
    const byId = new Map(students.map(s => [s.id, s]));
    return { session, items: records.map(r => ({ id: r.id, student: byId.get(r.studentId), registeredAt: r.registeredAt })) };
  }
  async report(user: PublicUser, courseId: string) {
    await this.authorized(user, courseId);
    const sessions = await this.db.trainingSession.findMany({ where: { courseId }, select: { id: true } });
    const enrollments = await this.db.enrollment.findMany({ where: { courseId, status: 'ENROLLED' }, select: { student: { select: { id: true, name: true, email: true } } } });
    const records = await this.db.attendance.groupBy({ by: ['studentId'], where: { sessionId: { in: sessions.map(s => s.id) } }, _count: { _all: true } });
    const counts = new Map(records.map(r => [r.studentId, r._count._all]));
    const totalSessions = sessions.length;
    return { totalSessions, items: enrollments.map(({student}) => { const attended = counts.get(student.id) ?? 0; return { student, attended, totalSessions, percentage: totalSessions ? Math.round(attended * 10000 / totalSessions) / 100 : 0 }; }) };
  }
}

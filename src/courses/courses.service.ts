import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PublicUser } from '../auth/auth.types';
import { EmailService } from '../email/email.service';
import { enrollmentTemplate } from '../email/email.templates';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto, ListCoursesDto, PaginationDto, UpdateCourseDto } from './dto/courses.dto';

const enrollmentSelect = { id: true, status: true, enrolledAt: true, cancelledAt: true } as const;
const courseInclude = (actorId: string) => ({
  instructors: { select: { instructor: { select: { id: true, name: true } } } },
  _count: { select: { enrollments: { where: { status: 'ENROLLED' as const } } } },
  enrollments: { where: { studentId: actorId }, select: enrollmentSelect },
} satisfies Prisma.CourseInclude);
type CourseDetails = Prisma.CourseGetPayload<{ include: ReturnType<typeof courseInclude> }>;

function courseView(course: CourseDetails) {
  const { instructors, enrollments, _count, ...fields } = course;
  return {
    ...fields,
    instructors: instructors.map(({ instructor }) => instructor),
    enrollmentCount: _count.enrollments,
    availableSeats: Math.max(0, course.capacity - _count.enrollments),
    myEnrollment: enrollments[0] ?? null,
  };
}

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(private readonly prisma: PrismaService, private readonly email: EmailService) {}

  private scope(actor: PublicUser, detail = false): Prisma.CourseWhereInput {
    if (actor.role === 'ADMIN') return {};
    if (actor.role === 'INSTRUCTOR') return { instructors: { some: { instructorId: actor.id } } };
    if (detail) {
      return { OR: [
        { status: 'PUBLISHED' },
        { enrollments: { some: { studentId: actor.id, status: 'ENROLLED' } } },
      ] };
    }
    return { status: 'PUBLISHED' };
  }

  async list(actor: PublicUser, query: ListCoursesDto) {
    const { page = 1, limit = 20 } = query;
    const filters: Prisma.CourseWhereInput = {};
    if (query.status) filters.status = query.status;
    if (query.category) filters.category = { equals: query.category, mode: 'insensitive' };
    if (query.q) filters.OR = [
      { title: { contains: query.q, mode: 'insensitive' } },
      { description: { contains: query.q, mode: 'insensitive' } },
    ];
    const where = { AND: [this.scope(actor), filters] };
    const [courses, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({ where, include: courseInclude(actor.id),
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.course.count({ where }),
    ]);
    return { items: courses.map(courseView), total, page, limit };
  }

  async get(actor: PublicUser, id: string) {
    const course = await this.prisma.course.findFirst({
      where: { AND: [{ id }, this.scope(actor, true)] }, include: courseInclude(actor.id),
    });
    if (!course) throw new NotFoundException('Curso no encontrado');
    return courseView(course);
  }

  private validateDates(startsAt: Date, endsAt: Date) {
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
      throw new BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio');
    }
  }

  private async validateInstructors(tx: Prisma.TransactionClient, ids: string[]) {
    const unique = new Set(ids);
    if (unique.size !== ids.length) throw new BadRequestException('No repitas instructores');
    const count = await tx.user.count({ where: { id: { in: ids }, role: 'INSTRUCTOR', status: 'ACTIVE' } });
    if (count !== ids.length) throw new BadRequestException('Selecciona únicamente instructores activos');
  }

  async create(actor: PublicUser, dto: CreateCourseDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    this.validateDates(startsAt, endsAt);
    const { instructorIds = [], ...fields } = dto;
    return this.prisma.$transaction(async (tx) => {
      await this.validateInstructors(tx, instructorIds);
      const course = await tx.course.create({ data: {
        ...fields, startsAt, endsAt,
        instructors: { create: instructorIds.map((instructorId) => ({ instructorId })) },
      }, include: courseInclude(actor.id) });
      return courseView(course);
    });
  }

  // Every mutation affecting availability takes this same row lock. The count and
  // write then run on one PostgreSQL connection, preventing oversubscription and
  // races with capacity edits, publication changes or enrollment cancellation.
  private async lockCourse(tx: Prisma.TransactionClient, id: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Course" WHERE "id" = ${id} FOR UPDATE`;
    if (!rows.length) throw new NotFoundException('Curso no encontrado');
    return tx.course.findUniqueOrThrow({ where: { id } });
  }

  async update(actor: PublicUser, id: string, dto: UpdateCourseDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.lockCourse(tx, id);
      const { instructorIds, startsAt: startInput, endsAt: endInput, ...fields } = dto;
      const startsAt = startInput === undefined ? current.startsAt : new Date(startInput);
      const endsAt = endInput === undefined ? current.endsAt : new Date(endInput);
      this.validateDates(startsAt, endsAt);
      if (fields.capacity !== undefined) {
        const enrolled = await tx.enrollment.count({ where: { courseId: id, status: 'ENROLLED' } });
        if (fields.capacity < enrolled) {
          throw new ConflictException('El cupo no puede ser menor que la cantidad de estudiantes inscritos');
        }
      }
      if (instructorIds !== undefined) await this.validateInstructors(tx, instructorIds);
      const course = await tx.course.update({ where: { id }, data: {
        ...fields, startsAt, endsAt,
        ...(instructorIds === undefined ? {} : {
          instructors: { deleteMany: {}, create: instructorIds.map((instructorId) => ({ instructorId })) },
        }),
      }, include: courseInclude(actor.id) });
      return courseView(course);
    });
  }

  async enroll(actor: PublicUser, courseId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const course = await this.lockCourse(tx, courseId);
      if (course.status !== 'PUBLISHED') throw new BadRequestException('El curso no está disponible para inscripción');
      if (course.startsAt <= new Date()) throw new BadRequestException('Las inscripciones cierran al comenzar el curso');
      const previous = await tx.enrollment.findUnique({ where: { courseId_studentId: { courseId, studentId: actor.id } } });
      if (previous?.status === 'ENROLLED') throw new ConflictException('Ya estás inscrito en este curso');
      const enrolled = await tx.enrollment.count({ where: { courseId, status: 'ENROLLED' } });
      if (enrolled >= course.capacity) throw new ConflictException('No quedan cupos disponibles');
      const enrollment = await tx.enrollment.upsert({
        where: { courseId_studentId: { courseId, studentId: actor.id } },
        create: { courseId, studentId: actor.id },
        update: { status: 'ENROLLED', enrolledAt: new Date(), cancelledAt: null },
        select: enrollmentSelect,
      });
      return { enrollment, course };
    });

    // The enrollment is already committed: a mail outage must never lose a seat.
    let emailSent = false;
    try {
      emailSent = await this.email.send(actor.email, actor.name,
        enrollmentTemplate(actor.name, result.course.title, result.course.venue, result.course.startsAt));
    } catch {
      this.logger.warn('Inscripción guardada; no se pudo enviar el correo de confirmación');
    }
    return { enrollment: result.enrollment, emailSent: emailSent === true };
  }

  async cancel(actor: PublicUser, courseId: string) {
    await this.prisma.$transaction(async (tx) => {
      const course = await this.lockCourse(tx, courseId);
      const enrollment = await tx.enrollment.findUnique({ where: { courseId_studentId: { courseId, studentId: actor.id } } });
      if (!enrollment || enrollment.status !== 'ENROLLED') throw new NotFoundException('No tienes una inscripción activa en este curso');
      if (course.endsAt <= new Date()) throw new BadRequestException('No se puede cancelar un curso finalizado');
      await tx.enrollment.update({ where: { id: enrollment.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    });
    return { message: 'Inscripción cancelada' };
  }

  async mine(actor: PublicUser, query: PaginationDto) {
    const { page = 1, limit = 20 } = query;
    const where = { studentId: actor.id };
    const [enrollments, total] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({ where,
        select: { ...enrollmentSelect, course: { include: courseInclude(actor.id) } },
        orderBy: [{ enrolledAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.enrollment.count({ where }),
    ]);
    return { items: enrollments.map((row) => ({ ...row, course: courseView(row.course) })), total, page, limit };
  }

  async roster(actor: PublicUser, courseId: string, query: PaginationDto) {
    // Reuse the same assignment-aware visibility check as the course detail.
    await this.get(actor, courseId);
    const { page = 1, limit = 20 } = query;
    const where = { courseId, status: 'ENROLLED' as const };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({ where,
        select: { ...enrollmentSelect, student: { select: { id: true, name: true, email: true } } },
        orderBy: [{ enrolledAt: 'asc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.enrollment.count({ where }),
    ]);
    return { items, total, page, limit };
  }
}

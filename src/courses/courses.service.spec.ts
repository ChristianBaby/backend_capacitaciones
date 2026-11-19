import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { PublicUser } from '../auth/auth.types';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { CoursesService } from './courses.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/courses.dto';

const actor: PublicUser = {
  id: 'student-1', email: 'ana@example.test', name: 'Ana', role: 'STUDENT',
  status: 'ACTIVE', avatarUrl: null, mustChangePassword: false,
};
const future = () => new Date(Date.now() + 86400000);
const later = () => new Date(Date.now() + 172800000);

describe('CoursesService business rules', () => {
  let service: CoursesService;
  let tx: any;
  let email: { send: jest.Mock };
  let course: any;

  beforeEach(() => {
    course = {
      id: 'course-1', title: 'Curso', description: 'Descripción', type: 'COURSE', category: 'Software',
      venue: 'Cusco', startsAt: future(), endsAt: later(), capacity: 2, status: 'PUBLISHED',
      instructors: [{ instructor: { id: 'instructor-1', name: 'Docente' } }],
      enrollments: [], _count: { enrollments: 0 },
    };
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: course.id }]),
      user: { count: jest.fn().mockResolvedValue(1) },
      course: {
        findUniqueOrThrow: jest.fn().mockImplementation(async () => course),
        findFirst: jest.fn().mockImplementation(async () => course),
        create: jest.fn().mockImplementation(async () => course),
        update: jest.fn().mockImplementation(async () => course),
      },
      enrollment: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        upsert: jest.fn().mockResolvedValue({ id: 'enrollment-1', status: 'ENROLLED', enrolledAt: new Date(), cancelledAt: null }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    tx.$transaction = jest.fn((callback) => callback(tx));
    email = { send: jest.fn().mockResolvedValue(true) };
    service = new CoursesService(tx as PrismaService, email as unknown as EmailService);
  });

  const dto = (): CreateCourseDto => ({
    title: 'Curso', description: 'Descripción', type: 'COURSE', category: 'Software', venue: 'Cusco',
    startsAt: future().toISOString(), endsAt: later().toISOString(), capacity: 2, instructorIds: ['instructor-1'],
  });

  it('rejects inverted dates before writing a course', async () => {
    const input = dto();
    input.endsAt = new Date(Date.now()).toISOString();
    await expect(service.create(actor, input)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.course.create).not.toHaveBeenCalled();
  });

  it('rejects unknown, disabled or non-instructor assignments', async () => {
    tx.user.count.mockResolvedValue(0);
    await expect(service.create(actor, dto())).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.course.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate instructor assignments', async () => {
    await expect(service.create(actor, { ...dto(), instructorIds: ['same', 'same'] }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not reduce capacity below active enrollments', async () => {
    tx.enrollment.count.mockResolvedValue(2);
    await expect(service.update(actor, course.id, { capacity: 1 } as UpdateCourseDto))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.course.update).not.toHaveBeenCalled();
  });

  it('validates partial date changes against the stored other date', async () => {
    await expect(service.update(actor, course.id, { startsAt: new Date(Date.now() + 259200000).toISOString() } as UpdateCourseDto))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['DRAFT', 'ARCHIVED'])('does not enroll into %s courses', async (status) => {
    course.status = status;
    await expect(service.enroll(actor, course.id)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.enrollment.upsert).not.toHaveBeenCalled();
  });

  it('closes enrollment at the start time', async () => {
    course.startsAt = new Date(Date.now() - 1);
    await expect(service.enroll(actor, course.id)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate active enrollments without a second email', async () => {
    tx.enrollment.findUnique.mockResolvedValue({ status: 'ENROLLED' });
    await expect(service.enroll(actor, course.id)).rejects.toBeInstanceOf(ConflictException);
    expect(email.send).not.toHaveBeenCalled();
  });

  it('rejects a full course', async () => {
    tx.enrollment.count.mockResolvedValue(course.capacity);
    await expect(service.enroll(actor, course.id)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.enrollment.upsert).not.toHaveBeenCalled();
  });

  it('allows reenrollment after cancellation when a seat is available', async () => {
    tx.enrollment.findUnique.mockResolvedValue({ id: 'enrollment-1', status: 'CANCELLED' });
    const result = await service.enroll(actor, course.id);
    expect(result).toMatchObject({ enrollment: { id: 'enrollment-1', status: 'ENROLLED', cancelledAt: null }, emailSent: true });
    expect(tx.enrollment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ status: 'ENROLLED', cancelledAt: null }),
    }));
  });

  it('keeps the enrollment when email delivery fails', async () => {
    email.send.mockRejectedValue(new Error('Mail unavailable'));
    const result = await service.enroll(actor, course.id);
    expect(result.enrollment.id).toBe('enrollment-1');
    expect(result.emailSent).toBe(false);
  });

  it('does not report delivery when EmailService only logs locally', async () => {
    email.send.mockResolvedValue(false);
    expect((await service.enroll(actor, course.id)).emailSent).toBe(false);
  });

  it('allows cancellation of an unpublished course and releases the active enrollment', async () => {
    course.status = 'ARCHIVED';
    tx.enrollment.findUnique.mockResolvedValue({ id: 'enrollment-1', status: 'ENROLLED' });
    await expect(service.cancel(actor, course.id)).resolves.toEqual({ message: 'Inscripción cancelada' });
    expect(tx.enrollment.update).toHaveBeenCalledWith({
      where: { id: 'enrollment-1' }, data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
    });
  });

  it('does not cancel completed courses', async () => {
    course.endsAt = new Date(Date.now() - 1);
    tx.enrollment.findUnique.mockResolvedValue({ id: 'enrollment-1', status: 'ENROLLED' });
    await expect(service.cancel(actor, course.id)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.enrollment.update).not.toHaveBeenCalled();
  });

  it('does not cancel a missing or previously cancelled enrollment', async () => {
    await expect(service.cancel(actor, course.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns a safe course view without other students or internal relation fields', async () => {
    const result = await service.get(actor, course.id);
    expect(result).toMatchObject({ instructors: [{ id: 'instructor-1', name: 'Docente' }], enrollmentCount: 0, availableSeats: 2, myEnrollment: null });
    expect(result).not.toHaveProperty('enrollments');
    expect(result).not.toHaveProperty('_count');
  });

  it('returns 404 for inaccessible courses', async () => {
    tx.course.findFirst.mockResolvedValue(null);
    await expect(service.get(actor, course.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});

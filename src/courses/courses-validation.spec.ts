import type { ExecutionContext } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { enrollmentTemplate } from '../email/email.templates';
import { CoursesAccessGuard } from './courses-access.guard';
import { CreateCourseDto, ListCoursesDto, UpdateCourseDto } from './dto/courses.dto';

const valid = {
  title: 'Curso', description: 'Contenido', type: 'COURSE', category: 'Software', venue: 'Cusco',
  startsAt: '2030-01-01T10:00:00-05:00', endsAt: '2030-01-01T12:00:00-05:00', capacity: 10,
};

describe('Course request validation', () => {
  it('requires course fields when creating', async () => {
    const errors = await validate(plainToInstance(CreateCourseDto, {}));
    expect(errors.map((e) => e.property)).toEqual(expect.arrayContaining(['title', 'capacity', 'startsAt', 'endsAt']));
  });

  it('accepts valid creation and partial updates', async () => {
    expect(await validate(plainToInstance(CreateCourseDto, valid))).toHaveLength(0);
    expect(await validate(plainToInstance(UpdateCourseDto, { status: 'PUBLISHED' }))).toHaveLength(0);
  });

  it.each([
    { title: '   ' }, { capacity: 0 }, { capacity: 1.5 }, { capacity: '10' },
    { startsAt: '2030-01-01T10:00:00' }, { instructorIds: ['bad-uuid'] },
    { status: null }, { title: null }, { capacity: null }, { instructorIds: null },
  ])('rejects invalid values and explicit nulls: %j', async (input) => {
    expect((await validate(plainToInstance(UpdateCourseDto, input))).length).toBeGreaterThan(0);
  });

  it('converts pagination and rejects out-of-range limits', async () => {
    const query = plainToInstance(ListCoursesDto, { page: '2', limit: '100' });
    expect(await validate(query)).toHaveLength(0);
    expect(query.page).toBe(2);
    expect((await validate(plainToInstance(ListCoursesDto, { limit: '101' }))).length).toBeGreaterThan(0);
  });
});

describe('Course account access', () => {
  const guard = new CoursesAccessGuard();
  const context = (status: string, mustChangePassword: boolean) => ({
    switchToHttp: () => ({ getRequest: () => ({ user: { status, mustChangePassword } }) }),
  } as ExecutionContext);

  it.each(['PENDING', 'DISABLED'])('blocks %s accounts', (status) => {
    expect(() => guard.canActivate(context(status, false))).toThrow();
  });

  it('blocks forced password changes and allows active ready accounts', () => {
    expect(() => guard.canActivate(context('ACTIVE', true))).toThrow();
    expect(guard.canActivate(context('ACTIVE', false))).toBe(true);
  });
});

it('escapes user-controlled enrollment email values', () => {
  const mail = enrollmentTemplate('<script>Ana</script>', '<img src=x>', 'A & B', new Date('2030-01-01T15:00:00Z'));
  expect(mail.html).not.toContain('<script>');
  expect(mail.html).not.toContain('<img src=x>');
  expect(mail.html).toContain('&lt;script&gt;Ana&lt;/script&gt;');
  expect(mail.html).toContain('A &amp; B');
  expect(mail.text).toContain('hora de Perú');
});

/* Run after npm run build and migrations, with an isolated local PostgreSQL DATABASE_URL. */
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL debe apuntar a una base local aislada para esta prueba.');
const database = new URL(databaseUrl);
if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) || !/sprint2.*(?:smoke|test)|(?:smoke|test).*sprint2/i.test(database.pathname)) {
  throw new Error('La prueba requiere PostgreSQL local y una base cuyo nombre incluya sprint2 y smoke/test.');
}

// Test-only secrets and fake mail transport: no production credentials or emails are used.
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = randomBytes(32).toString('hex');
process.env.JWT_REFRESH_SECRET = randomBytes(32).toString('hex');
process.env.BREVO_API_KEY = 'smoke-transport-is-overridden';

require('reflect-metadata');
const { BadRequestException, ValidationPipe } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/prisma/prisma.service');
const { EmailService } = require('../dist/email/email.service');

async function main() {
  const runId = randomUUID();
  const users = [];
  const courses = [];
  const mails = [];
  let failMail = false;
  const password = `Smoke-${randomBytes(12).toString('hex')}`;
  let app;
  let prisma;
  let checks = 0;
  const check = (condition, message) => { assert.ok(condition, message); checks += 1; };

  try {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue({ send: async (to, name, email) => {
        if (failMail) throw new Error('Simulated mail outage');
        mails.push({ to, name, email });
        return true;
      } })
      .compile();
    app = moduleRef.createNestApplication();
    app.useLogger(false);
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) => new BadRequestException(Object.values(errors[0].constraints ?? {})[0] ?? 'Datos inválidos'),
    }));
    await app.init();
    prisma = app.get(PrismaService);
    const hash = await bcrypt.hash(password, 10);

    async function actor(role, label) {
      const id = randomUUID();
      users.push(id);
      const email = `sprint2-${runId}-${label}@example.invalid`;
      await prisma.user.create({ data: {
        id, email, name: `Smoke ${label}`, role, status: 'ACTIVE', emailVerified: true,
        mustChangePassword: false, passwordHash: hash,
      } });
      const client = request.agent(app.getHttpServer());
      await client.post('/api/auth/login').send({ email, password }).expect(200);
      return { id, email, client };
    }

    const admin = await actor('ADMIN', 'admin');
    const instructor = await actor('INSTRUCTOR', 'instructor');
    const outsider = await actor('INSTRUCTOR', 'unassigned');
    const students = [];
    for (let i = 0; i < 3; i += 1) students.push(await actor('STUDENT', `student-${i}`));
    const student = students[0];
    const baseCourse = {
      title: `Curso smoke ${runId}`,
      description: 'Curso temporal para comprobar inscripción, permisos y cupos concurrentes.',
      type: 'COURSE', category: `smoke-${runId}`, venue: 'Sede de prueba',
      startsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      endsAt: new Date(Date.now() + 8 * 86400000).toISOString(),
      capacity: 3, status: 'DRAFT', instructorIds: [instructor.id],
    };

    await request(app.getHttpServer()).get('/api/courses').expect(401);
    await student.client.post('/api/courses').send(baseCourse).expect(403);
    checks += 2;
    await prisma.user.update({ where: { id: student.id }, data: { status: 'PENDING' } });
    await student.client.get('/api/courses').expect(403);
    await prisma.user.update({ where: { id: student.id }, data: { status: 'ACTIVE', mustChangePassword: true } });
    await student.client.get('/api/courses').expect(403);
    await prisma.user.update({ where: { id: student.id }, data: { mustChangePassword: false } });
    checks += 2;
    const created = await admin.client.post('/api/courses').send(baseCourse).expect(201);
    const courseId = created.body.id;
    check(typeof courseId === 'string', 'Crear un curso devuelve su id.');
    courses.push(courseId);
    check(created.body.instructors.some((i) => i.id === instructor.id), 'Crear asigna el instructor.');
    await student.client.get(`/api/courses/${courseId}`).expect(404);
    const beforePublish = await student.client.get('/api/courses').query({ q: runId }).expect(200);
    check(beforePublish.body.items.length === 0, 'El borrador no aparece en el catálogo del estudiante.');
    const forcedDrafts = await student.client.get('/api/courses').query({ status: 'DRAFT', q: runId }).expect(200);
    check(forcedDrafts.body.items.length === 0, 'Filtrar por borradores no permite eludir la visibilidad.');
    await admin.client.patch(`/api/courses/${courseId}`).send({ status: 'PUBLISHED' }).expect(200);
    const catalog = await student.client.get('/api/courses').query({ category: baseCourse.category, q: runId }).expect(200);
    check(catalog.body.items.some((c) => c.id === courseId), 'El catálogo permite encontrar el curso publicado.');
    const assigned = await instructor.client.get('/api/courses').query({ q: runId }).expect(200);
    check(assigned.body.items.some((c) => c.id === courseId), 'El instructor ve su curso asignado.');

    const enrollment = await student.client.post(`/api/courses/${courseId}/enrollments`).expect(201);
    check(enrollment.body.enrollment.status === 'ENROLLED', 'La inscripción queda activa.');
    check(enrollment.body.emailSent === true && mails.length === 1, 'La inscripción genera una confirmación mediante el transporte simulado.');
    const duplicate = await student.client.post(`/api/courses/${courseId}/enrollments`);
    check(duplicate.status === 409, 'Una inscripción duplicada devuelve conflicto.');
    const mine = await student.client.get('/api/enrollments/me').expect(200);
    check(mine.body.items.some((e) => e.course.id === courseId && e.status === 'ENROLLED'), 'Mis cursos incluye la inscripción.');
    const roster = await instructor.client.get(`/api/courses/${courseId}/enrollments`).expect(200);
    check(roster.body.items.some((e) => e.student.id === student.id), 'El instructor consulta al estudiante inscrito.');
    await student.client.get(`/api/courses/${courseId}/enrollments`).expect(403);
    const forbiddenRoster = await outsider.client.get(`/api/courses/${courseId}/enrollments`);
    check([403, 404].includes(forbiddenRoster.status), 'Otro instructor no accede a la lista de inscritos.');
    await student.client.patch(`/api/courses/${courseId}`).send({ title: 'No autorizado' }).expect(403);
    checks += 2;

    await admin.client.patch(`/api/courses/${courseId}`).send({ status: 'DRAFT' }).expect(200);
    await student.client.get(`/api/courses/${courseId}`).expect(200);
    await students[1].client.get(`/api/courses/${courseId}`).expect(404);
    checks += 2;
    await student.client.delete(`/api/courses/${courseId}/enrollments/me`).expect(200);
    await student.client.get(`/api/courses/${courseId}`).expect(404);
    await admin.client.patch(`/api/courses/${courseId}`).send({ status: 'PUBLISHED' }).expect(200);
    const reenrolled = await student.client.post(`/api/courses/${courseId}/enrollments`).expect(201);
    check(reenrolled.body.enrollment.id === enrollment.body.enrollment.id, 'Reinscribirse reutiliza el registro cancelado.');
    await students[1].client.post(`/api/courses/${courseId}/enrollments`).expect(201);
    const smallerCapacity = await admin.client.patch(`/api/courses/${courseId}`).send({ capacity: 1 });
    check([400, 409].includes(smallerCapacity.status), 'No se reduce el cupo por debajo de inscritos activos.');
    const invalidDates = await admin.client.patch(`/api/courses/${courseId}`).send({ endsAt: new Date().toISOString() });
    check(invalidDates.status === 400, 'Se rechazan fechas de término anteriores al inicio.');
    const invalidInstructor = await admin.client.patch(`/api/courses/${courseId}`).send({ instructorIds: [student.id] });
    check(invalidInstructor.status === 400, 'Un estudiante no puede asignarse como instructor.');
    await admin.client.patch(`/api/courses/${courseId}`).send({ capacity: null }).expect(400);
    await admin.client.patch(`/api/courses/${courseId}`).send({ startsAt: '2026-12-01T10:00:00' }).expect(400);
    await admin.client.get('/api/courses').query({ limit: 101 }).expect(400);
    checks += 3;
    failMail = true;
    const withoutMail = await students[2].client.post(`/api/courses/${courseId}/enrollments`).expect(201);
    failMail = false;
    check(withoutMail.body.enrollment.status === 'ENROLLED' && withoutMail.body.emailSent === false,
      'Una caída del correo conserva la inscripción y comunica emailSent=false.');

    const raceCourse = await admin.client.post('/api/courses').send({ ...baseCourse, title: `Cupo único ${runId}`, status: 'PUBLISHED', capacity: 1 }).expect(201);
    courses.push(raceCourse.body.id);
    const race = await Promise.all(students.map((s) => s.client.post(`/api/courses/${raceCourse.body.id}/enrollments`)));
    check(race.filter((r) => r.status === 201).length === 1, 'Solo una de tres solicitudes simultáneas obtiene el último cupo.');
    check(race.filter((r) => r.status === 409).length === 2, 'Las solicitudes sin cupo devuelven conflicto, nunca un error interno.');
    const raceDetail = await admin.client.get(`/api/courses/${raceCourse.body.id}`).expect(200);
    check(raceDetail.body.enrollmentCount === 1 && raceDetail.body.availableSeats === 0, 'El recuento persistido no excede el cupo.');
    await admin.client.patch(`/api/courses/${courseId}`).send({ status: 'ARCHIVED' }).expect(200);
    const archivedCatalog = await students[2].client.get('/api/courses').query({ q: runId }).expect(200);
    check(!archivedCatalog.body.items.some((c) => c.id === courseId), 'El curso archivado desaparece del catálogo.');
    await student.client.delete(`/api/courses/${courseId}/enrollments/me`).expect(200);
    checks += 1;

    console.log(`Sprint 2 smoke OK: ${checks} verificaciones; PostgreSQL real, HTTP, roles, inscripción/cancelación y concurrencia.`);
  } finally {
    try {
      if (prisma) {
        if (courses.length) await prisma.enrollment.deleteMany({ where: { courseId: { in: courses } } });
        if (courses.length) await prisma.course.deleteMany({ where: { id: { in: courses } } });
        if (users.length) await prisma.user.deleteMany({ where: { id: { in: users } } });
      }
    } finally {
      if (app) await app.close();
    }
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

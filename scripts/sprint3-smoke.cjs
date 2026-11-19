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

    const created = await admin.client.post('/api/courses').send({ ...baseCourse, status: 'PUBLISHED' }).expect(201);
    const courseId = created.body.id; courses.push(courseId);
    await student.client.post(`/api/courses/${courseId}/enrollments`).expect(201);
    const session = await admin.client.post(`/api/courses/${courseId}/sessions`).send({title:'Sesi?n prueba', startsAt:new Date().toISOString()}).expect(201);
    await outsider.client.get(`/api/courses/${courseId}/sessions`).expect(404);
    await student.client.post(`/api/courses/${courseId}/sessions`).send({title:'Prohibido',startsAt:new Date().toISOString()}).expect(403);
    const qr = await admin.client.post(`/api/sessions/${session.body.id}/qr`).send({minutes:10}).expect(201);
    await students[1].client.post('/api/attendance/check-in').send({code:qr.body.code}).expect(400);
    const race = await Promise.all([student.client.post('/api/attendance/check-in').send({code:qr.body.code}), student.client.post('/api/attendance/check-in').send({code:qr.body.code})]);
    check(race.filter(r=>r.status===201).length===1 && race.filter(r=>r.status===409).length===1,'Duplicados simult?neos producen una asistencia');
    const roster = await instructor.client.get(`/api/sessions/${session.body.id}/attendance`).expect(200);
    check(roster.body.items.length===1 && roster.body.items[0].student.id===student.id,'Instructor ve asistencia');
    const report=await instructor.client.get(`/api/courses/${courseId}/attendance`).expect(200);
    check(report.body.items[0].percentage===100,'Porcentaje de asistencia correcto');
    await instructor.client.get(`/api/courses/${courseId}/attendance.csv`).expect(200);
    const old=qr.body.code;
    const next=await admin.client.post(`/api/sessions/${session.body.id}/qr`).send({minutes:10}).expect(201);
    await student.client.post('/api/attendance/check-in').send({code:old}).expect(400);
    await prisma.trainingSession.update({where:{id:session.body.id},data:{qrExpiresAt:new Date(Date.now()-1000)}});
    await student.client.post('/api/attendance/check-in').send({code:next.body.code}).expect(400);
    const examData={title:'Prueba',opensAt:new Date(Date.now()-60000).toISOString(),closesAt:new Date(Date.now()+3600000).toISOString(),durationMinutes:30,passingScore:60,questions:[{text:'?Correcta?',type:'SINGLE',points:10,options:[{text:'S?',isCorrect:true},{text:'No',isCorrect:false}]}]};
    await outsider.client.post(`/api/courses/${courseId}/exams`).send(examData).expect(403);
    const exam=await instructor.client.post(`/api/courses/${courseId}/exams`).send(examData).expect(201);
    await students[1].client.post(`/api/exams/${exam.body.id}/start`).expect(403);
    const attempt=await student.client.post(`/api/exams/${exam.body.id}/start`).expect(201);
    check(!JSON.stringify(attempt.body).includes('isCorrect'),'No se revela respuesta correcta');
    const resume=await student.client.post(`/api/exams/${exam.body.id}/start`).expect(201);
    check(resume.body.id===attempt.body.id && resume.body.deadline===attempt.body.deadline,'Reanudar conserva plazo');
    const q=attempt.body.questions[0];
    const right=await prisma.examOption.findFirst({where:{questionId:q.id,isCorrect:true}});
    const submission=await student.client.post(`/api/exam-attempts/${attempt.body.id}/submit`).send({answers:[{questionId:q.id,optionIds:[right.id]}]}).expect(201);
    check(submission.body.score===10 && submission.body.passed===true,'Calificaci?n correcta');
    await student.client.post(`/api/exam-attempts/${attempt.body.id}/submit`).send({answers:[]}).expect(409);
    const result=await instructor.client.get(`/api/exams/${exam.body.id}/results`).expect(200);
    check(result.body.items.length===1 && result.body.passed===1,'Resultados correctos');
    const history=await student.client.get('/api/exam-attempts/me').expect(200);
    check(history.body.some(x=>x.id===attempt.body.id),'Historial incluye nota');
    const lateExam=await instructor.client.post(`/api/courses/${courseId}/exams`).send({...examData,title:'Vencido'}).expect(201);
    const lateAttempt=await student.client.post(`/api/exams/${lateExam.body.id}/start`).expect(201);
    await prisma.examAttempt.update({where:{id:lateAttempt.body.id},data:{deadline:new Date(Date.now()-1000)}});
    await student.client.post(`/api/exam-attempts/${lateAttempt.body.id}/submit`).send({answers:[]}).expect(400);
    const late=await prisma.examAttempt.findUnique({where:{id:lateAttempt.body.id}});
    check(late.submittedAt===null && late.score===null,'Env?o tard?o no calificado');
    console.log(`Sprint 3 smoke OK: ${checks} verificaciones; PostgreSQL real, HTTP, roles, inscripción/cancelación y concurrencia.`);
  } finally {
    try {
      if (prisma) {
        if (courses.length) await prisma.examAttempt.deleteMany({where:{exam:{courseId:{in:courses}}}});
        if (courses.length) await prisma.exam.deleteMany({where:{courseId:{in:courses}}});
        if (courses.length) await prisma.attendance.deleteMany({where:{session:{courseId:{in:courses}}}});
        if (courses.length) await prisma.trainingSession.deleteMany({where:{courseId:{in:courses}}});
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

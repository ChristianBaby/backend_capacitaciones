import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from './app.module';
import { EmailService } from './email/email.service';
import { PrismaService } from './prisma/prisma.service';
import { createFakePrisma, FakePrisma } from './testing/fake-prisma';

/** Pruebas HTTP del flujo de auth con Prisma en memoria (sin base de datos real). */
describe('Auth HTTP flow (in-memory Prisma)', () => {
  let app: INestApplication;
  let prisma: FakePrisma;
  let mails: string[];

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    prisma = createFakePrisma();
    mails = [];
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(EmailService)
      .useValue({ send: async (_to: string, _n: string, m: { text: string }) => void mails.push(m.text) })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, exceptionFactory: (e) => new BadRequestException(Object.values(e[0].constraints ?? {})[0]) }),
    );
    await app.init();
  });

  afterAll(() => app.close());

  const code = () => mails[mails.length - 1].match(/\b(\d{6})\b/)![1];

  it('GET /api/health', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200, { status: 'ok' });
  });

  it('register -> verify-email (sets cookies) -> me -> logout -> login', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent.post('/api/auth/register').send({ name: 'Ana', email: 'ANA@test.com', password: 'secret123' }).expect(201);
    await agent.post('/api/auth/login').send({ email: 'ana@test.com', password: 'secret123' }).expect(403);

    const v = await agent.post('/api/auth/verify-email').send({ email: 'ana@test.com', code: code() }).expect(200);
    expect(v.body).toMatchObject({ email: 'ana@test.com', role: 'STUDENT', status: 'ACTIVE', mustChangePassword: false });
    const cookies = (v.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookies).toMatch(/access_token=.*HttpOnly/i);
    expect(cookies).toMatch(/refresh_token=.*HttpOnly/i);
    expect(cookies).toMatch(/SameSite=Lax/i);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body).toMatchObject({ email: 'ana@test.com', avatarUrl: null });
    expect(me.body).not.toHaveProperty('passwordHash');

    await agent.post('/api/auth/refresh').expect(200);
    await agent.post('/api/auth/logout').expect(200);
    await agent.get('/api/auth/me').expect(401);

    const l = await agent.post('/api/auth/login').send({ email: 'ana@test.com', password: 'secret123' }).expect(200);
    expect(l.body.user.email).toBe('ana@test.com');
  });

  it('validates input with a string message and rejects short passwords', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'X', email: 'x@test.com', password: '123' }).expect(400);
    expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
    expect(typeof res.body.message).toBe('string');
  });

  it('bad credentials get a generic 401', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'ghost@test.com', password: 'whatever1' }).expect(401);
    expect(res.body.message).toBe('Credenciales inválidas');
  });

  it('admin routes: 401 without session, 403 for STUDENT', async () => {
    await request(app.getHttpServer()).get('/api/admin/users').expect(401);
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email: 'ana@test.com', password: 'secret123' }).expect(200);
    await agent.get('/api/admin/users').expect(403);
    await agent.post('/api/admin/instructors').send({ name: 'I', email: 'i@test.com' }).expect(403);
  });
});

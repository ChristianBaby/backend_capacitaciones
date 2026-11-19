import 'dotenv/config';
import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

function firstMessage(errors: ValidationError[]): string {
  for (const e of errors) {
    if (e.constraints) return Object.values(e.constraints)[0];
    if (e.children?.length) return firstMessage(e.children);
  }
  return 'Datos inválidos';
}

async function bootstrap() {
  for (const key of ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    if (!process.env[key]) throw new Error(`Falta la variable de entorno ${key}`);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1); // detras de Traefik
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(json({ limit: '4mb' }));
  app.use(urlencoded({ extended: true, limit: '4mb' }));
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) => new BadRequestException(firstMessage(errors)),
    }),
  );

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port);
}
bootstrap();

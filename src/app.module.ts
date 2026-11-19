import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CoursesModule } from './courses/courses.module';
import { EmailModule } from './email/email.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    EmailModule,
    AuthModule,
    AdminModule,
    CoursesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

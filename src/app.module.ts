import { Module } from '@nestjs/common';
import { CertificatesModule } from './certificates/certificates.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ExamsModule } from './exams/exams.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CoursesModule } from './courses/courses.module';
import { AttendanceModule } from './attendance/attendance.module';
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
    ExamsModule,
    CoursesModule,
    CertificatesModule,
    DashboardModule,
    AttendanceModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

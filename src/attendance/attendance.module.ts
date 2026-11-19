import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoursesAccessGuard } from '../courses/courses-access.guard';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
@Module({ imports: [AuthModule], controllers: [AttendanceController], providers: [AttendanceService, CoursesAccessGuard] })
export class AttendanceModule {}

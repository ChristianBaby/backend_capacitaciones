import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExamController, CourseExamController, AttemptController } from './exams.controller';
import { ExamService } from './exams.service';
import { CoursesAccessGuard } from '../courses/courses-access.guard';
@Module({ imports: [AuthModule], controllers: [ExamController, CourseExamController, AttemptController], providers: [ExamService, CoursesAccessGuard] })
export class ExamsModule {}

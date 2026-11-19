import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CoursesAccessGuard } from '../courses/courses-access.guard';
import type { PublicUser } from '../auth/auth.types';
import { CreateExamDto, SubmitDto } from './exams.dto';
import { ExamService } from './exams.service';
@Controller('courses/:courseId/exams') @UseGuards(JwtAuthGuard,RolesGuard,CoursesAccessGuard)
export class CourseExamController {
 constructor(private readonly exams: ExamService) {}
 @Get() list(@CurrentUser() u:PublicUser,@Param('courseId',ParseUUIDPipe) id:string) { return this.exams.list(u,id); }
 @Post() @Roles('INSTRUCTOR') create(@CurrentUser() u:PublicUser,@Param('courseId',ParseUUIDPipe) id:string,@Body() dto:CreateExamDto) { return this.exams.create(u,id,dto); }
}
@Controller('exams') @UseGuards(JwtAuthGuard,RolesGuard,CoursesAccessGuard)
export class ExamController {
 constructor(private readonly exams: ExamService) {}
 @Get(':id') detail(@CurrentUser() u:PublicUser,@Param('id',ParseUUIDPipe) id:string) { return this.exams.detail(u,id); }
 @Post(':id/start') @Roles('STUDENT') start(@CurrentUser() u:PublicUser,@Param('id',ParseUUIDPipe) id:string) { return this.exams.start(u,id); }
 @Get(':id/results') @Roles('ADMIN','INSTRUCTOR') results(@CurrentUser() u:PublicUser,@Param('id',ParseUUIDPipe) id:string) { return this.exams.results(u,id); }
}
@Controller('exam-attempts') @UseGuards(JwtAuthGuard,RolesGuard,CoursesAccessGuard)
export class AttemptController {
 constructor(private readonly exams: ExamService) {}
 @Get('me') @Roles('STUDENT') mine(@CurrentUser() u:PublicUser) { return this.exams.mine(u); }
 @Post(':id/submit') @Roles('STUDENT') submit(@CurrentUser() u:PublicUser,@Param('id',ParseUUIDPipe) id:string,@Body() dto:SubmitDto) { return this.exams.submit(u,id,dto); }
}

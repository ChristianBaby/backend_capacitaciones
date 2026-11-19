import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { PublicUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CoursesAccessGuard } from './courses-access.guard';
import { CoursesService } from './courses.service';
import { CreateCourseDto, ListCoursesDto, PaginationDto, UpdateCourseDto } from './dto/courses.dto';

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard, CoursesAccessGuard)
@Roles('ADMIN', 'INSTRUCTOR', 'STUDENT')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  list(@CurrentUser() actor: PublicUser, @Query() query: ListCoursesDto) {
    return this.courses.list(actor, query);
  }

  @Post()
  @Roles('ADMIN')
  create(@CurrentUser() actor: PublicUser, @Body() dto: CreateCourseDto) {
    return this.courses.create(actor, dto);
  }

  @Get(':id')
  get(@CurrentUser() actor: PublicUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.courses.get(actor, id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@CurrentUser() actor: PublicUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCourseDto) {
    return this.courses.update(actor, id, dto);
  }

  @Post(':id/enrollments')
  @Roles('STUDENT')
  enroll(@CurrentUser() actor: PublicUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.courses.enroll(actor, id);
  }

  @Delete(':id/enrollments/me')
  @Roles('STUDENT')
  cancel(@CurrentUser() actor: PublicUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.courses.cancel(actor, id);
  }

  @Get(':id/enrollments')
  @Roles('ADMIN', 'INSTRUCTOR')
  roster(@CurrentUser() actor: PublicUser, @Param('id', ParseUUIDPipe) id: string, @Query() query: PaginationDto) {
    return this.courses.roster(actor, id, query);
  }
}

@Controller('enrollments')
@UseGuards(JwtAuthGuard, RolesGuard, CoursesAccessGuard)
@Roles('STUDENT')
export class EnrollmentsController {
  constructor(private readonly courses: CoursesService) {}

  @Get('me')
  mine(@CurrentUser() actor: PublicUser, @Query() query: PaginationDto) {
    return this.courses.mine(actor, query);
  }
}

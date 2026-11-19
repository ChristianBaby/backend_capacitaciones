import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { IsDateString, IsInt, IsNotEmpty, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import type { PublicUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CoursesAccessGuard } from '../courses/courses-access.guard';
import { AttendanceService } from './attendance.service';

class SessionDto {
  @IsString() @IsNotEmpty() @MaxLength(180) title: string;
  @IsDateString() @Matches(/T.+(?:Z|[+-]\d{2}:\d{2})$/) startsAt: string;
}
class QrDto { @IsInt() @Min(1) @Max(1440) minutes: number; }
class CheckInDto { @IsString() @Matches(/^[a-f0-9]{64}$/) code: string; }

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, CoursesAccessGuard)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}
  @Get('courses/:courseId/sessions') @Roles('ADMIN', 'INSTRUCTOR')
  sessions(@CurrentUser() user: PublicUser, @Param('courseId', ParseUUIDPipe) id: string) { return this.attendance.sessions(user, id); }
  @Post('courses/:courseId/sessions') @Roles('ADMIN')
  create(@CurrentUser() user: PublicUser, @Param('courseId', ParseUUIDPipe) id: string, @Body() dto: SessionDto) { return this.attendance.create(user, id, dto); }
  @Post('sessions/:id/qr') @Roles('ADMIN')
  qr(@CurrentUser() user: PublicUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: QrDto) { return this.attendance.qr(user, id, dto.minutes); }
  @Get('sessions/:id/attendance') @Roles('ADMIN', 'INSTRUCTOR')
  roster(@CurrentUser() user: PublicUser, @Param('id', ParseUUIDPipe) id: string) { return this.attendance.roster(user, id); }
  @Get('courses/:courseId/attendance') @Roles('ADMIN', 'INSTRUCTOR')
  report(@CurrentUser() user: PublicUser, @Param('courseId', ParseUUIDPipe) id: string) { return this.attendance.report(user, id); }
  @Get('courses/:courseId/attendance.csv') @Roles('ADMIN', 'INSTRUCTOR')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="asistencia.csv"')
  async export(@CurrentUser() user: PublicUser, @Param('courseId', ParseUUIDPipe) id: string) {
    const report = await this.attendance.report(user, id);
    const cell = (value: string | number) => `"${String(value).replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`;
    return '\ufeff' + [['Nombre', 'Correo', 'Asistencias', 'Sesiones', 'Porcentaje'], ...report.items.map(i => [i.student.name, i.student.email, i.attended, i.totalSessions, i.percentage])].map(row => row.map(cell).join(',')).join('\r\n');
  }
  @Post('attendance/check-in') @Roles('STUDENT')
  checkIn(@CurrentUser() user: PublicUser, @Body() dto: CheckInDto) { return this.attendance.checkIn(user, dto.code); }
}

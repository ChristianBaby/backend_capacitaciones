import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { PublicUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';
import { CreateInstructorDto, ListUsersQueryDto, UpdateStatusDto } from './dto/admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Post('instructors')
  createInstructor(@Body() dto: CreateInstructorDto) {
    return this.admin.createInstructor(dto);
  }

  @Post('instructors/:id/resend-invite')
  @HttpCode(200)
  resendInvite(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.resendInvite(id);
  }

  @Get('users')
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.admin.listUsers(query);
  }

  @Patch('users/:id/status')
  updateStatus(
    @CurrentUser() actor: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.admin.updateStatus(actor.id, id, dto.status);
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CoursesAccessGuard } from '../courses/courses-access.guard';
import type { PublicUser } from '../auth/auth.types';
import { CertificatesService } from './certificates.service';
import { IssueDto, PolicyDto, TemplateDto } from './certificates.dto';
@Controller('certificates')
export class CertificatesController {
 constructor(private readonly service:CertificatesService) {}
 @Get('verify/:code') verify(@Param('code') code:string) {return this.service.verify(code);}
 @Get('templates') @UseGuards(JwtAuthGuard,RolesGuard,CoursesAccessGuard) @Roles('ADMIN') templates() {return this.service.templates();}
 @Post('templates') @UseGuards(JwtAuthGuard,RolesGuard,CoursesAccessGuard) @Roles('ADMIN') template(@Body() dto:TemplateDto) {return this.service.createTemplate(dto);}
 @Put('policies/:courseId') @UseGuards(JwtAuthGuard,RolesGuard,CoursesAccessGuard) @Roles('ADMIN') policy(@Param('courseId',ParseUUIDPipe) id:string,@Body() dto:PolicyDto) {return this.service.policy(id,dto);}
 @Get('policies/:courseId') @UseGuards(JwtAuthGuard,RolesGuard,CoursesAccessGuard) @Roles('ADMIN') getPolicy(@Param('courseId',ParseUUIDPipe) id:string) {return this.service.getPolicy(id);}
 @Post('issue') @UseGuards(JwtAuthGuard,RolesGuard,CoursesAccessGuard) @Roles('ADMIN') issue(@Body() dto:IssueDto) {return this.service.issue(dto);}
 @Get('mine') @UseGuards(JwtAuthGuard,RolesGuard,CoursesAccessGuard) @Roles('STUDENT') mine(@CurrentUser() user:PublicUser) {return this.service.mine(user);}
 @Get() @UseGuards(JwtAuthGuard,RolesGuard,CoursesAccessGuard) @Roles('ADMIN') list(@Query('courseId') courseId?:string) {return this.service.list(courseId);}
 @Get(':id/download') @UseGuards(JwtAuthGuard,RolesGuard,CoursesAccessGuard) @Roles('ADMIN','STUDENT') async download(@CurrentUser() user:PublicUser,@Param('id',ParseUUIDPipe) id:string,@Res() res:Response) {const pdf=await this.service.download(user,id); res.setHeader('Content-Type','application/pdf'); res.setHeader('Content-Disposition','attachment; filename="certificado.pdf"'); res.send(Buffer.from(pdf));}
 @Patch(':id/revoke') @UseGuards(JwtAuthGuard,RolesGuard,CoursesAccessGuard) @Roles('ADMIN') revoke(@Param('id',ParseUUIDPipe) id:string) {return this.service.revoke(id);}
}

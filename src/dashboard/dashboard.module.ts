import { Controller, Get, Injectable, Module, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CoursesAccessGuard } from '../courses/courses-access.guard';
@Injectable()
export class DashboardService {
 constructor(private readonly db:PrismaService) {}
 async metrics() {
  const [users,activeCourses,enrollments,sessions,attendances,attempts,passed,certificates]=await Promise.all([
   this.db.user.groupBy({by:['role'],_count:{_all:true}}),
   this.db.course.count({where:{status:'PUBLISHED'}}),
   this.db.enrollment.count({where:{status:'ENROLLED'}}),
   this.db.trainingSession.findMany({select:{courseId:true}}),
   this.db.attendance.findMany({select:{studentId:true,session:{select:{courseId:true}}}}),
   this.db.examAttempt.count({where:{submittedAt:{not:null}}}),
   this.db.examAttempt.count({where:{submittedAt:{not:null},passed:true}}),
   this.db.certificate.count({where:{status:'VALID'}}),
  ]);
  const distinct=[...new Set(sessions.map(s=>s.courseId))];
  const active=await this.db.enrollment.findMany({where:{courseId:{in:distinct},status:'ENROLLED'},select:{courseId:true,studentId:true}});
  const activeKeys=new Set(active.map(x=>x.courseId + ":" + x.studentId));
  const attendanceCount=attendances.filter(x=>activeKeys.has(x.session.courseId + ":" + x.studentId)).length;
  const counts=await this.db.enrollment.groupBy({by:['courseId'],where:{courseId:{in:distinct},status:'ENROLLED'},_count:{_all:true}});
  const byCourse=new Map(counts.map(x=>[x.courseId,x._count._all]));
  const possible=sessions.reduce((sum,s)=>sum+(byCourse.get(s.courseId)||0),0);
  return {users:{ADMIN:users.find(x=>x.role==='ADMIN')?._count._all||0,INSTRUCTOR:users.find(x=>x.role==='INSTRUCTOR')?._count._all||0,STUDENT:users.find(x=>x.role==='STUDENT')?._count._all||0},activeCourses,enrollments,attendanceRate:possible?Math.min(100,Math.round(attendanceCount*10000/possible)/100):0,approvalRate:attempts?Math.round(passed*10000/attempts)/100:0,certificates};
 }
}
@Controller('dashboard') @UseGuards(JwtAuthGuard,RolesGuard,CoursesAccessGuard) @Roles('ADMIN')
export class DashboardController {constructor(private readonly service:DashboardService){} @Get() metrics(){return this.service.metrics();}}
@Module({imports:[AuthModule],controllers:[DashboardController],providers:[DashboardService,CoursesAccessGuard]})
export class DashboardModule {}

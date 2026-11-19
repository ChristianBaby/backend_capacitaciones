import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PublicUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExamDto, SubmitDto } from './exams.dto';
const summary = { id:true,courseId:true,title:true,opensAt:true,closesAt:true,durationMinutes:true,passingScore:true } as const;
@Injectable()
export class ExamService {
 constructor(private readonly db:PrismaService) {}
 private async access(u:PublicUser,courseId:string) {
  const course=await this.db.course.findUnique({where:{id:courseId},include:{instructors:true,enrollments:{where:{studentId:u.id,status:'ENROLLED'}}}});
  if (!course) throw new NotFoundException('Curso no encontrado');
  if (u.role==='INSTRUCTOR' && !course.instructors.some(x=>x.instructorId===u.id)) throw new ForbiddenException();
  if (u.role==='STUDENT' && !course.enrollments.length) throw new ForbiddenException();
 }
 async create(u:PublicUser,courseId:string,dto:CreateExamDto) {
  await this.access(u,courseId);
  const opensAt=new Date(dto.opensAt), closesAt=new Date(dto.closesAt);
  if (!Number.isFinite(opensAt.getTime()) || closesAt<=opensAt || !dto.title.trim()) throw new BadRequestException('Fechas o título inválidos');
  for(const q of dto.questions) {
   const correct=q.options.filter(o=>o.isCorrect).length;
   if (!q.text.trim() || q.options.some(o=>!o.text.trim()) || correct===0 || (q.type!=='MULTIPLE' && correct!==1) || (q.type==='TRUE_FALSE' && q.options.length!==2)) throw new BadRequestException('Pregunta u opciones inválidas');
  }
  return this.db.exam.create({data:{courseId,title:dto.title,opensAt,closesAt,durationMinutes:dto.durationMinutes,passingScore:dto.passingScore,questions:{create:dto.questions.map(q=>({text:q.text,type:q.type,points:q.points,options:{create:q.options}}))}},select:summary});
 }
 async list(u:PublicUser,courseId:string) {
  await this.access(u,courseId);
  const now=new Date();
  return this.db.exam.findMany({where:{courseId,...(u.role==='STUDENT'?{opensAt:{lte:now},closesAt:{gt:now}}:{})},select:summary,orderBy:{opensAt:'asc'}});
 }
 async detail(u:PublicUser,id:string) {
  const exam=await this.db.exam.findUnique({where:{id},select:summary});
  if (!exam) throw new NotFoundException();
  await this.access(u,exam.courseId);
  if(u.role==='STUDENT' && (exam.opensAt>new Date() || exam.closesAt<=new Date())) throw new NotFoundException();
  return exam;
 }
 async start(u:PublicUser,id:string) {
  const exam=await this.db.exam.findUnique({where:{id},include:{questions:{include:{options:true}}}});
  if(!exam) throw new NotFoundException();
  await this.access(u,exam.courseId);
  const now=new Date(); if(now<exam.opensAt || now>=exam.closesAt) throw new BadRequestException('Evaluación fuera de horario');
  const deadline=new Date(Math.min(exam.closesAt.getTime(),now.getTime()+exam.durationMinutes*60000));
  let attempt=await this.db.examAttempt.findUnique({where:{examId_studentId:{examId:id,studentId:u.id}}});
  if (!attempt) {
   try { attempt=await this.db.examAttempt.create({data:{examId:id,studentId:u.id,startedAt:now,deadline,maxScore:exam.questions.reduce((s,q)=>s+q.points,0)}}); }
   catch(e:any) { if(e.code!=='P2002') throw e; attempt=await this.db.examAttempt.findUniqueOrThrow({where:{examId_studentId:{examId:id,studentId:u.id}}}); }
  }
  if (attempt.submittedAt || attempt.deadline<=now) throw new ConflictException('Ya utilizaste tu intento');
  return {id:attempt.id,examId:id,startedAt:attempt.startedAt,deadline:attempt.deadline,questions:exam.questions.map(q=>({id:q.id,text:q.text,type:q.type,points:q.points,options:q.options.map(o=>({id:o.id,text:o.text}))}))};
 }
 async submit(u:PublicUser,id:string,dto:SubmitDto) {
  return this.db.$transaction(async tx=>{
   const rows=await tx.$queryRaw<{id:string}[]>`SELECT "id" FROM "ExamAttempt" WHERE "id" = ${id} FOR UPDATE`;
   if(!rows.length) throw new NotFoundException();
   const attempt=await tx.examAttempt.findUniqueOrThrow({where:{id},include:{exam:{include:{questions:{include:{options:true}}}}}});
   if(attempt.studentId!==u.id) throw new ForbiddenException();
   await this.access(u,attempt.exam.courseId);
   const now=new Date(); if(attempt.submittedAt) throw new ConflictException('Intento ya enviado');
   if(now>=attempt.deadline || now>=attempt.exam.closesAt) throw new BadRequestException('Tiempo de evaluación vencido');
   const seen=new Set<string>(); let score=0;
   for(const answer of dto.answers) {
    const q=attempt.exam.questions.find(x=>x.id===answer.questionId);
    if(!q || seen.has(answer.questionId) || new Set(answer.optionIds).size!==answer.optionIds.length || answer.optionIds.some(id=>!q.options.some(o=>o.id===id)) || (q.type!=='MULTIPLE' && answer.optionIds.length>1)) throw new BadRequestException('Respuestas inválidas');
    seen.add(q.id); const correct=q.options.filter(o=>o.isCorrect).map(o=>o.id);
    if(correct.length===answer.optionIds.length && correct.every(id=>answer.optionIds.includes(id))) score+=q.points;
   }
   const passed=score/attempt.maxScore*100>=attempt.exam.passingScore;
   return tx.examAttempt.update({where:{id},data:{score,passed,submittedAt:now,answers:dto.answers.map(a=>({questionId:a.questionId,optionIds:a.optionIds}))},select:{id:true,score:true,maxScore:true,passed:true,submittedAt:true}});
  });
 }
 async results(u:PublicUser,id:string) {
  const exam=await this.db.exam.findUnique({where:{id}}); if(!exam) throw new NotFoundException(); await this.access(u,exam.courseId);
  const attempts=await this.db.examAttempt.findMany({where:{examId:id,submittedAt:{not:null}}});
  const students=await this.db.user.findMany({where:{id:{in:attempts.map(x=>x.studentId)}},select:{id:true,name:true,email:true}});
  const items=attempts.map(a=>({studentId:a.studentId,name:students.find(s=>s.id===a.studentId)?.name,email:students.find(s=>s.id===a.studentId)?.email,score:a.score,maxScore:a.maxScore,passed:a.passed,submittedAt:a.submittedAt}));
  return {items,average:items.length?items.reduce((s,x)=>s+(x.score??0),0)/items.length:0,passed:items.filter(x=>x.passed).length,failed:items.filter(x=>!x.passed).length};
 }
 async mine(u:PublicUser) {
  const attempts=await this.db.examAttempt.findMany({where:{studentId:u.id,submittedAt:{not:null}},include:{exam:true},orderBy:{submittedAt:'desc'}});
  return attempts.map(a=>({id:a.id,examId:a.examId,title:a.exam.title,courseId:a.exam.courseId,score:a.score,maxScore:a.maxScore,passed:a.passed,submittedAt:a.submittedAt}));
 }
}

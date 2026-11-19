import { BadRequestException, ConflictException, Injectable, NotFoundException, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { TemplateDto, IssueDto, PolicyDto } from './certificates.dto';
import type { PublicUser } from '../auth/auth.types';

const visible = {id:true,code:true,courseId:true,studentId:true,templateId:true,status:true,issuedAt:true,course:{select:{title:true}},student:{select:{name:true,email:true}}} as const;
const keys = ['name','course','date','code','qr'] as const;
@Injectable()
export class CertificatesService implements OnModuleInit, OnModuleDestroy {
 private timer?: NodeJS.Timeout;
 private running=false;
 private readonly logger=new Logger(CertificatesService.name);
 onModuleInit() { this.timer=setInterval(() => void this.emitAutomatic(), 60000); this.timer.unref(); }
 onModuleDestroy() { if(this.timer) clearInterval(this.timer); }
 async emitAutomatic() {
  if(this.running) return; this.running=true;
  try {
   const policies=await this.db.certificatePolicy.findMany({where:{course:{endsAt:{lte:new Date()}}}});
   for(const p of policies) {
    const enrollments=await this.db.enrollment.findMany({where:{courseId:p.courseId,status:"ENROLLED",student:{certificates:{none:{courseId:p.courseId}}}},select:{studentId:true}});
    for(const e of enrollments) {
     try { if(await this.eligible(p.courseId,e.studentId,p)) await this.issue({courseId:p.courseId,studentId:e.studentId,templateId:p.templateId,manual:false}); }
     catch(error) { this.logger.warn(`No se pudo emitir certificado automático: ${String(error)}`); }
    }
   }
  } catch(error) { this.logger.error(`Error en emisión automática: ${String(error)}`); } finally { this.running=false; }
 }
 constructor(private readonly db:PrismaService,private readonly email:EmailService) {}
 async createTemplate(dto:TemplateDto) {
  if (!dto.name.trim()) throw new BadRequestException('Nombre obligatorio');
  const match=/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dto.imageData);
  if (!match) throw new BadRequestException('Use imagen PNG o JPEG válida');
  const bytes=Buffer.from(match[2],'base64');
  if(bytes.length>2_500_000 || bytes.length<8) throw new BadRequestException('Imagen inválida o demasiado grande');
  const fields=dto.fields;
  for (const key of keys) {
   const f=fields[key];
   if(!f || !Number.isFinite(f.x) || !Number.isFinite(f.y) || !Number.isFinite(f.size) || f.x<0 || f.x>100 || f.y<0 || f.y>100 || f.size<=0 || f.size>100 || false) throw new BadRequestException(`Posición inválida: ${key}`);
  }
  try { const pdf=await PDFDocument.create(); const image=match[1]==='png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes); const qr=fields.qr, size=Math.min(image.width,image.height)*qr.size/100; if(image.width*qr.x/100+size>image.width || image.height*qr.y/100+size>image.height) throw new Error('overflow'); } catch { throw new BadRequestException('Imagen o posición del QR inválidas'); }
  return this.db.certificateTemplate.create({data:{name:dto.name.trim(),imageData:dto.imageData,fields:fields as any}});
 }
 templates() { return this.db.certificateTemplate.findMany({orderBy:{createdAt:'desc'}}); }
 async policy(courseId:string, dto:PolicyDto) {
  if(!await this.db.course.findUnique({where:{id:courseId}})) throw new NotFoundException('Curso no encontrado');
  if(!await this.db.certificateTemplate.findUnique({where:{id:dto.templateId}})) throw new BadRequestException('Plantilla no encontrada');
  return this.db.certificatePolicy.upsert({where:{courseId},create:{courseId,...dto},update:dto});
 }
 getPolicy(courseId:string) {return this.db.certificatePolicy.findUnique({where:{courseId}});}
 async eligible(courseId:string,studentId:string,policy:{requireExam:boolean;minimumAttendance:number}) {
  if(policy.requireExam && !await this.db.examAttempt.findFirst({where:{studentId,exam:{courseId},passed:true}})) return false;
  if(policy.minimumAttendance>0) {
   const total=await this.db.trainingSession.count({where:{courseId}});
   if (!total) return false;
   const attended=await this.db.attendance.count({where:{studentId,session:{courseId}}});
   if(attended*100/total<policy.minimumAttendance) return false;
  }
  return true;
 }
 async issue(dto:IssueDto) {
  const [course,student,template,enrollment]=await Promise.all([
   this.db.course.findUnique({where:{id:dto.courseId}}), this.db.user.findUnique({where:{id:dto.studentId}}),
   this.db.certificateTemplate.findUnique({where:{id:dto.templateId}}),
   this.db.enrollment.findUnique({where:{courseId_studentId:{courseId:dto.courseId,studentId:dto.studentId}}}),
  ]);
  if(!course||!student||!template) throw new NotFoundException('Curso, estudiante o plantilla no encontrados');
  if(student.role!=='STUDENT'||enrollment?.status!=='ENROLLED') throw new BadRequestException('El estudiante debe estar inscrito');
  if(!dto.manual) {
   const policy=await this.getPolicy(course.id);
   if(course.endsAt>new Date() || !policy || policy.templateId!==template.id || !await this.eligible(course.id,student.id,policy)) throw new BadRequestException('No cumple las condiciones de emisión');
  }
  if(await this.db.certificate.findUnique({where:{courseId_studentId:{courseId:course.id,studentId:student.id}}})) throw new ConflictException('Ya existe un certificado para este curso');
  const code=randomBytes(16).toString('hex'), issuedAt=new Date();
  const base=(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/,'');
  const qr=await QRCode.toBuffer(`${base}/verificar/${code}`);
  const pdf=await PDFDocument.create();
  const imageBuffer=Buffer.from(template.imageData.split(',')[1],'base64');
  const background=template.imageData.startsWith('data:image/png;')?await pdf.embedPng(imageBuffer):await pdf.embedJpg(imageBuffer);
  const scale=Math.min(1,1200/background.width,1200/background.height), w=background.width*scale,h=background.height*scale;
  const page=pdf.addPage([w,h]); page.drawImage(background,{x:0,y:0,width:w,height:h});
  const font=await pdf.embedFont(StandardFonts.Helvetica); const fields=template.fields as any;
  const values={name:student.name,course:course.title,date:issuedAt.toLocaleDateString('es-PE',{timeZone:'America/Lima'}),code};
  for(const [key,value] of Object.entries(values)) {
   const f=fields[key], safe=value.replace(/[^\x20-\x7e\xa0-\xff]/g,'?');
   page.drawText(safe,{x:w*f.x/100,y:h*(1-f.y/100)-f.size,size:f.size,font,maxWidth:w*(1-f.x/100)});
  }
  const q=fields.qr,qsize=Math.min(w,h)*q.size/100; page.drawImage(await pdf.embedPng(qr),{x:w*q.x/100,y:h*(1-q.y/100)-qsize,width:qsize,height:qsize});
  const bytes=Buffer.from(await pdf.save());
  let certificate;
  try { certificate=await this.db.certificate.create({data:{code,courseId:course.id,studentId:student.id,templateId:template.id,issuedAt,pdf:bytes},select:visible}); }
  catch(e:any) {if(e.code==='P2002') throw new ConflictException('Ya existe un certificado para este curso'); throw e;}
  let emailSent=false;
  try {emailSent=await this.email.send(student.email,student.name,{subject:'Certificado de capacitación',text:`Tu certificado de ${course.title} está disponible. Verifica en ${base}/verificar/${code}`,html:`<p>Tu certificado está disponible en la plataforma.</p>`,attachments:[{name:'certificado.pdf',content:bytes.toString('base64')}]});} catch { /* certificate remains downloadable */ }
  return {certificate,emailSent};
 }
 async list(courseId?:string) {return this.db.certificate.findMany({where:courseId?{courseId}:undefined,select:visible,orderBy:{issuedAt:'desc'}});}
 async mine(user:PublicUser) {return this.db.certificate.findMany({where:{studentId:user.id},select:visible,orderBy:{issuedAt:'desc'}});}
 async download(user:PublicUser,id:string) {const c=await this.db.certificate.findUnique({where:{id}}); if(!c || (user.role!=='ADMIN' && c.studentId!==user.id)) throw new NotFoundException('Certificado no encontrado'); return c.pdf;}
 async verify(code:string) {const c=await this.db.certificate.findUnique({where:{code},select:visible}); if(!c) throw new NotFoundException('Certificado no encontrado'); return {name:c.student.name,course:c.course.title,date:c.issuedAt,status:c.status,code:c.code};}
 async revoke(id:string) {const c=await this.db.certificate.findUnique({where:{id}}); if(!c) throw new NotFoundException('Certificado no encontrado'); return this.db.certificate.update({where:{id},data:{status:'REVOKED'},select:visible});}
}

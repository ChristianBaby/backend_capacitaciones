/* Run only with an isolated local sprint2_smoke/test PostgreSQL database. */
const assert = require('node:assert/strict');
const {randomUUID,randomBytes}=require('node:crypto');
const url=new URL(process.env.DATABASE_URL || 'postgres://invalid/invalid');
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname) || !/sprint2.*(?:smoke|test)|(?:smoke|test).*sprint2/i.test(url.pathname)) throw Error('Se requiere DATABASE_URL local aislada sprint2_smoke/test');
process.env.NODE_ENV='test'; process.env.JWT_ACCESS_SECRET=randomBytes(32).toString('hex'); process.env.JWT_REFRESH_SECRET=randomBytes(32).toString('hex'); process.env.BREVO_API_KEY='mock-only';
require('reflect-metadata');
const {ValidationPipe,BadRequestException}=require('@nestjs/common');
const {Test}=require('@nestjs/testing');
const bcrypt=require('bcrypt'); const cookieParser=require('cookie-parser'); const request=require('supertest'); const QRCode=require('qrcode');
const {AppModule}=require('../dist/app.module'); const {PrismaService}=require('../dist/prisma/prisma.service'); const {EmailService}=require('../dist/email/email.service'); const {CertificatesService}=require('../dist/certificates/certificates.service');
async function main(){
 let app,db; const users=[],courses=[],templates=[],sent=[]; let checks=0; const runId=randomUUID(), password=randomBytes(16).toString('hex');
 const check=(x,message)=>{assert.ok(x,message);checks++};
 try{
  const module=await Test.createTestingModule({imports:[AppModule]}).overrideProvider(EmailService).useValue({send:async(to,name,mail)=>{sent.push({to,name,mail});return true}}).compile();
  app=module.createNestApplication(); app.useLogger(false); app.setGlobalPrefix('api'); app.use(cookieParser()); app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,exceptionFactory:errors=>new BadRequestException(Object.values(errors[0].constraints??{})[0]||'Datos invalidos')})); await app.init(); db=app.get(PrismaService);
  const pwd=await bcrypt.hash(password,10);
  async function actor(role,label){const id=randomUUID();users.push(id);const email=`sprint4-${runId}-${label}@example.invalid`; await db.user.create({data:{id,email,name:`Smoke ${label}`,role,status:'ACTIVE',emailVerified:true,passwordHash:pwd}});const client=request.agent(app.getHttpServer());await client.post('/api/auth/login').send({email,password}).expect(200);return{id,email,client};}
  const admin=await actor('ADMIN','admin'), student=await actor('STUDENT','student'), other=await actor('STUDENT','other');
  async function course(label){const c=await db.course.create({data:{title:`Smoke ${label} ${runId}`,description:'Prueba',type:'COURSE',category:'Test',venue:'Test',startsAt:new Date(Date.now()-172800000),endsAt:new Date(Date.now()-86400000),capacity:10,status:'PUBLISHED'}}); courses.push(c.id); return c;}
  const course1=await course('manual'),course2=await course('auto'),course3=await course('exam');
  await db.enrollment.createMany({data:[{courseId:course1.id,studentId:student.id},{courseId:course2.id,studentId:student.id},{courseId:course2.id,studentId:other.id},{courseId:course3.id,studentId:student.id},{courseId:course3.id,studentId:other.id}]});
  const before=await admin.client.get('/api/dashboard').expect(200); await student.client.get('/api/dashboard').expect(403); await request(app.getHttpServer()).get('/api/certificates/templates').expect(401);
  const png=await QRCode.toBuffer('sprint4-template',{width:400,margin:1}); const fields={name:{x:5,y:20,size:12},course:{x:5,y:30,size:12},date:{x:5,y:40,size:12},code:{x:5,y:50,size:9},qr:{x:70,y:60,size:20}};
  const payload={name:`Plantilla ${runId}`,imageData:'data:image/png;base64,'+png.toString('base64'),fields};
  await student.client.post('/api/certificates/templates').send(payload).expect(403);
  const template=await admin.client.post('/api/certificates/templates').send(payload).expect(201); templates.push(template.body.id); check(typeof template.body.id==='string','Plantilla creada');
  await admin.client.post('/api/certificates/templates').send({...payload,imageData:'data:image/png;base64,notreal'}).expect(400);
  const manual={courseId:course1.id,studentId:student.id,templateId:template.body.id,manual:true};
  await student.client.post('/api/certificates/issue').send(manual).expect(403);
  const issued=await admin.client.post('/api/certificates/issue').send(manual).expect(201); const cert=issued.body.certificate;
  check(issued.body.emailSent===true && sent.length===1 && sent[0].to===student.email && !!sent[0].mail.attachments?.[0]?.content,'Correo simulado contiene adjunto');
  await admin.client.post('/api/certificates/issue').send(manual).expect(409);
  const verify=await request(app.getHttpServer()).get(`/api/certificates/verify/${cert.code}`).expect(200);
  check(verify.body.status==='VALID' && verify.body.name==='Smoke student' && verify.body.course===course1.title,'Verificación pública válida'); check(!JSON.stringify(verify.body).includes(student.email),'Verificación no publica correo');
  const pdf=await student.client.get(`/api/certificates/${cert.id}/download`).expect(200).expect('Content-Type',/application\/pdf/); check(Buffer.from(pdf.body).subarray(0,5).toString()==='%PDF-','Descarga PDF válida');
  await other.client.get(`/api/certificates/${cert.id}/download`).expect(404);
  const mine=await student.client.get('/api/certificates/mine').expect(200);check(mine.body.some(c=>c.id===cert.id),'Estudiante ve certificado');
  await admin.client.patch(`/api/certificates/${cert.id}/revoke`).expect(200);const revoked=await request(app.getHttpServer()).get(`/api/certificates/verify/${cert.code}`).expect(200);check(revoked.body.status==='REVOKED','Revocación pública');
  await admin.client.put(`/api/certificates/policies/${course2.id}`).send({templateId:template.body.id,requireExam:false,minimumAttendance:100}).expect(200);
  await admin.client.post('/api/certificates/issue').send({courseId:course2.id,studentId:student.id,templateId:template.body.id,manual:false}).expect(400);
  const session=await db.trainingSession.create({data:{courseId:course2.id,title:'Prueba',startsAt:new Date(Date.now()-90000000)}});await db.attendance.create({data:{sessionId:session.id,studentId:student.id}});
  await app.get(CertificatesService).emitAutomatic();const automatic=await db.certificate.findMany({where:{courseId:course2.id}}); check(automatic.length===1 && automatic[0].studentId===student.id,'Emisión automática solo a alumno con asistencia suficiente');
  await app.get(CertificatesService).emitAutomatic();check(await db.certificate.count({where:{courseId:course2.id}})===1,'Proceso automático idempotente');
  await admin.client.put(`/api/certificates/policies/${course3.id}`).send({templateId:template.body.id,requireExam:true,minimumAttendance:0}).expect(200);
  await admin.client.post('/api/certificates/issue').send({courseId:course3.id,studentId:student.id,templateId:template.body.id,manual:false}).expect(400);
  const exam=await db.exam.create({data:{courseId:course3.id,title:'Exam',opensAt:new Date(Date.now()-172800000),closesAt:new Date(Date.now()-86400000),durationMinutes:20,passingScore:60}});
  await db.examAttempt.create({data:{examId:exam.id,studentId:student.id,startedAt:new Date(Date.now()-172800000),deadline:new Date(Date.now()-172000000),submittedAt:new Date(Date.now()-172000000),score:10,maxScore:10,passed:true}});
  await app.get(CertificatesService).emitAutomatic();const examCertificates=await db.certificate.findMany({where:{courseId:course3.id}});check(examCertificates.length===1 && examCertificates[0].studentId===student.id,'Emisión automática exige evaluación aprobada');
  const after=await admin.client.get('/api/dashboard').expect(200);check(after.body.certificates===before.body.certificates+2,'Dashboard cuenta solo certificados válidos');check(after.body.users.STUDENT>=2 && Number.isFinite(after.body.attendanceRate),'Dashboard contiene usuarios y tasa de asistencia');
  console.log(`Sprint 4 smoke OK: ${checks} verificaciones y controles HTTP; PostgreSQL real, PDF, correo simulado, políticas y permisos.`);
 } finally {if(db){if(courses.length){await db.certificate.deleteMany({where:{courseId:{in:courses}}});await db.certificatePolicy.deleteMany({where:{courseId:{in:courses}}});await db.examAttempt.deleteMany({where:{exam:{courseId:{in:courses}}}});await db.exam.deleteMany({where:{courseId:{in:courses}}});await db.attendance.deleteMany({where:{session:{courseId:{in:courses}}}});await db.trainingSession.deleteMany({where:{courseId:{in:courses}}});await db.enrollment.deleteMany({where:{courseId:{in:courses}}});await db.course.deleteMany({where:{id:{in:courses}}});}if(templates.length)await db.certificateTemplate.deleteMany({where:{id:{in:templates}}});if(users.length)await db.user.deleteMany({where:{id:{in:users}}});}if(app)await app.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});

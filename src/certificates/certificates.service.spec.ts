import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { PDFDocument } from 'pdf-lib';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5+kAAAAASUVORK5CYII=';
const fields={name:{x:10,y:10,size:12},course:{x:10,y:20,size:12},date:{x:10,y:30,size:12},code:{x:10,y:40,size:12},qr:{x:10,y:50,size:10}};
describe('CertificatesService',()=>{
 let db:any; let email:any; let service:CertificatesService;
 beforeEach(()=>{
  db={course:{findUnique:jest.fn().mockResolvedValue({id:'c',title:'Curso',endsAt:new Date(0)})},user:{findUnique:jest.fn().mockResolvedValue({id:'s',role:'STUDENT',name:'Ana',email:'a@example.test'})},certificateTemplate:{findUnique:jest.fn().mockResolvedValue({id:'t',imageData:png,fields}),create:jest.fn(),findMany:jest.fn()},enrollment:{findUnique:jest.fn().mockResolvedValue({status:'ENROLLED'})},certificate:{findUnique:jest.fn().mockResolvedValue(null),create:jest.fn().mockImplementation(async({data})=>({id:'cert',...data})),update:jest.fn()},certificatePolicy:{findUnique:jest.fn().mockResolvedValue({requireExam:true,minimumAttendance:50,templateId:'t'})},examAttempt:{findFirst:jest.fn().mockResolvedValue({id:'a'})},trainingSession:{count:jest.fn().mockResolvedValue(2)},attendance:{count:jest.fn().mockResolvedValue(1)}};
  email={send:jest.fn().mockResolvedValue(false)};
  service=new CertificatesService(db as PrismaService,email as EmailService);
 });
 it('rejects invalid template image and placements',async()=>{
  await expect(service.createTemplate({name:'Prueba',imageData:'not image',fields})).rejects.toBeInstanceOf(BadRequestException);
  await expect(service.createTemplate({name:'Prueba',imageData:png,fields:{...fields,qr:{x:95,y:0,size:20}}})).rejects.toBeInstanceOf(BadRequestException);
 });
 it('requires enrollment and prevents duplicate certificates',async()=>{
  db.enrollment.findUnique.mockResolvedValue(null);
  await expect(service.issue({courseId:'c',studentId:'s',templateId:'t',manual:true})).rejects.toBeInstanceOf(BadRequestException);
  db.enrollment.findUnique.mockResolvedValue({status:'ENROLLED'}); db.certificate.findUnique.mockResolvedValue({id:'existing'});
  await expect(service.issue({courseId:'c',studentId:'s',templateId:'t',manual:true})).rejects.toBeInstanceOf(ConflictException);
 });
 it('requires passing exam and minimum attendance when issuing automatically',async()=>{
  db.examAttempt.findFirst.mockResolvedValue(null);
  await expect(service.issue({courseId:'c',studentId:'s',templateId:'t',manual:false})).rejects.toBeInstanceOf(BadRequestException);
  db.examAttempt.findFirst.mockResolvedValue({id:'a'}); db.attendance.count.mockResolvedValue(0);
  await expect(service.issue({courseId:'c',studentId:'s',templateId:'t',manual:false})).rejects.toBeInstanceOf(BadRequestException);
 });
 it('persists valid PDF and does not undo issuance if mail fails',async()=>{
  email.send.mockRejectedValue(new Error('offline'));
  const result=await service.issue({courseId:'c',studentId:'s',templateId:'t',manual:true});
  expect(result.emailSent).toBe(false); expect(result.certificate.code).toHaveLength(32);
  expect((await PDFDocument.load(result.certificate.pdf)).getPageCount()).toBe(1);
  expect(email.send.mock.calls[0][2].attachments[0].name).toBe('certificado.pdf');
 });
 it('does not allow other users to download',async()=>{
  db.certificate.findUnique.mockResolvedValue({studentId:'other',pdf:Buffer.from('data')});
  await expect(service.download({id:'s',role:'STUDENT'} as any,'id')).rejects.toBeInstanceOf(NotFoundException);
 });
});

import { createHash } from 'crypto';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PublicUser } from '../auth/auth.types';

const student = { id: 'student', role: 'STUDENT' } as PublicUser;
const admin = { id: 'admin', role: 'ADMIN' } as PublicUser;
const session = { id: 'session', courseId: 'course', title: 'Clase', startsAt: new Date(), createdAt: new Date(), qrHash: 'hash', qrExpiresAt: new Date(Date.now() + 60000) };
describe('AttendanceService', () => {
  let db: any;
  let service: AttendanceService;
  beforeEach(() => {
    db = { course: { findFirst: jest.fn().mockResolvedValue({id:'course'}) }, trainingSession: { findUnique: jest.fn().mockResolvedValue(session), findUniqueOrThrow: jest.fn().mockResolvedValue(session), update: jest.fn(), create: jest.fn(), findMany: jest.fn().mockResolvedValue([{id:'session'}]) }, enrollment: { findUnique: jest.fn().mockResolvedValue({status:'ENROLLED'}), findMany: jest.fn().mockResolvedValue([{student:{id:'student',name:'Ana',email:'a@example.org'}}]) }, attendance: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), groupBy: jest.fn().mockResolvedValue([{studentId:'student',_count:{_all:1}}]) }, $queryRaw: jest.fn().mockResolvedValue([{id:'session'}]) };
    db.$transaction = (fn: any) => fn(db);
    service = new AttendanceService(db as PrismaService);
  });
  it('rejects inaccessible courses', async () => { db.course.findFirst.mockResolvedValue(null); await expect(service.sessions(admin,'course')).rejects.toBeInstanceOf(NotFoundException); });
  it('rejects expired or unknown QR codes', async () => { db.$queryRaw.mockResolvedValue([]); await expect(service.checkIn(student,'x')).rejects.toBeInstanceOf(BadRequestException); });
  it('rejects non-enrolled students', async () => {
    db.trainingSession.findUniqueOrThrow.mockResolvedValue({...session, qrHash: createHash('sha256').update('x').digest('hex')});
    db.enrollment.findUnique.mockResolvedValue(null);
    await expect(service.checkIn(student,'x')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects duplicate attendance', async () => {
    db.trainingSession.findUniqueOrThrow.mockResolvedValue({...session, qrHash: createHash('sha256').update('x').digest('hex')});
    db.attendance.findUnique.mockResolvedValue({id:'record'});
    await expect(service.checkIn(student,'x')).rejects.toBeInstanceOf(ConflictException);
  });
  it('registers attendance for enrolled students once', async () => {
    db.trainingSession.findUniqueOrThrow.mockResolvedValue({...session, qrHash: createHash('sha256').update('x').digest('hex')});
    await expect(service.checkIn(student,'x')).resolves.toMatchObject({message:'Asistencia registrada'});
    expect(db.attendance.create).toHaveBeenCalledWith({data:{sessionId:'session',studentId:'student'}});
  });
  it('reports attendance percentage', async () => { const report = await service.report(admin,'course'); expect(report.items[0]).toMatchObject({attended:1,totalSessions:1,percentage:100}); });
  it('generates unique secret codes and stores only hash', async () => { const result = await service.qr(admin,'session',15); expect(result.code).toMatch(/^[a-f0-9]{64}$/); expect(db.trainingSession.update.mock.calls[0][0].data.qrHash).not.toEqual(result.code); });
});

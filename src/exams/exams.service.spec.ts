import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ExamService } from './exams.service';
const student:any={id:'s',role:'STUDENT'};
describe('integridad de evaluaciones',()=>{
 let db:any, service:ExamService, exam:any;
 beforeEach(()=>{
  exam={id:'e',courseId:'c',opensAt:new Date(Date.now()-1000),closesAt:new Date(Date.now()+60000),durationMinutes:10,passingScore:50,questions:[{id:'q',text:'Pregunta',type:'SINGLE',points:5,options:[{id:'a',text:'A',isCorrect:true},{id:'b',text:'B',isCorrect:false}]}]};
  db={course:{findUnique:jest.fn().mockResolvedValue({instructors:[],enrollments:[{studentId:'s'}]})},exam:{findUnique:jest.fn().mockResolvedValue(exam)},examAttempt:{findUnique:jest.fn().mockResolvedValue(null),create:jest.fn().mockResolvedValue({id:'attempt',startedAt:new Date(),deadline:new Date(Date.now()+60000)})}};
  service=new ExamService(db);
 });
 it('nunca expone la respuesta correcta al iniciar',async()=>{const result=await service.start(student,'e');expect(result.questions[0].options[0]).toEqual({id:'a',text:'A'});});
 it('impide iniciar fuera de la ventana',async()=>{exam.closesAt=new Date(Date.now()-1);await expect(service.start(student,'e')).rejects.toBeInstanceOf(BadRequestException);});
 it('exige inscripción activa',async()=>{db.course.findUnique.mockResolvedValue({instructors:[],enrollments:[]});await expect(service.start(student,'e')).rejects.toBeInstanceOf(ForbiddenException);});
 it('retoma el intento existente con el plazo original',async()=>{const deadline=new Date(Date.now()+10000);db.examAttempt.findUnique.mockResolvedValue({id:'old',startedAt:new Date(),deadline,submittedAt:null});expect((await service.start(student,'e')).deadline).toEqual(deadline);expect(db.examAttempt.create).not.toHaveBeenCalled();});

 it('rechaza env?os tard?os y evita calificarlos',async()=>{
  const update=jest.fn(); const tx:any={$queryRaw:jest.fn().mockResolvedValue([{id:'attempt'}]),examAttempt:{findUniqueOrThrow:jest.fn().mockResolvedValue({studentId:'s',deadline:new Date(Date.now()-1),submittedAt:null,exam}),update}};
  db.$transaction=async(fn:any)=>fn(tx);
  await expect(service.submit(student,'attempt',{answers:[]})).rejects.toBeInstanceOf(BadRequestException);expect(update).not.toHaveBeenCalled();
 });
 it('impide entregar intentos de otros estudiantes',async()=>{
  const tx:any={$queryRaw:jest.fn().mockResolvedValue([{id:'attempt'}]),examAttempt:{findUniqueOrThrow:jest.fn().mockResolvedValue({studentId:'otro',exam})}}; db.$transaction=async(fn:any)=>fn(tx);
  await expect(service.submit(student,'attempt',{answers:[]})).rejects.toBeInstanceOf(ForbiddenException);
 });
 it('califica y conserva las respuestas recibidas',async()=>{
  const answers=[{questionId:'q',optionIds:['a']}];const update=jest.fn().mockResolvedValue({score:5,passed:true});
  const tx:any={$queryRaw:jest.fn().mockResolvedValue([{id:'attempt'}]),examAttempt:{findUniqueOrThrow:jest.fn().mockResolvedValue({studentId:'s',deadline:new Date(Date.now()+60000),submittedAt:null,exam,maxScore:5}),update}};db.$transaction=async(fn:any)=>fn(tx);
  await expect(service.submit(student,'attempt',{answers})).resolves.toMatchObject({score:5,passed:true});expect(update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({answers,score:5,passed:true})}));
 });
});

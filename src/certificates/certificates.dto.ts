import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
export class TemplateDto {
 @IsString() @MaxLength(120) name: string;
 @IsString() @MaxLength(4000000) imageData: string;
 @IsObject() fields: Record<string, {x:number;y:number;size:number}>;
}
export class IssueDto {
 @IsUUID() courseId: string;
 @IsUUID() studentId: string;
 @IsUUID() templateId: string;
 @IsBoolean() manual: boolean;
}
export class PolicyDto {
 @IsBoolean() requireExam: boolean;
 @IsNumber() @Min(0) @Max(100) minimumAttendance: number;
 @IsUUID() templateId: string;
}

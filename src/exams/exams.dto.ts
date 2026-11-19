import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
export class OptionDto { @IsString() @MaxLength(500) text: string; @IsBoolean() isCorrect: boolean; }
export class QuestionDto {
 @IsString() @MaxLength(1000) text: string;
 @IsIn(['SINGLE','MULTIPLE','TRUE_FALSE']) type: 'SINGLE'|'MULTIPLE'|'TRUE_FALSE';
 @IsNumber() @Min(0.01) @Max(10000) points: number;
 @IsArray() @ArrayMinSize(2) @ValidateNested({each:true}) @Type(() => OptionDto) options: OptionDto[];
}
export class CreateExamDto {
 @IsString() @MaxLength(200) title: string;
 @IsDateString() opensAt: string;
 @IsDateString() closesAt: string;
 @IsInt() @Min(1) @Max(1440) durationMinutes: number;
 @IsNumber() @Min(0) @Max(100) passingScore: number;
 @IsArray() @ArrayMinSize(1) @ValidateNested({each:true}) @Type(() => QuestionDto) questions: QuestionDto[];
}
export class AnswerDto { @IsUUID() questionId: string; @IsArray() @IsUUID('4',{each:true}) optionIds: string[]; }
export class SubmitDto { @IsArray() @ValidateNested({each:true}) @Type(() => AnswerDto) answers: AnswerDto[]; }

import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayUnique, IsArray, IsDateString, IsIn, IsInt, IsNotEmpty,
  IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const present = (_object: unknown, value: unknown) => value !== undefined;

export class PaginationDto {
  @ValidateIf(present)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ValidateIf(present)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class ListCoursesDto extends PaginationDto {
  @ValidateIf(present)
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  q?: string;

  @ValidateIf(present)
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  category?: string;

  @ValidateIf(present)
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

export class CreateCourseDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @MaxLength(180)
  title: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MaxLength(10000)
  description: string;

  @IsIn(['COURSE', 'WORKSHOP', 'CONFERENCE'])
  type: 'COURSE' | 'WORKSHOP' | 'CONFERENCE';

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'La categoría es obligatoria' })
  @MaxLength(100)
  category: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'La sede es obligatoria' })
  @MaxLength(200)
  venue: string;

  @IsDateString()
  @Matches(/T.+(?:Z|[+-]\d{2}:\d{2})$/, { message: 'La fecha de inicio debe incluir zona horaria' })
  startsAt: string;

  @IsDateString()
  @Matches(/T.+(?:Z|[+-]\d{2}:\d{2})$/, { message: 'La fecha de fin debe incluir zona horaria' })
  endsAt: string;

  @IsInt()
  @Min(1)
  @Max(100000)
  capacity: number;

  @ValidateIf(present)
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

  @ValidateIf(present)
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  instructorIds?: string[];
}

// Omitted fields remain unchanged; null is deliberately rejected by validation.
export class UpdateCourseDto extends CreateCourseDto {
  @ValidateIf(present) declare title: string;
  @ValidateIf(present) declare description: string;
  @ValidateIf(present) declare type: 'COURSE' | 'WORKSHOP' | 'CONFERENCE';
  @ValidateIf(present) declare category: string;
  @ValidateIf(present) declare venue: string;
  @ValidateIf(present) declare startsAt: string;
  @ValidateIf(present) declare endsAt: string;
  @ValidateIf(present) declare capacity: number;
}

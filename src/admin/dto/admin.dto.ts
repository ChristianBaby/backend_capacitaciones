import { Transform, Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateInstructorDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(120)
  name: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Correo inválido' })
  email: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone?: string;
}

export class ListUsersQueryDto {
  @IsOptional()
  @IsIn(['ADMIN', 'INSTRUCTOR', 'STUDENT'])
  role?: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';

  @IsOptional()
  @IsIn(['ACTIVE', 'PENDING', 'DISABLED'])
  status?: 'ACTIVE' | 'PENDING' | 'DISABLED';

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class UpdateStatusDto {
  @IsIn(['ACTIVE', 'DISABLED'], { message: 'El estado debe ser ACTIVE o DISABLED' })
  status: 'ACTIVE' | 'DISABLED';
}

import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const normEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class EmailDto {
  @Transform(normEmail)
  @IsEmail({}, { message: 'Correo inválido' })
  email: string;
}

export class RegisterDto extends EmailDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72)
  password: string;
}

export class LoginDto extends EmailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}

export class CodeDto extends EmailDto {
  @Transform(trim)
  @Matches(/^\d{6}$/, { message: 'El código debe tener 6 dígitos' })
  code: string;
}

export class ResendCodeDto extends EmailDto {
  @IsOptional()
  @IsIn(['EMAIL_VERIFY', 'INSTRUCTOR_INVITE', 'PASSWORD_RESET'])
  purpose?: 'EMAIL_VERIFY' | 'INSTRUCTOR_INVITE' | 'PASSWORD_RESET';
}

export class ResetPasswordDto extends CodeDto {
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72)
  newPassword: string;
}

export class ActivateInstructorDto extends ResetPasswordDto {}

export class ChangePasswordDto {
  @IsOptional()
  @IsString()
  @MaxLength(72)
  currentPassword?: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72)
  newPassword: string;
}

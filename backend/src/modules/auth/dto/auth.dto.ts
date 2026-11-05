import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SocialProvider } from '@prisma/client';

const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\S]{8,64}$/;

export class RegisterDto {
  @ApiProperty({ example: 'usuario@agencia.com' })
  @IsEmail({}, { message: 'Debe proporcionar un correo electrónico válido.' })
  @MaxLength(180)
  email!: string;

  @ApiProperty({
    example: 'ClaveSegura2026!',
    description:
      'Mínimo 8 caracteres, al menos 1 mayúscula, 1 minúscula, 1 número y 1 símbolo especial.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(STRONG_PASSWORD_REGEX, {
    message:
      'La contraseña debe tener entre 8 y 64 caracteres e incluir mayúscula, minúscula, número y carácter especial.',
  })
  password!: string;

  @ApiPropertyOptional({ example: 'Valentina' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Gómez' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiProperty({ example: 'Valentina Gómez' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName!: string;

  @ApiPropertyOptional({ example: 'Nova Media Studio' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  agencyName?: string;

  @ApiPropertyOptional({ example: 'America/Argentina/Buenos_Aires' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Valentina Gómez' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName?: string;

  @ApiPropertyOptional({ example: 'America/Argentina/Buenos_Aires' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;
}

export class VerifyRegistrationCodeDto {
  @ApiProperty({ example: 'usuario@agencia.com' })
  @IsEmail({}, { message: 'Ingresá un correo electrónico válido.' })
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(6)
  code!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'agencia.nova@contentsync.io' })
  @IsEmail({}, { message: 'Ingresá un correo electrónico válido.' })
  email!: string;

  @ApiPropertyOptional({ example: 'ClaveSegura2026!' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({ example: 'Pixel 8 Pro - Android 15' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceInfo?: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export class SocialLoginDto {
  @ApiProperty({ enum: SocialProvider, example: SocialProvider.GOOGLE })
  @IsEnum(SocialProvider)
  provider!: SocialProvider;

  @ApiProperty({ description: 'ID Token o Access Token emitido por el proveedor OAuth' })
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  agencyName?: string;

  @ApiPropertyOptional({ example: 'Pixel 8 Pro - Android 15' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceInfo?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'agencia.nova@contentsync.io' })
  @IsEmail({}, { message: 'Ingresá un correo electrónico válido.' })
  email!: string;
}

export class VerifyOtpCodeDto {
  @ApiProperty({ example: 'usuario@gmail.com' })
  @IsEmail({}, { message: 'Ingresá un correo electrónico válido.' })
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(6)
  code!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'usuario@gmail.com' })
  @IsEmail({}, { message: 'Ingresá un correo electrónico válido.' })
  @MaxLength(180)
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(6)
  token!: string;

  @ApiProperty({ example: 'NuevaClaveSegura2026!' })
  @IsString()
  @Matches(STRONG_PASSWORD_REGEX, {
    message:
      'La nueva contraseña debe tener entre 8 y 64 caracteres e incluir mayúscula, minúscula, número y carácter especial.',
  })
  newPassword!: string;
}

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
import { RoleCode, SocialProvider } from '@prisma/client';

const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\S]{8,64}$/;

export class RegisterDto {
  @ApiProperty({ example: 'usuario@agencia.com' })
  @IsEmail({}, { message: 'Debe proporcionar un correo electrónico válido.' })
  @MaxLength(180)
  email!: string;

  @ApiProperty({
    example: 'ContentSync2026!',
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

  @ApiPropertyOptional({ enum: RoleCode, default: RoleCode.AGENCIA })
  @IsOptional()
  @IsEnum(RoleCode)
  role?: RoleCode;

  @ApiPropertyOptional({ example: 'America/Argentina/Buenos_Aires' })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'agencia.nova@contentsync.io' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ContentSync2026!' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiPropertyOptional({ example: 'Pixel 8 Pro - Android 15' })
  @IsOptional()
  @IsString()
  deviceInfo?: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token emitido en el último inicio de sesión o rotación' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class SocialLoginDto {
  @ApiProperty({ enum: SocialProvider, example: SocialProvider.GOOGLE })
  @IsEnum(SocialProvider)
  provider!: SocialProvider;

  @ApiProperty({ description: 'ID Token o Access Token emitido por el proveedor OAuth' })
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  /** Ignorados: la identidad real se obtiene verificando el token ante el proveedor. */
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  providerUserId?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'Pixel 8 Pro - Android 15' })
  @IsOptional()
  @IsString()
  deviceInfo?: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'agencia.nova@contentsync.io' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'NuevaClaveSegura2026!' })
  @IsString()
  @Matches(STRONG_PASSWORD_REGEX, {
    message:
      'La nueva contraseña debe tener entre 8 y 64 caracteres e incluir mayúscula, minúscula, número y carácter especial.',
  })
  newPassword!: string;
}

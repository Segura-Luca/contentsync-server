/** DTO de ajustes: valida los valores permitidos para cada ajuste editable. */
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Todos los campos son opcionales: solo se actualizan los que se envían. */
export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'ContentSync' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  appName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  registrationEnabled?: boolean;

  @ApiPropertyOptional({ example: 'America/Argentina/Buenos_Aires' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  defaultTimezone?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  otpTtlMinutes?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  otpMaxAttempts?: number;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  otpResendCooldownSeconds?: number;

  @ApiPropertyOptional({ example: 168 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2160)
  clientInviteTtlHours?: number;
}

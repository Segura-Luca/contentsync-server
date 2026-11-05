import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PlatformLimitDto {
  @ApiPropertyOptional({ example: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(86400)
  maxDurationSeconds?: number;

  @ApiPropertyOptional({ example: 1024 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(102400)
  maxSizeMb?: number;

  @ApiPropertyOptional({ example: ['video/mp4'] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['video/mp4', 'video/quicktime', 'video/webm'], { each: true })
  allowedMimeTypes?: string[];
}

export class PlatformLimitsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PlatformLimitDto)
  INSTAGRAM?: PlatformLimitDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PlatformLimitDto)
  TIKTOK?: PlatformLimitDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PlatformLimitDto)
  YOUTUBE?: PlatformLimitDto;
}

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

  @ApiPropertyOptional({ description: 'Exigir aprobación del cliente antes de publicar' })
  @IsOptional()
  @IsBoolean()
  requireClientApproval?: boolean;

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

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  publishMaxAttempts?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  publishRetryDelaySeconds?: number;

  @ApiPropertyOptional({ type: PlatformLimitsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PlatformLimitsDto)
  platformLimits?: PlatformLimitsDto;
}

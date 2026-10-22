import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PrivacyLevel, SocialPlatform } from '@prisma/client';

export class RequestPresignedUrlDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiProperty({ example: 'promo_cold_brew.mp4' })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({ example: 'video/mp4' })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiProperty({ example: 28500000 })
  @IsInt()
  @Min(1024)
  sizeBytes!: number;

  @ApiProperty({ example: 45 })
  @IsInt()
  @Min(3)
  @Max(900)
  durationSeconds!: number;

  @ApiProperty({ enum: SocialPlatform, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(SocialPlatform, { each: true })
  targetPlatforms!: SocialPlatform[];
}

export class PlatformTargetInputDto {
  @ApiProperty({ enum: SocialPlatform })
  @IsEnum(SocialPlatform)
  platform!: SocialPlatform;

  @ApiPropertyOptional({ example: 'Título adaptado para YouTube Shorts' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  customTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customDescription?: string;

  @ApiPropertyOptional({ enum: PrivacyLevel, default: PrivacyLevel.PUBLIC })
  @IsOptional()
  @IsEnum(PrivacyLevel)
  privacyLevel?: PrivacyLevel;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  shareToFeed?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowDuetStitch?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  madeForKids?: boolean;
}

export class CreateVideoDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiProperty({ example: 'Receta Cold Brew en 45 segundos' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @ApiProperty({ example: 'Descubre nuestro proceso de infusión en frío.' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ example: 'clients/uuid/17296_cold_brew.mp4' })
  @IsString()
  @IsNotEmpty()
  storageKey!: string;

  @ApiPropertyOptional({ example: 'clients/uuid/17296_thumb.jpg' })
  @IsOptional()
  @IsString()
  thumbnailKey?: string;

  @ApiProperty({ example: 45 })
  @IsInt()
  @Min(3)
  @Max(900)
  durationSeconds!: number;

  @ApiProperty({ example: 28500000 })
  @IsInt()
  @Min(1024)
  sizeBytes!: number;

  @ApiProperty({ example: 'video/mp4' })
  @IsString()
  mimeType!: string;

  @ApiPropertyOptional({ example: '9:16', default: '9:16' })
  @IsOptional()
  @IsString()
  aspectRatio?: string;

  @ApiProperty({ type: [String], example: ['coldbrew', 'cafe', 'reels'] })
  @IsArray()
  @IsString({ each: true })
  hashtags!: string[];

  @ApiProperty({ type: [PlatformTargetInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PlatformTargetInputDto)
  platformTargets!: PlatformTargetInputDto[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApprovalDecision, SocialPlatform } from '@prisma/client';

export class CreateScheduleDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiProperty({ example: '2026-11-02' })
  @IsDateString()
  weekStartDate!: string;

  @ApiProperty({ example: '2026-11-06' })
  @IsDateString()
  weekEndDate!: string;

  @ApiProperty({ example: 'Semana Lanzamiento Cold Brew Primavera' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @ApiPropertyOptional({ example: 'Foco en Reels educativos y detrás de escena.' })
  @IsOptional()
  @IsString()
  summaryNotes?: string;
}

export class InlineBlockVideoDto {
  @ApiProperty({ example: '/uploads/videos/reel_lunes.mp4' })
  @IsString()
  @IsNotEmpty()
  storageKey!: string;

  @ApiProperty({ example: 'Reel Educativo Espresso' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @ApiProperty({ example: 'Paso a paso para calibrar espresso en 30 segundos.' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ type: [String], example: ['cafe', 'barista', 'reels'] })
  @IsArray()
  @IsString({ each: true })
  hashtags!: string[];

  @ApiProperty({ enum: SocialPlatform, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(SocialPlatform, { each: true })
  platforms!: SocialPlatform[];

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(900)
  durationSeconds?: number;

  @ApiPropertyOptional({ default: 15000000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  sizeBytes?: number;

  @ApiPropertyOptional({ default: 'video/mp4' })
  @IsOptional()
  @IsString()
  mimeType?: string;

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

export class CreateScheduleBlockDto {
  @ApiProperty({ example: 1, description: 'Día de la semana: 1 (Lunes) a 5 (Viernes)' })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @ApiProperty({ example: 'Reel Educativo: 3 errores al moler café' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  blockTitle!: string;

  @ApiPropertyOptional({ example: 'AMBER' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  noteColor?: string;

  @ApiPropertyOptional({
    example: 'Mostrar comparativa de molienda gruesa vs fina y cerrar con CTA a tienda.',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '18:30' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'La hora debe tener formato HH:mm' })
  plannedTime?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  autoPublish?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  videoId?: string;

  @ApiPropertyOptional({ type: InlineBlockVideoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InlineBlockVideoDto)
  inlineVideo?: InlineBlockVideoDto;
}

export class UpdateScheduleBlockDto {
  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  blockTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  noteColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '19:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'La hora debe tener formato HH:mm' })
  plannedTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoPublish?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  removeVideo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  videoId?: string;

  @ApiPropertyOptional({ type: InlineBlockVideoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InlineBlockVideoDto)
  inlineVideo?: InlineBlockVideoDto;
}

export class DuplicateScheduleDto {
  @ApiProperty({ example: '2026-11-09' })
  @IsDateString()
  targetWeekStartDate!: string;

  @ApiPropertyOptional({ example: 'Semana Lanzamiento Cold Brew (Semana 2)' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  includeVideos?: boolean;

  @ApiPropertyOptional({ example: 'Duplicado manteniendo estructura de bloques Lunes-Viernes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AddScheduleItemDto {
  @ApiProperty()
  @IsUUID()
  videoId!: string;

  @ApiProperty({ example: 3, description: 'Día de la semana: 1 (Lunes) a 7 (Domingo)' })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @ApiProperty({ example: '2026-10-23T18:00:00.000Z' })
  @IsDateString()
  plannedPublishAt!: string;

  @ApiPropertyOptional({ example: 'Publicar en horario pico de la tarde.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ReviewVideoDecisionDto {
  @ApiProperty({
    enum: ApprovalDecision,
    description: 'APPROVED | CHANGES_REQUESTED | REJECTED',
  })
  @IsEnum(ApprovalDecision)
  decision!: ApprovalDecision;

  @ApiPropertyOptional({
    example: 'Excelente edición, aprobado para salir en las 3 plataformas.',
  })
  @IsOptional()
  @IsString()
  feedbackNotes?: string;
}

export class AddVideoCommentDto {
  @ApiProperty({ example: '¿Podemos ajustar el subtítulo en el segundo 12?' })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  @Min(0)
  timestampSec?: number;
}

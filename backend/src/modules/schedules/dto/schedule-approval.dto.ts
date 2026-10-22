import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApprovalDecision } from '@prisma/client';

export class CreateScheduleDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiProperty({ example: '2026-10-19' })
  @IsDateString()
  weekStartDate!: string;

  @ApiProperty({ example: '2026-10-25' })
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

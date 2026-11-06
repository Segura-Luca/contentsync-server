import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
import { ApprovalDecision, ContentType, ProductionStatus } from '@prisma/client';

export const MAX_MEDIA_PER_BLOCK = 20;

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

  @ApiProperty({ example: 'Semana de lanzamiento Cold Brew' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @ApiPropertyOptional({ example: 'Foco en reels educativos y detrás de escena.' })
  @IsOptional()
  @IsString()
  summaryNotes?: string;
}

export class BlockMediaInputDto {
  @ApiProperty({ description: 'Clave devuelta por POST /media/upload' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  storageKey!: string;

  @ApiPropertyOptional({ example: 'Primera imagen: el producto en primer plano.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  originalName?: string;
}

export class CreateScheduleBlockDto {
  @ApiProperty({ example: 1, description: 'Día de la semana: 1 (lunes) a 7 (domingo)' })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @ApiProperty({ enum: ContentType, example: ContentType.REEL })
  @IsEnum(ContentType)
  contentType!: ContentType;

  @ApiProperty({ example: '3 errores al moler café' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  blockTitle!: string;

  @ApiPropertyOptional({ example: 'AMBER' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  noteColor?: string;

  @ApiPropertyOptional({ description: 'De qué trata el contenido' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Texto que acompañará a la publicación' })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional({ enum: ProductionStatus })
  @IsOptional()
  @IsEnum(ProductionStatus)
  productionStatus?: ProductionStatus;

  @ApiPropertyOptional({ example: '18:30' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'La hora debe tener formato HH:mm' })
  plannedTime?: string;

  @ApiPropertyOptional({ type: [BlockMediaInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_MEDIA_PER_BLOCK)
  @ValidateNested({ each: true })
  @Type(() => BlockMediaInputDto)
  media?: BlockMediaInputDto[];
}

export class UpdateScheduleBlockDto {
  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number;

  @ApiPropertyOptional({ enum: ContentType })
  @IsOptional()
  @IsEnum(ContentType)
  contentType?: ContentType;

  @ApiPropertyOptional({ enum: ProductionStatus })
  @IsOptional()
  @IsEnum(ProductionStatus)
  productionStatus?: ProductionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'La hora debe tener formato HH:mm' })
  plannedTime?: string;

  @ApiPropertyOptional({ type: [BlockMediaInputDto], description: 'Si se envía, reemplaza la lista completa' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_MEDIA_PER_BLOCK)
  @ValidateNested({ each: true })
  @Type(() => BlockMediaInputDto)
  media?: BlockMediaInputDto[];
}

export class DuplicateScheduleDto {
  @ApiProperty({ example: '2026-11-09', description: 'Lunes de la semana destino' })
  @IsDateString()
  targetWeekStartDate!: string;

  @ApiPropertyOptional({ example: 'Semana 2' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional({ default: false, description: 'Copiar también las fotos y los videos' })
  @IsOptional()
  @IsBoolean()
  includeMedia?: boolean;

}

export class ReviewBlockDto {
  @ApiProperty({ enum: ApprovalDecision })
  @IsEnum(ApprovalDecision)
  decision!: ApprovalDecision;

  @ApiPropertyOptional({ example: 'Cambiar el texto de la portada.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedbackNotes?: string;
}

export class AddBlockCommentDto {
  @ApiProperty({ example: '¿Podemos usar la otra foto?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message!: string;
}

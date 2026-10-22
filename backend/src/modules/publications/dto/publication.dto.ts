import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PublicationStatus, SocialPlatform } from '@prisma/client';

export class ScheduleOrPublishVideoDto {
  @ApiProperty()
  @IsUUID()
  videoId!: string;

  @ApiPropertyOptional({
    example: '2026-10-24T18:00:00.000Z',
    description:
      'Fecha y hora programada en ISO-8601. Si se omite o es menor/igual a ahora, publica inmediatamente en las 3 plataformas.',
  })
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @ApiPropertyOptional({ example: 'America/Argentina/Buenos_Aires' })
  @IsOptional()
  @IsString()
  userTimezone?: string;
}

export class HistoryFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ enum: SocialPlatform })
  @IsOptional()
  @IsEnum(SocialPlatform)
  platform?: SocialPlatform;

  @ApiPropertyOptional({ enum: PublicationStatus })
  @IsOptional()
  @IsEnum(PublicationStatus)
  status?: PublicationStatus;

  @ApiPropertyOptional({ example: '2026-10-12' })
  @IsOptional()
  @IsDateString()
  weekStartDate?: string;

  @ApiPropertyOptional({ example: 'Cold Brew' })
  @IsOptional()
  @IsString()
  search?: string;
}

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateIdeaSectionDto {
  @ApiProperty({ example: 'Entretenimiento' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'ROSE' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agencyId?: string;
}

export class UpdateIdeaSectionDto extends PartialType(CreateIdeaSectionDto) {}

export class CreateContentIdeaDto {
  @ApiProperty()
  @IsUUID()
  sectionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiProperty({ example: '3 mitos sobre el café de especialidad que todos creen' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title!: string;

  @ApiProperty({
    example:
      'Gancho visual rompiendo cápsula comercial. Mostrar comparativa de tueste y cerrar con pregunta.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({ example: 'https://www.instagram.com/reel/ejemplo' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  referenceUrl?: string;

  @ApiPropertyOptional({ example: 'INSTAGRAM,TIKTOK,YOUTUBE' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  platforms?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agencyId?: string;
}

export class UpdateContentIdeaDto extends PartialType(CreateContentIdeaDto) {}

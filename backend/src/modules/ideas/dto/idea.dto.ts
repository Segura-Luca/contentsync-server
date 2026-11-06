import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateIdeaSectionDto {
  @ApiProperty({ example: 'Entretenimiento' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: '#E85D75' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^(#[0-9a-fA-F]{6}|[A-Za-z]+)$/, { message: 'Elegí un color válido.' })
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
  // Solo http(s): el enlace se muestra como <a href>, y un "javascript:" se ejecutaría al abrirlo.
  @Matches(/^(https?:\/\/\S+)?$/i, { message: 'El enlace de referencia debe comenzar con http:// o https://.' })
  referenceUrl?: string;


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

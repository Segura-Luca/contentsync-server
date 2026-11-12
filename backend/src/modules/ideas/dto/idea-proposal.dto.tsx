/** DTO de propuestas de ideas: lo que envía el cliente y lo que decide la agencia al aceptar. */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

// Solo enlaces http(s), o vacío: evita enlaces peligrosos como "javascript:".
const HTTP_URL = /^(https?:\/\/\S+)?$/i;
const HTTP_URL_MESSAGE = 'El enlace de referencia debe comenzar con http:// o https://.';

/** Propuesta del cliente: título, desarrollo y enlace opcional. */
export class CreateIdeaProposalDto {
  @ApiProperty({ example: 'Mostrar cómo tostamos el café' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title!: string;

  @ApiProperty({ example: 'Un reel corto desde la tostadora, un sábado a la mañana.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;

  @ApiPropertyOptional({ example: 'https://www.instagram.com/reel/ejemplo' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(HTTP_URL, { message: HTTP_URL_MESSAGE })
  referenceUrl?: string;
}

/** La agencia elige dónde guardarla y, si quiere, la ajusta antes de aceptarla. */
export class AcceptIdeaProposalDto {
  @ApiProperty()
  @IsUUID()
  sectionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(HTTP_URL, { message: HTTP_URL_MESSAGE })
  referenceUrl?: string;
}

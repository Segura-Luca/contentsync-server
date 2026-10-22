import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAgencyDto {
  @ApiProperty({ example: 'Nova Digital Marketing' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: '30-71548921-9' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  taxId!: string;

  @ApiProperty({ example: 'agencia.nova@contentsync.io' })
  @IsEmail()
  ownerEmail!: string;

  @ApiProperty({ example: 'Lucas Herrera' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  ownerFullName!: string;

  @ApiProperty({ example: 'ContentSync2026!' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\S]{8,64}$/, {
    message: 'La contraseña inicial debe cumplir la política de seguridad fuerte.',
  })
  ownerPassword!: string;

  @ApiPropertyOptional({ example: '+54 11 4890-1122' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'https://novadigital.example.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;
}

export class UpdateAgencyDto extends PartialType(CreateAgencyDto) {
  @ApiPropertyOptional({ description: 'Suspender o reactivar agencia' })
  @IsOptional()
  @IsBoolean()
  isSuspended?: boolean;
}

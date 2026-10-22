import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateClientDto {
  @ApiProperty({ example: 'Kafecito Roasters S.A.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  companyName!: string;

  @ApiPropertyOptional({ example: 'Gastronomía & Café' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiProperty({ example: 'cliente.kafecito@contentsync.io' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Martín Rossi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName!: string;

  @ApiProperty({ example: 'ContentSync2026!' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\S]{8,64}$/, {
    message: 'La contraseña debe cumplir la política de contraseña fuerte.',
  })
  password!: string;

  @ApiPropertyOptional({
    description:
      'Solo requerido cuando un ADMIN_GENERAL crea un cliente para una agencia específica.',
  })
  @IsOptional()
  @IsUUID()
  agencyId?: string;
}

export class UpdateClientDto extends PartialType(CreateClientDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** DTO de clientes: datos para invitar, editar y confirmar la identidad. */
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Datos de la marca y de la persona de contacto. La contraseña la crea después el propio cliente. */
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
  @MaxLength(180)
  email!: string;

  @ApiProperty({ example: 'Martín Rossi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName!: string;

  @ApiPropertyOptional({
    description:
      'Solo requerido cuando un ADMIN_GENERAL crea un cliente para una agencia específica.',
  })
  @IsOptional()
  @IsUUID()
  agencyId?: string;
}

/** Igual que crear, con todos los campos opcionales, más el estado activo. */
export class UpdateClientDto extends PartialType(CreateClientDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Decisión del cliente: aceptar o rechazar. */
export class ConfirmClientIdentityDto {
  @ApiProperty({ example: 'ACCEPT', enum: ['ACCEPT', 'REJECT'] })
  @IsString()
  @IsIn(['ACCEPT', 'REJECT'])
  decision!: 'ACCEPT' | 'REJECT';
}

/** La misma decisión, acompañada del token del enlace del correo. */
export class ConfirmInvitationByTokenDto extends ConfirmClientIdentityDto {
  @ApiProperty({ description: 'Token del enlace recibido por correo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token!: string;
}

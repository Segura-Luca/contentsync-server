import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Response } from 'express';
import {
  AuthenticatedUser,
  CurrentUser,
  Public,
  Roles,
} from '../../common/decorators/auth.decorators';
import { ClientsService } from './clients.service';
import {
  ConfirmClientIdentityDto,
  CreateClientDto,
  UpdateClientDto,
} from './dto/client.dto';

@ApiTags('Clientes (Multi-tenant y Confirmación "Sí, soy yo")')
@ApiBearerAuth('jwt-auth')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Public()
  @Get('confirm-invitation')
  @ApiOperation({
    summary:
      'Confirmar ("Sí, soy yo") o rechazar vinculación de cliente desde el enlace de seguridad enviado al email',
  })
  async confirmFromEmail(
    @Query('token') token: string,
    @Query('decision') decision: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.clientsService.confirmIdentityByToken(
        token,
        decision || 'accept',
      );
      const flag = result.status === 'CONFIRMED' ? 'confirmed' : 'rejected';
      return res.redirect(
        `/?invitation=${flag}&company=${encodeURIComponent(result.companyName)}`,
      );
    } catch {
      return res.redirect('/?invitation=invalid');
    }
  }

  @Get('pending-confirmation')
  @ApiOperation({
    summary:
      'Consultar si el usuario actual posee una solicitud de vinculación de agencia pendiente de presionar "Sí, soy yo"',
  })
  getMyPendingConfirmation(@CurrentUser() user: AuthenticatedUser) {
    return this.clientsService.getMyPendingConfirmation(user);
  }

  @Get()
  @ApiOperation({
    summary:
      'Listar clientes según alcance del rol (Admin: todos, Agencia: solo los propios, Cliente: su perfil)',
  })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.clientsService.findAllForUser(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un cliente validando propiedad del recurso' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.assertClientAccess(id, user);
  }

  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Post()
  @ApiOperation({
    summary:
      'Solicitar alta de nuevo cliente bajo la agencia actual (requiere confirmación "Sí, soy yo" del cliente)',
  })
  create(@Body() dto: CreateClientDto, @CurrentUser() user: AuthenticatedUser) {
    return this.clientsService.create(dto, user);
  }

  @Post(':id/confirm-identity')
  @ApiOperation({
    summary:
      'Confirmar ("Sí, soy yo") o rechazar la vinculación desde la notificación interna de la aplicación',
  })
  confirmIdentityInApp(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmClientIdentityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.confirmIdentityInApp(id, dto, user);
  }

  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Post(':id/resend-confirmation')
  @ApiOperation({
    summary: 'Reenviar notificación y correo "Sí, soy yo" a un cliente pendiente',
  })
  resendConfirmation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.resendConfirmation(id, user);
  }

  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Patch(':id')
  @ApiOperation({ summary: 'Editar un cliente propio' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.update(id, dto, user);
  }

  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar lógicamente un cliente propio' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.softDelete(id, user);
  }
}

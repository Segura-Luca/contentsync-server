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
import { AuthThrottle } from '../../common/decorators/auth-throttle.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
  Public,
  Roles,
} from '../../common/decorators/auth.decorators';
import { ClientsService } from './clients.service';
import {
  ConfirmClientIdentityDto,
  ConfirmInvitationByTokenDto,
  CreateClientDto,
  UpdateClientDto,
} from './dto/client.dto';

@ApiTags('Clientes (Multi-tenant y Confirmación "Sí, soy yo")')
@ApiBearerAuth('jwt-auth')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  /**
   * El enlace del correo solo lleva a una pantalla de confirmación. Si este GET confirmara por sí mismo,
   * los escáneres de correo que abren los enlaces aceptarían la vinculación sin que la persona decida nada.
   */
  @Public()
  @Get('confirm-invitation')
  @ApiOperation({ summary: 'Abrir la pantalla de confirmación "Sí, soy yo" desde el enlace enviado al email' })
  openInvitation(
    @Query('token') token: string,
    @Query('decision') decision: string,
    @Res() res: Response,
  ) {
    const params = new URLSearchParams({
      invitation_token: token || '',
      decision: decision === 'reject' ? 'reject' : 'accept',
    });
    return res.redirect(`/?${params.toString()}`);
  }

  @Public()
  @AuthThrottle()
  @Post('confirm-invitation')
  @ApiOperation({ summary: 'Confirmar ("Sí, soy yo") o rechazar la vinculación con el token del correo' })
  confirmInvitation(@Body() dto: ConfirmInvitationByTokenDto) {
    return this.clientsService.confirmIdentityByToken(dto.token, dto.decision);
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

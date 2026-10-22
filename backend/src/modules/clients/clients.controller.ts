import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import {
  AuthenticatedUser,
  CurrentUser,
  Roles,
} from '../../common/decorators/auth.decorators';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';

@ApiTags('Clientes (Multi-tenant por Rol)')
@ApiBearerAuth('jwt-auth')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

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
  @ApiOperation({ summary: 'Crear nuevo cliente bajo la agencia actual' })
  create(@Body() dto: CreateClientDto, @CurrentUser() user: AuthenticatedUser) {
    return this.clientsService.create(dto, user);
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

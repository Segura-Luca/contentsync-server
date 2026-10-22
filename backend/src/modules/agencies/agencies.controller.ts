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
import { AgenciesService } from './agencies.service';
import { CreateAgencyDto, UpdateAgencyDto } from './dto/agency.dto';

@ApiTags('Agencias (Solo ADMIN_GENERAL)')
@ApiBearerAuth('jwt-auth')
@Roles(RoleCode.ADMIN_GENERAL)
@Controller('agencies')
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las agencias activas y suspendidas' })
  findAll() {
    return this.agenciesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de una agencia y sus clientes' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.agenciesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva agencia junto con su usuario propietario' })
  create(@Body() dto: CreateAgencyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.agenciesService.create(dto, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar o suspender/reactivar una agencia' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgencyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agenciesService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar lógicamente una agencia' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.agenciesService.softDelete(id, user.sub);
  }
}

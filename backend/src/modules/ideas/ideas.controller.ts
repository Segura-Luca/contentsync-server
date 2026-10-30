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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import {
  AuthenticatedUser,
  CurrentUser,
  Roles,
} from '../../common/decorators/auth.decorators';
import {
  CreateContentIdeaDto,
  CreateIdeaSectionDto,
  UpdateContentIdeaDto,
  UpdateIdeaSectionDto,
} from './dto/idea.dto';
import { IdeasService } from './ideas.service';

@ApiTags('Ideas de Contenido (Privadas de Agencia)')
@ApiBearerAuth('jwt-auth')
@Roles(RoleCode.AGENCIA, RoleCode.ADMIN_GENERAL)
@Controller('ideas')
export class IdeasController {
  constructor(private readonly ideasService: IdeasService) {}

  @Get('sections')
  @ApiOperation({
    summary:
      'Listar secciones privadas de ideas de la agencia (ej. Entretenimiento, Educativo, Venta)',
  })
  @ApiQuery({ name: 'agencyId', required: false })
  listSections(
    @CurrentUser() user: AuthenticatedUser,
    @Query('agencyId') agencyId?: string,
  ) {
    return this.ideasService.listSections(user, agencyId);
  }

  @Post('sections')
  @ApiOperation({ summary: 'Crear nueva sección personalizada de ideas' })
  createSection(
    @Body() dto: CreateIdeaSectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ideasService.createSection(dto, user);
  }

  @Patch('sections/:id')
  @ApiOperation({ summary: 'Renombrar o cambiar color de una sección de ideas' })
  updateSection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIdeaSectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ideasService.updateSection(id, dto, user);
  }

  @Delete('sections/:id')
  @ApiOperation({ summary: 'Eliminar una sección de ideas y su contenido' })
  deleteSection(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ideasService.deleteSection(id, user);
  }

  @Get()
  @ApiOperation({
    summary:
      'Listar y filtrar ideas privadas de contenido por sección, cliente o texto',
  })
  @ApiQuery({ name: 'agencyId', required: false })
  @ApiQuery({ name: 'sectionId', required: false })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'search', required: false })
  listIdeas(
    @CurrentUser() user: AuthenticatedUser,
    @Query('agencyId') agencyId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('clientId') clientId?: string,
    @Query('search') search?: string,
  ) {
    return this.ideasService.listIdeas(user, {
      agencyId,
      sectionId,
      clientId,
      search,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Guardar nueva idea privada de contenido' })
  createIdea(
    @Body() dto: CreateContentIdeaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ideasService.createIdea(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar o fijar una idea privada de contenido' })
  updateIdea(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContentIdeaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ideasService.updateIdea(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una idea de contenido' })
  deleteIdea(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ideasService.deleteIdea(id, user);
  }
}

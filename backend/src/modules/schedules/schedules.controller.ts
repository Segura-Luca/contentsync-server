/** Rutas HTTP de cronogramas (/api/v1/schedules). Los permisos por rol se validan en SchedulesService. */
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
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/auth.decorators';
import {
  AddBlockCommentDto,
  CreateScheduleBlockDto,
  CreateScheduleDto,
  DuplicateScheduleDto,
  ReviewBlockDto,
  UpdateScheduleBlockDto,
} from './dto/schedule-approval.dto';
import { SchedulesService } from './schedules.service';

@ApiTags('Cronogramas y revisión')
@ApiBearerAuth('jwt-auth')
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar cronogramas con sus bloques, fotos, videos, revisiones y comentarios' })
  @ApiQuery({ name: 'clientId', required: false })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('clientId') clientId?: string) {
    return this.schedulesService.listSchedules(user, clientId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un cronograma semanal (lunes a domingo) para un cliente confirmado' })
  create(@Body() dto: CreateScheduleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.schedulesService.createSchedule(dto, user);
  }

  @Post(':scheduleId/blocks')
  @ApiOperation({ summary: 'Agregar un bloque de contenido con su tipo, texto, fotos y videos' })
  createBlock(
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: CreateScheduleBlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedulesService.createBlock(scheduleId, dto, user);
  }

  @Patch('blocks/:blockId')
  @ApiOperation({ summary: 'Editar un bloque. Si cambia lo que ve el cliente, vuelve a revisión' })
  updateBlock(
    @Param('blockId', ParseUUIDPipe) blockId: string,
    @Body() dto: UpdateScheduleBlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedulesService.updateBlock(blockId, dto, user);
  }

  @Delete('blocks/:blockId')
  @ApiOperation({ summary: 'Eliminar un bloque y sus archivos' })
  deleteBlock(@Param('blockId', ParseUUIDPipe) blockId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.schedulesService.deleteBlock(blockId, user);
  }

  @Post(':scheduleId/duplicate')
  @ApiOperation({ summary: 'Duplicar una semana, con o sin sus fotos y videos' })
  duplicate(
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: DuplicateScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedulesService.duplicateSchedule(scheduleId, dto, user);
  }

  @Post(':scheduleId/confirm')
  @ApiOperation({ summary: 'Confirmar la semana completa (cliente)' })
  confirm(@Param('scheduleId', ParseUUIDPipe) scheduleId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.schedulesService.confirmSchedule(scheduleId, user);
  }

  @Post('blocks/:blockId/resubmit')
  @ApiOperation({ summary: 'Reenviar a revisión un bloque con cambios pedidos (agencia)' })
  resubmit(@Param('blockId', ParseUUIDPipe) blockId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.schedulesService.resubmitBlock(blockId, user);
  }

  @Post('blocks/:blockId/review')
  @ApiOperation({ summary: 'Aprobar, pedir cambios o rechazar un bloque (cliente)' })
  review(
    @Param('blockId', ParseUUIDPipe) blockId: string,
    @Body() dto: ReviewBlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedulesService.reviewBlock(blockId, dto, user);
  }

  @Post('blocks/:blockId/comments')
  @ApiOperation({ summary: 'Dejar un comentario en un bloque' })
  addComment(
    @Param('blockId', ParseUUIDPipe) blockId: string,
    @Body() dto: AddBlockCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedulesService.addComment(blockId, dto, user);
  }
}

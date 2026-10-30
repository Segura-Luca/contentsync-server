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
  AddScheduleItemDto,
  AddVideoCommentDto,
  CreateScheduleBlockDto,
  CreateScheduleDto,
  DuplicateScheduleDto,
  ReviewVideoDecisionDto,
  UpdateScheduleBlockDto,
} from './dto/schedule-approval.dto';
import { SchedulesService } from './schedules.service';

@ApiTags('Plan Semanal (Lunes a Viernes), Bloques y Duplicación')
@ApiBearerAuth('jwt-auth')
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  @ApiOperation({
    summary:
      'Listar planes semanales de Lunes a Viernes con sus bloques de colores y videos según el rol del usuario',
  })
  @ApiQuery({ name: 'clientId', required: false })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clientId') clientId?: string,
  ) {
    return this.schedulesService.listSchedules(user, clientId);
  }

  @Get('duplication-logs')
  @ApiOperation({
    summary: 'Consultar el registro histórico de semanas duplicadas',
  })
  @ApiQuery({ name: 'clientId', required: false })
  listDuplicationLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clientId') clientId?: string,
  ) {
    return this.schedulesService.listDuplicationLogs(user, clientId);
  }

  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Post()
  @ApiOperation({ summary: 'Crear nuevo plan semanal (Lunes a Viernes) para un cliente confirmado' })
  create(@Body() dto: CreateScheduleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.schedulesService.createSchedule(dto, user);
  }

  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Post(':scheduleId/blocks')
  @ApiOperation({
    summary:
      'Agregar un bloque con nota de color, horario y video opcional configurado a un día de la semana',
  })
  createBlock(
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: CreateScheduleBlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedulesService.createBlock(scheduleId, dto, user);
  }

  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Patch('blocks/:blockId')
  @ApiOperation({
    summary: 'Editar bloque del día (color, nota, horario o video configurado)',
  })
  updateBlock(
    @Param('blockId', ParseUUIDPipe) blockId: string,
    @Body() dto: UpdateScheduleBlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedulesService.updateBlock(blockId, dto, user);
  }

  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Delete('blocks/:blockId')
  @ApiOperation({ summary: 'Eliminar un bloque del plan semanal' })
  deleteBlock(
    @Param('blockId', ParseUUIDPipe) blockId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedulesService.deleteBlock(blockId, user);
  }

  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Post(':scheduleId/duplicate')
  @ApiOperation({
    summary:
      'Duplicar una semana completa hacia otra fecha dejando constancia en el registro de duplicaciones',
  })
  duplicateSchedule(
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: DuplicateScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedulesService.duplicateSchedule(scheduleId, dto, user);
  }

  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Post(':scheduleId/items')
  @ApiOperation({
    summary: 'Asignar un video existente a un día/hora del cronograma semanal',
  })
  addItem(
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: AddScheduleItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedulesService.addItemAndSubmitForReview(scheduleId, dto, user);
  }

  @Post('videos/:videoId/review')
  @ApiOperation({
    summary:
      'Revisar video (Cliente o Admin): APROBAR, PEDIR CAMBIOS o RECHAZAR dejando notas',
  })
  reviewVideo(
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @Body() dto: ReviewVideoDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedulesService.reviewVideo(videoId, dto, user);
  }

  @Post('videos/:videoId/comments')
  @ApiOperation({ summary: 'Agregar nota o comentario con marca de tiempo en el video' })
  addComment(
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @Body() dto: AddVideoCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schedulesService.addComment(videoId, dto, user);
  }
}

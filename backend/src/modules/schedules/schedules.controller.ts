import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  CreateScheduleDto,
  ReviewVideoDecisionDto,
} from './dto/schedule-approval.dto';
import { SchedulesService } from './schedules.service';

@ApiTags('Cronogramas Semanales y Aprobaciones de Cliente')
@ApiBearerAuth('jwt-auth')
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  @ApiOperation({
    summary:
      'Listar cronogramas semanales con sus ítems por día y plataforma según el rol del usuario',
  })
  @ApiQuery({ name: 'clientId', required: false })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clientId') clientId?: string,
  ) {
    return this.schedulesService.listSchedules(user, clientId);
  }

  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Post()
  @ApiOperation({ summary: 'Crear cronograma semanal de contenido para un cliente' })
  create(@Body() dto: CreateScheduleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.schedulesService.createSchedule(dto, user);
  }

  @Roles(RoleCode.ADMIN_GENERAL, RoleCode.AGENCIA)
  @Post(':scheduleId/items')
  @ApiOperation({
    summary:
      'Asignar un video a un día/hora del cronograma semanal y enviarlo a revisión del cliente',
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

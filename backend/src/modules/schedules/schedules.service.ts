import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalDecision,
  NotificationType,
  RoleCode,
  ScheduleStatus,
  VideoWorkflowStatus,
} from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ClientsService } from '../clients/clients.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VideosService } from '../videos/videos.service';
import {
  AddScheduleItemDto,
  AddVideoCommentDto,
  CreateScheduleDto,
  ReviewVideoDecisionDto,
} from './dto/schedule-approval.dto';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
    private readonly videosService: VideosService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async createSchedule(dto: CreateScheduleDto, user: AuthenticatedUser) {
    if (user.role === RoleCode.CLIENTE) {
      throw new ForbiddenException('Solo la agencia o el administrador pueden crear cronogramas.');
    }

    const client = await this.clientsService.assertClientAccess(dto.clientId, user);
    const startDate = new Date(dto.weekStartDate);
    const endDate = new Date(dto.weekEndDate);

    if (endDate < startDate) {
      throw new BadRequestException(
        'La fecha de fin de semana no puede ser anterior a la fecha de inicio.',
      );
    }

    const existing = await this.prisma.schedule.findUnique({
      where: {
        clientId_weekStartDate: {
          clientId: dto.clientId,
          weekStartDate: startDate,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        'Ya existe un cronograma semanal para este cliente en esa semana.',
      );
    }

    const schedule = await this.prisma.schedule.create({
      data: {
        clientId: dto.clientId,
        createdByUserId: user.sub,
        weekStartDate: startDate,
        weekEndDate: endDate,
        title: dto.title.trim(),
        summaryNotes: dto.summaryNotes ?? null,
        status: ScheduleStatus.IN_REVIEW,
      },
      include: {
        client: { select: { id: true, companyName: true, userId: true } },
        items: true,
      },
    });

    await this.notificationsService.notifyUser({
      userId: client.userId,
      type: NotificationType.NEW_SCHEDULE,
      title: 'Nuevo cronograma semanal disponible',
      body: `Tu agencia publicó el cronograma "${schedule.title}" para revisión.`,
      referenceId: schedule.id,
    });

    await this.auditService.log({
      userId: user.sub,
      action: 'SCHEDULE_CREATED',
      entityType: 'Schedule',
      entityId: schedule.id,
      metadata: { clientId: dto.clientId, weekStartDate: dto.weekStartDate },
    });

    return schedule;
  }

  async addItemAndSubmitForReview(
    scheduleId: string,
    dto: AddScheduleItemDto,
    user: AuthenticatedUser,
  ) {
    if (user.role === RoleCode.CLIENTE) {
      throw new ForbiddenException('El cliente no puede agregar ítems al cronograma.');
    }

    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: { client: true },
    });
    if (!schedule) {
      throw new NotFoundException('Cronograma no encontrado.');
    }

    await this.clientsService.assertClientAccess(schedule.clientId, user);
    const video = await this.videosService.findOneWithAccess(dto.videoId, user);

    if (video.clientId !== schedule.clientId) {
      throw new BadRequestException(
        'El video pertenece a un cliente distinto al del cronograma.',
      );
    }

    const [item] = await this.prisma.$transaction([
      this.prisma.scheduleItem.upsert({
        where: {
          scheduleId_videoId: {
            scheduleId,
            videoId: dto.videoId,
          },
        },
        update: {
          dayOfWeek: dto.dayOfWeek,
          plannedPublishAt: new Date(dto.plannedPublishAt),
          notes: dto.notes ?? null,
        },
        create: {
          scheduleId,
          videoId: dto.videoId,
          dayOfWeek: dto.dayOfWeek,
          plannedPublishAt: new Date(dto.plannedPublishAt),
          notes: dto.notes ?? null,
        },
      }),
      this.prisma.video.update({
        where: { id: dto.videoId },
        data: { workflowStatus: VideoWorkflowStatus.IN_REVIEW },
      }),
      this.prisma.schedule.update({
        where: { id: scheduleId },
        data: { status: ScheduleStatus.IN_REVIEW },
      }),
    ]);

    await this.notificationsService.notifyUser({
      userId: schedule.client.userId,
      type: NotificationType.VIDEO_IN_REVIEW,
      title: 'Nuevo video listo para tu aprobación',
      body: `El video "${video.title}" fue agregado a tu cronograma semanal.`,
      referenceId: video.id,
    });

    return item;
  }

  async listSchedules(user: AuthenticatedUser, clientIdFilter?: string) {
    if (clientIdFilter) {
      await this.clientsService.assertClientAccess(clientIdFilter, user);
    }

    const whereClause: Record<string, unknown> = {};
    if (clientIdFilter) {
      whereClause.clientId = clientIdFilter;
    } else if (user.role === RoleCode.AGENCIA) {
      whereClause.client = { agencyId: user.agencyId };
    } else if (user.role === RoleCode.CLIENTE) {
      whereClause.clientId = user.clientId;
    }

    return this.prisma.schedule.findMany({
      where: whereClause,
      orderBy: { weekStartDate: 'desc' },
      include: {
        client: { select: { id: true, companyName: true, industry: true } },
        items: {
          orderBy: [{ dayOfWeek: 'asc' }, { plannedPublishAt: 'asc' }],
          include: {
            video: {
              include: {
                platformTargets: true,
                hashtags: { orderBy: { position: 'asc' } },
                approvals: { orderBy: { createdAt: 'desc' }, take: 1 },
                publications: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Máquina de estados del flujo de aprobación del cliente:
   * Borrador (DRAFT) / En Revisión (IN_REVIEW) / Cambios Solicitados ->
   * APROBADO (APPROVED) | PEDIR CAMBIOS (CHANGES_REQUESTED) | RECHAZAR (REJECTED).
   */
  async reviewVideo(
    videoId: string,
    dto: ReviewVideoDecisionDto,
    user: AuthenticatedUser,
  ) {
    const video = await this.videosService.findOneWithAccess(videoId, user);

    if (
      video.workflowStatus === VideoWorkflowStatus.PUBLISHED ||
      video.workflowStatus === VideoWorkflowStatus.SCHEDULED
    ) {
      throw new BadRequestException(
        `No se puede cambiar la decisión de un video que ya está en estado ${video.workflowStatus}.`,
      );
    }

    if (
      (dto.decision === ApprovalDecision.CHANGES_REQUESTED ||
        dto.decision === ApprovalDecision.REJECTED) &&
      (!dto.feedbackNotes || dto.feedbackNotes.trim().length < 3)
    ) {
      throw new BadRequestException(
        'Debe dejar una nota o comentario explicando los cambios solicitados o el motivo de rechazo.',
      );
    }

    const nextWorkflowStatus: Record<ApprovalDecision, VideoWorkflowStatus> = {
      [ApprovalDecision.APPROVED]: VideoWorkflowStatus.APPROVED,
      [ApprovalDecision.CHANGES_REQUESTED]: VideoWorkflowStatus.CHANGES_REQUESTED,
      [ApprovalDecision.REJECTED]: VideoWorkflowStatus.REJECTED,
    };

    const newStatus = nextWorkflowStatus[dto.decision];

    const [approval, updatedVideo] = await this.prisma.$transaction([
      this.prisma.approval.create({
        data: {
          videoId,
          reviewerUserId: user.sub,
          decision: dto.decision,
          feedbackNotes: dto.feedbackNotes?.trim() ?? null,
        },
      }),
      this.prisma.video.update({
        where: { id: videoId },
        data: { workflowStatus: newStatus },
      }),
    ]);

    if (dto.feedbackNotes?.trim()) {
      await this.prisma.videoComment.create({
        data: {
          videoId,
          authorUserId: user.sub,
          message: `[${dto.decision}] ${dto.feedbackNotes.trim()}`,
        },
      });
    }

    const notifTypeMap: Record<ApprovalDecision, NotificationType> = {
      [ApprovalDecision.APPROVED]: NotificationType.VIDEO_APPROVED,
      [ApprovalDecision.CHANGES_REQUESTED]: NotificationType.VIDEO_CHANGES_REQUESTED,
      [ApprovalDecision.REJECTED]: NotificationType.VIDEO_REJECTED,
    };

    // Notificar al usuario de la agencia que subió el video
    await this.notificationsService.notifyUser({
      userId: video.uploadedByUserId,
      type: notifTypeMap[dto.decision],
      title: `Revisión de cliente: ${dto.decision}`,
      body: `El video "${video.title}" pasó a estado ${newStatus}.`,
      referenceId: video.id,
    });

    await this.auditService.log({
      userId: user.sub,
      action: `VIDEO_REVIEW_${dto.decision}`,
      entityType: 'Video',
      entityId: videoId,
      metadata: { nextStatus: newStatus, feedbackNotes: dto.feedbackNotes },
    });

    return {
      approval,
      videoId: updatedVideo.id,
      workflowStatus: updatedVideo.workflowStatus,
    };
  }

  async addComment(videoId: string, dto: AddVideoCommentDto, user: AuthenticatedUser) {
    await this.videosService.findOneWithAccess(videoId, user);
    return this.prisma.videoComment.create({
      data: {
        videoId,
        authorUserId: user.sub,
        message: dto.message.trim(),
        timestampSec: dto.timestampSec ?? null,
      },
      include: {
        authorUser: { select: { id: true, fullName: true, email: true } },
      },
    });
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  ApprovalDecision,
  ClientConfirmationStatus,
  NotificationType,
  PublicationStatus,
  RoleCode,
  ScheduleStatus,
  VideoWorkflowStatus,
} from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ClientsService } from '../clients/clients.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { VideosService } from '../videos/videos.service';
import {
  AddScheduleItemDto,
  AddVideoCommentDto,
  CreateScheduleBlockDto,
  CreateScheduleDto,
  DuplicateScheduleDto,
  InlineBlockVideoDto,
  ReviewVideoDecisionDto,
  UpdateScheduleBlockDto,
} from './dto/schedule-approval.dto';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
    private readonly videosService: VideosService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    @Optional() private readonly storageService?: StorageService,
  ) {}

  private computePlannedDateTime(
    weekStartDate: Date,
    dayOfWeek: number,
    plannedTime: string,
  ): Date {
    const base = new Date(weekStartDate);
    const utcYear = base.getUTCFullYear();
    const utcMonth = base.getUTCMonth();
    const utcDay = base.getUTCDate() + Math.max(0, dayOfWeek - 1);
    const [hhRaw, mmRaw] = (plannedTime || '18:00').split(':');
    const hh = Math.min(23, Math.max(0, parseInt(hhRaw || '18', 10) || 18));
    const mm = Math.min(59, Math.max(0, parseInt(mmRaw || '0', 10) || 0));
    return new Date(utcYear, utcMonth, utcDay, hh, mm, 0, 0);
  }

  private enrichScheduleVideos<T extends { items?: Array<{ video?: any }> }>(
    schedule: T,
  ): T {
    if (!schedule.items) return schedule;
    for (const item of schedule.items) {
      if (item.video) {
        item.video.publicVideoUrl = this.storageService
          ? this.storageService.getPublicUrl(item.video.storageKey)
          : item.video.storageKey;
      }
    }
    return schedule;
  }

  private scheduleInclude() {
    return {
      client: {
        select: {
          id: true,
          companyName: true,
          industry: true,
          agencyId: true,
          userId: true,
          confirmationStatus: true,
        },
      },
      duplicatedFrom: {
        select: {
          id: true,
          title: true,
          weekStartDate: true,
          weekEndDate: true,
        },
      },
      items: {
        orderBy: [
          { dayOfWeek: 'asc' as const },
          { plannedTime: 'asc' as const },
          { sortOrder: 'asc' as const },
        ],
        include: {
          video: {
            include: {
              platformTargets: true,
              hashtags: { orderBy: { position: 'asc' as const } },
              approvals: { orderBy: { createdAt: 'desc' as const }, take: 1 },
              comments: {
                orderBy: { createdAt: 'asc' as const },
                include: {
                  authorUser: { select: { id: true, fullName: true, email: true } },
                },
              },
              publications: true,
            },
          },
        },
      },
    };
  }

  async createSchedule(dto: CreateScheduleDto, user: AuthenticatedUser) {
    if (user.role === RoleCode.CLIENTE) {
      throw new ForbiddenException(
        'Solo la agencia o el administrador pueden crear cronogramas.',
      );
    }

    const client = await this.clientsService.assertClientAccess(
      dto.clientId,
      user,
      true,
    );
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
        'Ya existe un plan semanal para este cliente en esa semana. Podés elegir otra fecha de lunes.',
      );
    }

    const schedule = await this.prisma.schedule.create({
      data: {
        clientId: dto.clientId,
        createdByUserId: user.sub,
        weekStartDate: startDate,
        weekEndDate: endDate,
        title: dto.title.trim(),
        summaryNotes: dto.summaryNotes?.trim() || null,
        status: ScheduleStatus.IN_REVIEW,
      },
      include: this.scheduleInclude(),
    });

    await this.notificationsService.notifyUser({
      userId: client.userId,
      type: NotificationType.NEW_SCHEDULE,
      title: 'Nuevo plan semanal disponible',
      body: `Tu agencia publicó el plan "${schedule.title}" para la semana.`,
      referenceId: schedule.id,
    });

    await this.auditService.log({
      userId: user.sub,
      action: 'SCHEDULE_CREATED',
      entityType: 'Schedule',
      entityId: schedule.id,
      metadata: { clientId: dto.clientId, weekStartDate: dto.weekStartDate },
    });

    return this.enrichScheduleVideos(schedule);
  }

  private async createOrUpdateBlockVideo(params: {
    existingVideoId?: string | null;
    clientId: string;
    userId: string;
    inlineVideo: InlineBlockVideoDto;
    plannedPublishAt: Date;
    autoPublish: boolean;
  }): Promise<string> {
    const {
      existingVideoId,
      clientId,
      userId,
      inlineVideo,
      plannedPublishAt,
      autoPublish,
    } = params;

    const durationSeconds = inlineVideo.durationSeconds || 30;
    const sizeBytes = inlineVideo.sizeBytes || 12000000;
    const mimeType = (inlineVideo.mimeType || 'video/mp4').trim().toLowerCase();

    this.videosService.validateVideoSpecsForPlatforms({
      mimeType,
      durationSeconds,
      sizeBytes,
      platforms: inlineVideo.platforms,
    });

    const cleanTags = Array.from(
      new Set(
        (inlineVideo.hashtags || [])
          .map((t) => t.replace(/^#/, '').trim().toLowerCase())
          .filter((t) => t.length > 0),
      ),
    );

    const targetStatus = autoPublish
      ? VideoWorkflowStatus.SCHEDULED
      : VideoWorkflowStatus.IN_REVIEW;

    let videoId = existingVideoId || null;

    if (videoId) {
      await this.prisma.$transaction([
        this.prisma.videoHashtag.deleteMany({ where: { videoId } }),
        this.prisma.videoPlatformTarget.deleteMany({ where: { videoId } }),
        this.prisma.video.update({
          where: { id: videoId },
          data: {
            title: inlineVideo.title.trim(),
            description: inlineVideo.description.trim(),
            storageKey: inlineVideo.storageKey,
            durationSeconds,
            sizeBytes: BigInt(sizeBytes),
            mimeType,
            workflowStatus: targetStatus,
            hashtags: {
              create: cleanTags.map((tag, idx) => ({ tag, position: idx })),
            },
            platformTargets: {
              create: inlineVideo.platforms.map((platform) => ({
                platform,
                shareToFeed: inlineVideo.shareToFeed ?? true,
                allowComments: inlineVideo.allowComments ?? true,
                allowDuetStitch: inlineVideo.allowDuetStitch ?? true,
                madeForKids: inlineVideo.madeForKids ?? false,
              })),
            },
          },
        }),
      ]);
    } else {
      const created = await this.prisma.video.create({
        data: {
          clientId,
          uploadedByUserId: userId,
          title: inlineVideo.title.trim(),
          description: inlineVideo.description.trim(),
          storageKey: inlineVideo.storageKey,
          durationSeconds,
          sizeBytes: BigInt(sizeBytes),
          mimeType,
          aspectRatio: '9:16',
          workflowStatus: targetStatus,
          hashtags: {
            create: cleanTags.map((tag, idx) => ({ tag, position: idx })),
          },
          platformTargets: {
            create: inlineVideo.platforms.map((platform) => ({
              platform,
              shareToFeed: inlineVideo.shareToFeed ?? true,
              allowComments: inlineVideo.allowComments ?? true,
              allowDuetStitch: inlineVideo.allowDuetStitch ?? true,
              madeForKids: inlineVideo.madeForKids ?? false,
            })),
          },
        },
      });
      videoId = created.id;
    }

    // Sincronizar programación automática para ese día y hora
    await this.prisma.publication.deleteMany({
      where: {
        videoId,
        platform: { notIn: inlineVideo.platforms },
        status: PublicationStatus.PENDING,
      },
    });

    if (autoPublish) {
      for (const platform of inlineVideo.platforms) {
        await this.prisma.publication.upsert({
          where: {
            videoId_platform: {
              videoId,
              platform,
            },
          },
          update: {
            scheduledFor: plannedPublishAt,
            status: PublicationStatus.PENDING,
            lastErrorMessage: null,
          },
          create: {
            videoId,
            platform,
            scheduledFor: plannedPublishAt,
            status: PublicationStatus.PENDING,
            bullJobId: `plan_${videoId}_${platform}_${plannedPublishAt.getTime()}`,
          },
        });
      }
    } else {
      await this.prisma.publication.deleteMany({
        where: { videoId, status: PublicationStatus.PENDING },
      });
    }

    return videoId;
  }

  /**
   * Crea un bloque de color (nota + horario + video opcional configurado) en un día de la cuadrícula Lunes-Viernes.
   */
  async createBlock(
    scheduleId: string,
    dto: CreateScheduleBlockDto,
    user: AuthenticatedUser,
  ) {
    if (user.role === RoleCode.CLIENTE) {
      throw new ForbiddenException('El cliente no puede agregar bloques al plan.');
    }

    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: { client: true },
    });
    if (!schedule) {
      throw new NotFoundException('Plan semanal no encontrado.');
    }

    await this.clientsService.assertClientAccess(schedule.clientId, user, true);

    const plannedTime = dto.plannedTime || '18:00';
    const autoPublish = dto.autoPublish ?? true;
    const plannedPublishAt = this.computePlannedDateTime(
      schedule.weekStartDate,
      dto.dayOfWeek,
      plannedTime,
    );

    let attachedVideoId: string | null = dto.videoId || null;

    if (dto.inlineVideo) {
      attachedVideoId = await this.createOrUpdateBlockVideo({
        clientId: schedule.clientId,
        userId: user.sub,
        inlineVideo: dto.inlineVideo,
        plannedPublishAt,
        autoPublish,
      });
    } else if (attachedVideoId) {
      const video = await this.videosService.findOneWithAccess(
        attachedVideoId,
        user,
      );
      if (video.clientId !== schedule.clientId) {
        throw new BadRequestException(
          'El video pertenece a un cliente distinto al del plan.',
        );
      }
      if (autoPublish) {
        await this.prisma.video.update({
          where: { id: attachedVideoId },
          data: { workflowStatus: VideoWorkflowStatus.SCHEDULED },
        });
        for (const pt of video.platformTargets) {
          await this.prisma.publication.upsert({
            where: {
              videoId_platform: { videoId: attachedVideoId, platform: pt.platform },
            },
            update: {
              scheduledFor: plannedPublishAt,
              status: PublicationStatus.PENDING,
            },
            create: {
              videoId: attachedVideoId,
              platform: pt.platform,
              scheduledFor: plannedPublishAt,
              status: PublicationStatus.PENDING,
              bullJobId: `plan_${attachedVideoId}_${pt.platform}_${plannedPublishAt.getTime()}`,
            },
          });
        }
      }
    }

    const existingBlocksCount = await this.prisma.scheduleItem.count({
      where: { scheduleId, dayOfWeek: dto.dayOfWeek },
    });

    const block = await this.prisma.scheduleItem.create({
      data: {
        scheduleId,
        videoId: attachedVideoId,
        dayOfWeek: dto.dayOfWeek,
        blockTitle: dto.blockTitle.trim(),
        noteColor: (dto.noteColor || 'AMBER').trim().toUpperCase(),
        notes: dto.notes?.trim() || null,
        plannedTime,
        plannedPublishAt,
        autoPublish,
        sortOrder: existingBlocksCount,
      },
      include: {
        video: {
          include: {
            platformTargets: true,
            hashtags: { orderBy: { position: 'asc' } },
            approvals: { orderBy: { createdAt: 'desc' }, take: 1 },
            comments: {
              orderBy: { createdAt: 'asc' },
              include: { authorUser: { select: { id: true, fullName: true } } },
            },
            publications: true,
          },
        },
      },
    });

    if (attachedVideoId) {
      await this.notificationsService.notifyUser({
        userId: schedule.client.userId,
        type: NotificationType.VIDEO_IN_REVIEW,
        title: 'Nuevo contenido programado en tu plan semanal',
        body: `Se agregó "${dto.blockTitle.trim()}" (${plannedTime} hs) a tu plan "${schedule.title}".`,
        referenceId: attachedVideoId,
      });
    }

    await this.auditService.log({
      userId: user.sub,
      action: 'SCHEDULE_BLOCK_CREATED',
      entityType: 'ScheduleItem',
      entityId: block.id,
      metadata: {
        scheduleId,
        dayOfWeek: dto.dayOfWeek,
        hasVideo: Boolean(attachedVideoId),
        autoPublish,
      },
    });

    if (block.video && this.storageService) {
      (block.video as any).publicVideoUrl = this.storageService.getPublicUrl(
        block.video.storageKey,
      );
    }

    return block;
  }

  /**
   * Edita un bloque existente (nota, color, día, hora, o video anexado).
   */
  async updateBlock(
    blockId: string,
    dto: UpdateScheduleBlockDto,
    user: AuthenticatedUser,
  ) {
    if (user.role === RoleCode.CLIENTE) {
      throw new ForbiddenException('El cliente no puede editar bloques del plan.');
    }

    const existing = await this.prisma.scheduleItem.findUnique({
      where: { id: blockId },
      include: { schedule: true, video: { include: { platformTargets: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Bloque no encontrado.');
    }

    await this.clientsService.assertClientAccess(
      existing.schedule.clientId,
      user,
      true,
    );

    const nextDay = dto.dayOfWeek ?? existing.dayOfWeek;
    const nextTime = dto.plannedTime ?? existing.plannedTime;
    const nextAuto = dto.autoPublish ?? existing.autoPublish;
    const nextPlannedAt = this.computePlannedDateTime(
      existing.schedule.weekStartDate,
      nextDay,
      nextTime,
    );

    let nextVideoId: string | null = existing.videoId;

    if (dto.removeVideo && existing.videoId) {
      await this.prisma.publication.deleteMany({
        where: { videoId: existing.videoId, status: PublicationStatus.PENDING },
      });
      nextVideoId = null;
    } else if (dto.inlineVideo) {
      nextVideoId = await this.createOrUpdateBlockVideo({
        existingVideoId: existing.videoId,
        clientId: existing.schedule.clientId,
        userId: user.sub,
        inlineVideo: dto.inlineVideo,
        plannedPublishAt: nextPlannedAt,
        autoPublish: nextAuto,
      });
    } else if (nextVideoId) {
      // Si cambió día, hora o autoPublish, actualizar las publicaciones pendientes
      if (nextAuto) {
        const targets = existing.video?.platformTargets || [];
        for (const pt of targets) {
          await this.prisma.publication.upsert({
            where: {
              videoId_platform: { videoId: nextVideoId, platform: pt.platform },
            },
            update: { scheduledFor: nextPlannedAt },
            create: {
              videoId: nextVideoId,
              platform: pt.platform,
              scheduledFor: nextPlannedAt,
              status: PublicationStatus.PENDING,
              bullJobId: `plan_${nextVideoId}_${pt.platform}_${nextPlannedAt.getTime()}`,
            },
          });
        }
      } else {
        await this.prisma.publication.deleteMany({
          where: { videoId: nextVideoId, status: PublicationStatus.PENDING },
        });
      }
    }

    const updated = await this.prisma.scheduleItem.update({
      where: { id: blockId },
      data: {
        dayOfWeek: nextDay,
        blockTitle: dto.blockTitle?.trim(),
        noteColor: dto.noteColor?.trim().toUpperCase(),
        notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
        plannedTime: nextTime,
        plannedPublishAt: nextPlannedAt,
        autoPublish: nextAuto,
        videoId: nextVideoId,
      },
      include: {
        video: {
          include: {
            platformTargets: true,
            hashtags: { orderBy: { position: 'asc' } },
            approvals: { orderBy: { createdAt: 'desc' }, take: 1 },
            comments: {
              orderBy: { createdAt: 'asc' },
              include: { authorUser: { select: { id: true, fullName: true } } },
            },
            publications: true,
          },
        },
      },
    });

    if (updated.video && this.storageService) {
      (updated.video as any).publicVideoUrl = this.storageService.getPublicUrl(
        updated.video.storageKey,
      );
    }

    return updated;
  }

  async deleteBlock(blockId: string, user: AuthenticatedUser) {
    if (user.role === RoleCode.CLIENTE) {
      throw new ForbiddenException('El cliente no puede eliminar bloques del plan.');
    }

    const existing = await this.prisma.scheduleItem.findUnique({
      where: { id: blockId },
      include: { schedule: true },
    });
    if (!existing) {
      throw new NotFoundException('Bloque no encontrado.');
    }

    await this.clientsService.assertClientAccess(existing.schedule.clientId, user);

    if (existing.videoId) {
      await this.prisma.publication.deleteMany({
        where: { videoId: existing.videoId, status: PublicationStatus.PENDING },
      });
    }

    await this.prisma.scheduleItem.delete({ where: { id: blockId } });

    await this.auditService.log({
      userId: user.sub,
      action: 'SCHEDULE_BLOCK_DELETED',
      entityType: 'ScheduleItem',
      entityId: blockId,
    });

    return { message: 'Bloque eliminado del plan.', id: blockId };
  }

  /**
   * Duplica una semana completa (bloques de Lunes a Viernes, colores, horarios y opcionalmente videos)
   * dejando registro persistente en `schedule_duplication_logs`.
   */
  async duplicateSchedule(
    sourceScheduleId: string,
    dto: DuplicateScheduleDto,
    user: AuthenticatedUser,
  ) {
    if (user.role === RoleCode.CLIENTE) {
      throw new ForbiddenException('Solo la agencia puede duplicar semanas del plan.');
    }

    const source = await this.prisma.schedule.findUnique({
      where: { id: sourceScheduleId },
      include: {
        client: true,
        items: {
          orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }],
          include: {
            video: {
              include: {
                hashtags: { orderBy: { position: 'asc' } },
                platformTargets: true,
              },
            },
          },
        },
      },
    });

    if (!source) {
      throw new NotFoundException('Semana de origen no encontrada.');
    }

    await this.clientsService.assertClientAccess(source.clientId, user, true);

    const targetStart = new Date(dto.targetWeekStartDate);
    // Fin de semana Lunes a Viernes (+4 días)
    const targetEnd = new Date(targetStart.getTime() + 4 * 24 * 60 * 60 * 1000);

    const clash = await this.prisma.schedule.findUnique({
      where: {
        clientId_weekStartDate: {
          clientId: source.clientId,
          weekStartDate: targetStart,
        },
      },
    });
    if (clash) {
      throw new ConflictException(
        'Ya existe un plan creado para esa fecha de inicio en este cliente. Seleccioná otra semana.',
      );
    }

    const includeVideos = dto.includeVideos ?? false;
    const newTitle = dto.title?.trim() || `${source.title} (Duplicada)`;

    const createdTarget = await this.prisma.schedule.create({
      data: {
        clientId: source.clientId,
        createdByUserId: user.sub,
        duplicatedFromId: source.id,
        weekStartDate: targetStart,
        weekEndDate: targetEnd,
        title: newTitle,
        summaryNotes: source.summaryNotes,
        status: ScheduleStatus.IN_REVIEW,
      },
    });

    let copiedCount = 0;
    for (const item of source.items) {
      const plannedAt = this.computePlannedDateTime(
        targetStart,
        item.dayOfWeek,
        item.plannedTime,
      );

      let clonedVideoId: string | null = null;
      if (includeVideos && item.video) {
        const clonedVid = await this.prisma.video.create({
          data: {
            clientId: source.clientId,
            uploadedByUserId: user.sub,
            title: item.video.title,
            description: item.video.description,
            storageKey: item.video.storageKey,
            thumbnailKey: item.video.thumbnailKey,
            durationSeconds: item.video.durationSeconds,
            sizeBytes: item.video.sizeBytes,
            mimeType: item.video.mimeType,
            aspectRatio: item.video.aspectRatio,
            workflowStatus: item.autoPublish
              ? VideoWorkflowStatus.SCHEDULED
              : VideoWorkflowStatus.IN_REVIEW,
            hashtags: {
              create: item.video.hashtags.map((h) => ({
                tag: h.tag,
                position: h.position,
              })),
            },
            platformTargets: {
              create: item.video.platformTargets.map((pt) => ({
                platform: pt.platform,
                customTitle: pt.customTitle,
                customDescription: pt.customDescription,
                privacyLevel: pt.privacyLevel,
                shareToFeed: pt.shareToFeed,
                allowComments: pt.allowComments,
                allowDuetStitch: pt.allowDuetStitch,
                madeForKids: pt.madeForKids,
              })),
            },
          },
        });
        clonedVideoId = clonedVid.id;

        if (item.autoPublish) {
          for (const pt of item.video.platformTargets) {
            await this.prisma.publication.create({
              data: {
                videoId: clonedVideoId,
                platform: pt.platform,
                scheduledFor: plannedAt,
                status: PublicationStatus.PENDING,
                bullJobId: `dup_${clonedVideoId}_${pt.platform}_${plannedAt.getTime()}`,
              },
            });
          }
        }
      }

      await this.prisma.scheduleItem.create({
        data: {
          scheduleId: createdTarget.id,
          videoId: clonedVideoId,
          dayOfWeek: item.dayOfWeek,
          blockTitle: item.blockTitle,
          noteColor: item.noteColor,
          notes: item.notes,
          plannedTime: item.plannedTime,
          plannedPublishAt: plannedAt,
          autoPublish: item.autoPublish,
          sortOrder: item.sortOrder,
        },
      });
      copiedCount++;
    }

    const duplicationLog = await this.prisma.scheduleDuplicationLog.create({
      data: {
        agencyId: source.client.agencyId,
        clientId: source.clientId,
        sourceScheduleId: source.id,
        targetScheduleId: createdTarget.id,
        duplicatedByUserId: user.sub,
        blocksCopiedCount: copiedCount,
        includeVideos,
        notes:
          dto.notes?.trim() ||
          `Duplicación de "${source.title}" con ${copiedCount} bloques.`,
      },
      include: {
        sourceSchedule: {
          select: { id: true, title: true, weekStartDate: true, weekEndDate: true },
        },
        targetSchedule: {
          select: { id: true, title: true, weekStartDate: true, weekEndDate: true },
        },
        client: { select: { id: true, companyName: true } },
        duplicatedByUser: { select: { id: true, fullName: true } },
      },
    });

    await this.notificationsService.notifyUser({
      userId: source.client.userId,
      type: NotificationType.SCHEDULE_DUPLICATED,
      title: 'Nueva semana planificada',
      body: `Tu agencia publicó el plan "${newTitle}" con ${copiedCount} bloques programados.`,
      referenceId: createdTarget.id,
    });

    await this.auditService.log({
      userId: user.sub,
      action: 'SCHEDULE_DUPLICATED',
      entityType: 'Schedule',
      entityId: createdTarget.id,
      metadata: {
        sourceScheduleId: source.id,
        blocksCopiedCount: copiedCount,
        includeVideos,
      },
    });

    const fullSchedule = await this.prisma.schedule.findUniqueOrThrow({
      where: { id: createdTarget.id },
      include: this.scheduleInclude(),
    });

    return {
      schedule: this.enrichScheduleVideos(fullSchedule),
      duplicationLog,
    };
  }

  /**
   * Lista el registro auditable de semanas duplicadas según permisos del usuario.
   */
  async listDuplicationLogs(user: AuthenticatedUser, clientIdFilter?: string) {
    if (clientIdFilter) {
      await this.clientsService.assertClientAccess(clientIdFilter, user);
    }

    const where: Record<string, unknown> = {};
    if (clientIdFilter) {
      where.clientId = clientIdFilter;
    } else if (user.role === RoleCode.AGENCIA) {
      where.agencyId = user.agencyId;
    } else if (user.role === RoleCode.CLIENTE) {
      where.clientId = user.clientId;
    }

    return this.prisma.scheduleDuplicationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        sourceSchedule: {
          select: { id: true, title: true, weekStartDate: true, weekEndDate: true },
        },
        targetSchedule: {
          select: { id: true, title: true, weekStartDate: true, weekEndDate: true },
        },
        client: { select: { id: true, companyName: true } },
        duplicatedByUser: { select: { id: true, fullName: true, email: true } },
      },
    });
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

    await this.clientsService.assertClientAccess(schedule.clientId, user, true);
    const video = await this.videosService.findOneWithAccess(dto.videoId, user);

    if (video.clientId !== schedule.clientId) {
      throw new BadRequestException(
        'El video pertenece a un cliente distinto al del cronograma.',
      );
    }

    const publishDate = new Date(dto.plannedPublishAt);
    const hh = String(publishDate.getHours()).padStart(2, '0');
    const mm = String(publishDate.getMinutes()).padStart(2, '0');

    const [item] = await this.prisma.$transaction([
      this.prisma.scheduleItem.create({
        data: {
          scheduleId,
          videoId: dto.videoId,
          dayOfWeek: dto.dayOfWeek,
          blockTitle: video.title,
          noteColor: 'LIME',
          plannedTime: `${hh}:${mm}`,
          plannedPublishAt: publishDate,
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

    if (user.role === RoleCode.CLIENTE && user.clientId) {
      const cl = await this.prisma.client.findUnique({
        where: { id: user.clientId },
      });
      if (!cl || cl.confirmationStatus !== ClientConfirmationStatus.CONFIRMED) {
        return [];
      }
    }

    const whereClause: Record<string, unknown> = {};
    if (clientIdFilter) {
      whereClause.clientId = clientIdFilter;
    } else if (user.role === RoleCode.AGENCIA) {
      whereClause.client = { agencyId: user.agencyId, deletedAt: null };
    } else if (user.role === RoleCode.CLIENTE) {
      whereClause.clientId = user.clientId;
    }

    const list = await this.prisma.schedule.findMany({
      where: whereClause,
      orderBy: { weekStartDate: 'desc' },
      include: this.scheduleInclude(),
    });

    return list.map((s) => this.enrichScheduleVideos(s));
  }

  async reviewVideo(
    videoId: string,
    dto: ReviewVideoDecisionDto,
    user: AuthenticatedUser,
  ) {
    const video = await this.videosService.findOneWithAccess(videoId, user);

    if (video.workflowStatus === VideoWorkflowStatus.PUBLISHED) {
      throw new BadRequestException(
        `No se puede cambiar la decisión de un video que ya fue publicado.`,
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

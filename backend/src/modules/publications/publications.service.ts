import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  NotificationType,
  PublicationStatus,
  RoleCode,
  VideoWorkflowStatus,
} from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ClientsService } from '../clients/clients.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformsService } from '../platforms/platforms.service';
import { StorageService } from '../storage/storage.service';
import { VideosService } from '../videos/videos.service';
import { HistoryFilterDto, ScheduleOrPublishVideoDto } from './dto/publication.dto';

@Injectable()
export class PublicationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PublicationsService.name);
  private readonly maxRetries = 3;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private processingTick = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly videosService: VideosService,
    private readonly clientsService: ClientsService,
    private readonly platformsService: PlatformsService,
    private readonly storageService: StorageService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  onModuleInit() {
    this.schedulerInterval = setInterval(() => {
      void this.processDueScheduledPublications();
    }, 20000);
  }

  onModuleDestroy() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  /**
   * Reloj automático: ejecuta las publicaciones programadas desde el Plan cuando llega su día y hora.
   */
  async processDueScheduledPublications() {
    if (this.processingTick) return;
    this.processingTick = true;
    try {
      const duePubs = await this.prisma.publication.findMany({
        where: {
          status: PublicationStatus.PENDING,
          scheduledFor: { lte: new Date() },
          video: {
            deletedAt: null,
            workflowStatus: {
              in: [VideoWorkflowStatus.APPROVED, VideoWorkflowStatus.SCHEDULED],
            },
          },
        },
        take: 15,
      });

      for (const pub of duePubs) {
        await this.executeSinglePlatformPublicationWithRetries(pub.id);
      }
    } catch (err: any) {
      this.logger.warn(`Error en barrido de publicaciones programadas: ${err.message}`);
    } finally {
      this.processingTick = false;
    }
  }

  /**
   * Programa o ejecuta en una sola acción la publicación de un video aprobado
   * en todas sus plataformas destino (Instagram Reels, TikTok, YouTube Shorts).
   * REGLA ESTRICTA: Solo los videos en estado APPROVED o SCHEDULED pueden publicarse.
   */
  async scheduleOrPublishMultiPlatform(
    dto: ScheduleOrPublishVideoDto,
    user: AuthenticatedUser,
  ) {
    if (user.role === RoleCode.CLIENTE) {
      throw new ForbiddenException('Solo la agencia o el administrador pueden publicar o programar.');
    }

    const video = await this.videosService.findOneWithAccess(dto.videoId, user);

    if (
      video.workflowStatus !== VideoWorkflowStatus.APPROVED &&
      video.workflowStatus !== VideoWorkflowStatus.SCHEDULED
    ) {
      throw new BadRequestException(
        `Bloqueo de seguridad: solo los videos APROBADOS o PROGRAMADOS pueden publicarse. Estado actual: ${video.workflowStatus}.`,
      );
    }

    const scheduledDate = dto.scheduledFor ? new Date(dto.scheduledFor) : new Date();
    const isImmediate = scheduledDate.getTime() <= Date.now() + 5000;

    const publications = [];
    for (const target of video.platformTargets) {
      const pub = await this.prisma.publication.upsert({
        where: {
          videoId_platform: {
            videoId: video.id,
            platform: target.platform,
          },
        },
        update: {
          scheduledFor: scheduledDate,
          status: PublicationStatus.PENDING,
          lastErrorMessage: null,
        },
        create: {
          videoId: video.id,
          platform: target.platform,
          scheduledFor: scheduledDate,
          status: PublicationStatus.PENDING,
          bullJobId: `bull_${video.id}_${target.platform}_${scheduledDate.getTime()}`,
        },
      });
      publications.push(pub);
    }

    await this.prisma.video.update({
      where: { id: video.id },
      data: { workflowStatus: VideoWorkflowStatus.SCHEDULED },
    });

    await this.auditService.log({
      userId: user.sub,
      action: isImmediate ? 'VIDEO_PUBLISH_IMMEDIATE' : 'VIDEO_PUBLISH_SCHEDULED',
      entityType: 'Video',
      entityId: video.id,
      metadata: {
        scheduledFor: scheduledDate.toISOString(),
        timezone: dto.userTimezone || 'America/Argentina/Buenos_Aires',
        platforms: video.platformTargets.map((t) => t.platform),
      },
    });

    if (isImmediate) {
      const executedResults = [];
      for (const pub of publications) {
        const res = await this.executeSinglePlatformPublicationWithRetries(pub.id);
        executedResults.push(res);
      }
      return {
        mode: 'IMMEDIATE',
        videoId: video.id,
        publications: executedResults,
      };
    }

    return {
      mode: 'SCHEDULED',
      videoId: video.id,
      scheduledFor: scheduledDate,
      publications,
    };
  }

  /**
   * Ejecuta la publicación hacia una plataforma individual usando el patrón Strategy
   * (`PlatformPublisher`) con reintentos automáticos y registro de cada intento en
   * `publication_attempts`.
   */
  async executeSinglePlatformPublicationWithRetries(publicationId: string) {
    const publication = await this.prisma.publication.findUnique({
      where: { id: publicationId },
      include: {
        video: {
          include: {
            hashtags: { orderBy: { position: 'asc' } },
            platformTargets: true,
            client: true,
          },
        },
        attempts: true,
      },
    });

    if (!publication) {
      throw new NotFoundException('Publicación no encontrada.');
    }

    await this.prisma.publication.update({
      where: { id: publicationId },
      data: { status: PublicationStatus.PROCESSING },
    });

    const targetConfig = publication.video.platformTargets.find(
      (t) => t.platform === publication.platform,
    );
    const publisher = this.platformsService.getPublisher(publication.platform);

    let attemptNumber = publication.attempts.length;
    let lastError: string | null = null;

    while (attemptNumber < this.maxRetries) {
      attemptNumber++;
      const startTime = Date.now();
      try {
        const credentials = await this.platformsService.getValidDecryptedCredentials(
          publication.video.clientId,
          publication.platform,
        );

        const result = await publisher.publishVideo({
          videoId: publication.videoId,
          title: targetConfig?.customTitle || publication.video.title,
          description:
            targetConfig?.customDescription || publication.video.description,
          hashtags: publication.video.hashtags.map((h) => h.tag),
          publicVideoUrl: this.storageService.getPublicUrl(
            publication.video.storageKey,
          ),
          thumbnailUrl: publication.video.thumbnailKey
            ? this.storageService.getPublicUrl(publication.video.thumbnailKey)
            : null,
          privacyLevel: targetConfig?.privacyLevel || 'PUBLIC',
          shareToFeed: targetConfig?.shareToFeed ?? true,
          allowComments: targetConfig?.allowComments ?? true,
          allowDuetStitch: targetConfig?.allowDuetStitch ?? true,
          madeForKids: targetConfig?.madeForKids ?? false,
          accessToken: credentials.accessToken,
          externalAccountId: credentials.externalAccountId,
        });

        const durationMs = Date.now() - startTime;
        await this.prisma.publicationAttempt.create({
          data: {
            publicationId,
            attemptNumber,
            isSuccess: true,
            durationMs,
          },
        });

        const updatedPub = await this.prisma.publication.update({
          where: { id: publicationId },
          data: {
            status: PublicationStatus.PUBLISHED,
            publishedAt: result.publishedAt,
            externalPostId: result.externalPostId,
            externalPostUrl: result.externalPostUrl,
            lastErrorMessage: null,
          },
        });

        await this.syncOverallVideoPublicationStatus(publication.videoId);

        await this.notificationsService.notifyUser({
          userId: publication.video.uploadedByUserId,
          type: NotificationType.PUBLICATION_SUCCESS,
          title: `Publicado en ${publication.platform}`,
          body: `El video "${publication.video.title}" ya está disponible en ${publication.platform}.`,
          referenceId: publication.videoId,
        });

        return updatedPub;
      } catch (err) {
        const durationMs = Date.now() - startTime;
        lastError = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Intento #${attemptNumber} fallido en ${publication.platform}: ${lastError}`,
        );

        await this.prisma.publicationAttempt.create({
          data: {
            publicationId,
            attemptNumber,
            isSuccess: false,
            errorCode: `${publication.platform}_PUBLISH_ERR`,
            errorDetail: lastError,
            durationMs,
          },
        });
      }
    }

    const failedPub = await this.prisma.publication.update({
      where: { id: publicationId },
      data: {
        status: PublicationStatus.FAILED,
        lastErrorMessage:
          lastError || 'Error desconocido tras agotar los reintentos automáticos.',
      },
    });

    await this.notificationsService.notifyUser({
      userId: publication.video.uploadedByUserId,
      type: NotificationType.PUBLICATION_FAILED,
      title: `Error al publicar en ${publication.platform}`,
      body: `No se pudo publicar "${publication.video.title}" en ${publication.platform}: ${lastError}`,
      referenceId: publication.videoId,
    });

    return failedPub;
  }

  private async syncOverallVideoPublicationStatus(videoId: string) {
    const allPubs = await this.prisma.publication.findMany({
      where: { videoId },
    });
    if (
      allPubs.length > 0 &&
      allPubs.every((p) => p.status === PublicationStatus.PUBLISHED)
    ) {
      await this.prisma.video.update({
        where: { id: videoId },
        data: { workflowStatus: VideoWorkflowStatus.PUBLISHED },
      });
    }
  }

  /**
   * Historial completo con filtros combinados por semana, cliente, plataforma,
   * estado y buscador por texto (compatible con MySQL utf8mb4_unicode_ci).
   */
  async getPublicationHistory(
    filters: HistoryFilterDto,
    user: AuthenticatedUser,
  ) {
    if (filters.clientId) {
      await this.clientsService.assertClientAccess(filters.clientId, user);
    }

    const whereClause: Record<string, unknown> = {};
    if (filters.platform) {
      whereClause.platform = filters.platform;
    }
    if (filters.status) {
      whereClause.status = filters.status;
    }

    const videoFilter: Record<string, unknown> = { deletedAt: null };
    if (filters.clientId) {
      videoFilter.clientId = filters.clientId;
    } else if (user.role === RoleCode.AGENCIA) {
      videoFilter.client = { agencyId: user.agencyId };
    } else if (user.role === RoleCode.CLIENTE) {
      videoFilter.clientId = user.clientId;
    }

    if (filters.search?.trim()) {
      const q = filters.search.trim();
      videoFilter.OR = [
        { title: { contains: q } },
        { description: { contains: q } },
      ];
    }

    if (filters.weekStartDate) {
      const start = new Date(filters.weekStartDate);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      whereClause.scheduledFor = {
        gte: start,
        lte: end,
      };
    }

    whereClause.video = videoFilter;

    return this.prisma.publication.findMany({
      where: whereClause,
      orderBy: { scheduledFor: 'desc' },
      include: {
        video: {
          select: {
            id: true,
            title: true,
            description: true,
            durationSeconds: true,
            workflowStatus: true,
            client: { select: { id: true, companyName: true } },
            hashtags: { orderBy: { position: 'asc' } },
          },
        },
        attempts: { orderBy: { attemptNumber: 'asc' } },
      },
    });
  }
}

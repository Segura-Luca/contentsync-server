import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  ClientConfirmationStatus,
  NotificationType,
  PublicationStatus,
  RoleCode,
  VideoWorkflowStatus,
} from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfigService } from '../../config/app-config.service';
import { ClientsService } from '../clients/clients.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformsService } from '../platforms/platforms.service';
import { NonRetryablePublishError } from '../platforms/publishers/platform-publisher.interface';
import { SettingsService } from '../settings/settings.service';
import { StorageService } from '../storage/storage.service';
import { VideosService } from '../videos/videos.service';
import { HistoryFilterDto, ScheduleOrPublishVideoDto } from './dto/publication.dto';

@Injectable()
export class PublicationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PublicationsService.name);
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
    private readonly settings: SettingsService,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit() {
    if (!this.config.schedulerEnabled) {
      this.logger.log('Programador de publicaciones deshabilitado (PUBLISH_SCHEDULER_ENABLED=false).');
      return;
    }
    this.schedulerInterval = setInterval(() => {
      void this.processDueScheduledPublications();
    }, this.config.schedulerIntervalMs);
    this.schedulerInterval.unref();
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
      // Una publicación queda en PROCESSING si el proceso se reinició a mitad de camino: se devuelve a la cola.
      await this.prisma.publication.updateMany({
        where: {
          status: PublicationStatus.PROCESSING,
          updatedAt: { lt: new Date(Date.now() - this.config.publishStaleMinutes * 60000) },
        },
        data: { status: PublicationStatus.PENDING },
      });

      const duePubs = await this.prisma.publication.findMany({
        where: {
          status: PublicationStatus.PENDING,
          scheduledFor: { lte: new Date() },
          video: {
            deletedAt: null,
            workflowStatus: {
              in: [VideoWorkflowStatus.APPROVED, VideoWorkflowStatus.SCHEDULED],
            },
            client: {
              deletedAt: null,
              isActive: true,
              confirmationStatus: ClientConfirmationStatus.CONFIRMED,
              agency: { isSuspended: false, deletedAt: null },
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
    await this.clientsService.assertClientAccess(video.clientId, user, true);

    const isReady =
      video.workflowStatus === VideoWorkflowStatus.APPROVED ||
      video.workflowStatus === VideoWorkflowStatus.SCHEDULED;
    // Un video en revisión puede dejarse programado: el reloj solo lo publica cuando el cliente lo aprueba.
    const awaitingApproval =
      video.workflowStatus === VideoWorkflowStatus.IN_REVIEW && this.settings.current().requireClientApproval;

    if (!isReady && !awaitingApproval) {
      throw new BadRequestException(
        `Bloqueo de seguridad: solo los videos APROBADOS o PROGRAMADOS pueden publicarse. Estado actual: ${video.workflowStatus}.`,
      );
    }

    const scheduledDate = dto.scheduledFor ? new Date(dto.scheduledFor) : new Date();
    const isImmediate = isReady && scheduledDate.getTime() <= Date.now() + 5000;

    const alreadyPublished = new Set(
      video.publications.filter((p) => p.status === PublicationStatus.PUBLISHED).map((p) => p.platform),
    );
    // Reprogramar no puede volver a subir lo que ya está publicado en una red.
    const pendingTargets = video.platformTargets.filter((t) => !alreadyPublished.has(t.platform));
    if (pendingTargets.length === 0) {
      throw new BadRequestException('Este video ya está publicado en todas sus plataformas destino.');
    }

    const publications = [];
    for (const target of pendingTargets) {
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
        },
      });
      publications.push(pub);
    }

    if (isReady) {
      await this.prisma.video.update({
        where: { id: video.id },
        data: { workflowStatus: VideoWorkflowStatus.SCHEDULED },
      });
    }

    await this.auditService.log({
      userId: user.sub,
      action: isImmediate ? 'VIDEO_PUBLISH_IMMEDIATE' : 'VIDEO_PUBLISH_SCHEDULED',
      entityType: 'Video',
      entityId: video.id,
      metadata: {
        scheduledFor: scheduledDate.toISOString(),
        timezone: dto.userTimezone || user.timezone || this.settings.current().defaultTimezone,
        platforms: video.platformTargets.map((t) => t.platform),
      },
    });

    if (isImmediate) {
      // Instagram y TikTok pueden tardar minutos: se responde enseguida y el resultado llega por notificación.
      this.runInBackground(publications.map((pub) => pub.id));
      return {
        mode: 'IMMEDIATE',
        videoId: video.id,
        publications,
      };
    }

    return {
      mode: awaitingApproval ? 'AWAITING_APPROVAL' : 'SCHEDULED',
      videoId: video.id,
      scheduledFor: scheduledDate,
      publications,
    };
  }

  private runInBackground(publicationIds: string[]) {
    void (async () => {
      for (const id of publicationIds) {
        try {
          await this.executeSinglePlatformPublicationWithRetries(id);
        } catch (err: any) {
          this.logger.error(`Error al ejecutar la publicación ${id}: ${err?.message}`);
        }
      }
    })();
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

    // Reclamo atómico: si dos procesos toman la misma publicación, solo uno la sube.
    const claimed = await this.prisma.publication.updateMany({
      where: {
        id: publicationId,
        status: { in: [PublicationStatus.PENDING, PublicationStatus.FAILED] },
      },
      data: { status: PublicationStatus.PROCESSING },
    });
    if (claimed.count === 0) {
      return publication;
    }

    const targetConfig = publication.video.platformTargets.find(
      (t) => t.platform === publication.platform,
    );
    const publisher = this.platformsService.getPublisher(publication.platform);

    const { publishMaxAttempts, publishRetryDelaySeconds } = this.settings.current();
    let attemptNumber = publication.attempts.reduce((max, a) => Math.max(max, a.attemptNumber), 0);
    // Cada ejecución abre una tanda nueva: si no, una publicación agotada nunca volvería a intentarse.
    const lastAttempt = attemptNumber + publishMaxAttempts;
    let lastError: string | null = null;

    while (attemptNumber < lastAttempt) {
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
          publicVideoUrl: this.storageService.getPublishUrl(publication.video.storageKey),
          thumbnailUrl: publication.video.thumbnailKey
            ? this.storageService.getPublishUrl(publication.video.thumbnailKey)
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

        if (err instanceof NonRetryablePublishError) break;
        if (attemptNumber < lastAttempt && publishRetryDelaySeconds > 0) {
          await new Promise((resolve) => setTimeout(resolve, publishRetryDelaySeconds * 1000));
        }
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

  async retryPublication(publicationId: string, user: AuthenticatedUser) {
    const publication = await this.prisma.publication.findUnique({
      where: { id: publicationId },
      include: { video: { select: { clientId: true, workflowStatus: true, deletedAt: true } } },
    });
    if (!publication || publication.video.deletedAt) {
      throw new NotFoundException('Publicación no encontrada.');
    }
    await this.clientsService.assertClientAccess(publication.video.clientId, user, true);

    if (publication.status === PublicationStatus.PUBLISHED) {
      throw new ConflictException('Esta publicación ya se realizó con éxito.');
    }
    if (publication.status === PublicationStatus.PROCESSING) {
      throw new ConflictException('Esta publicación ya se está procesando.');
    }
    const ready: VideoWorkflowStatus[] = [VideoWorkflowStatus.APPROVED, VideoWorkflowStatus.SCHEDULED];
    if (!ready.includes(publication.video.workflowStatus)) {
      throw new BadRequestException('Solo los videos aprobados pueden publicarse.');
    }
    this.runInBackground([publicationId]);
    return { id: publicationId, status: PublicationStatus.PROCESSING };
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
      if (!user.agencyId) return [];
      videoFilter.client = { agencyId: user.agencyId };
    } else if (user.role === RoleCode.CLIENTE) {
      if (!user.clientId) return [];
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

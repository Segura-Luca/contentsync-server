import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClientConfirmationStatus,
  RoleCode,
  SocialPlatform,
  VideoWorkflowStatus,
} from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ClientsService } from '../clients/clients.service';
import { SettingsService } from '../settings/settings.service';
import { StorageService } from '../storage/storage.service';
import { CreateVideoDto, RequestPresignedUrlDto } from './dto/video.dto';

@Injectable()
export class VideosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
    private readonly settings: SettingsService,
  ) {}

  validateVideoSpecsForPlatforms(params: {
    mimeType: string;
    durationSeconds: number;
    sizeBytes: number;
    platforms: SocialPlatform[];
  }): void {
    const normalizedMime = params.mimeType.trim().toLowerCase();

    const limits = this.settings.current().platformLimits;
    for (const platform of params.platforms) {
      const rule = limits[platform];
      if (!rule.allowedMimeTypes.includes(normalizedMime)) {
        throw new BadRequestException(
          `Formato ${normalizedMime} no soportado por ${platform}. Permitidos: ${rule.allowedMimeTypes.join(', ')}`,
        );
      }

      if (params.durationSeconds < 1 || params.durationSeconds > rule.maxDurationSeconds) {
        throw new BadRequestException(
          `Duración de ${params.durationSeconds}s fuera del rango permitido por ${platform} (1s - ${rule.maxDurationSeconds}s).`,
        );
      }

      if (params.sizeBytes > rule.maxSizeMb * 1024 * 1024) {
        throw new BadRequestException(
          `El tamaño del archivo supera el máximo permitido por ${platform} (${rule.maxSizeMb} MB).`,
        );
      }
    }
  }

  /** "Directo" solo saltea la revisión si la plataforma no exige aprobación del cliente. */
  private initialStatus(mode: CreateVideoDto['publishMode']): VideoWorkflowStatus {
    if (mode === 'DIRECT') {
      return this.settings.current().requireClientApproval
        ? VideoWorkflowStatus.IN_REVIEW
        : VideoWorkflowStatus.APPROVED;
    }
    return mode === 'REVIEW' ? VideoWorkflowStatus.IN_REVIEW : VideoWorkflowStatus.DRAFT;
  }

  async assertCanUpload(clientId: string, user: AuthenticatedUser) {
    await this.clientsService.assertClientAccess(clientId, user, true);
  }

  async requestPresignedUpload(dto: RequestPresignedUrlDto, user: AuthenticatedUser) {
    if (user.role === RoleCode.CLIENTE) {
      throw new ForbiddenException('Solo la agencia o el administrador pueden subir videos.');
    }
    await this.clientsService.assertClientAccess(dto.clientId, user, true);

    this.validateVideoSpecsForPlatforms({
      mimeType: dto.mimeType,
      durationSeconds: dto.durationSeconds,
      sizeBytes: dto.sizeBytes,
      platforms: dto.targetPlatforms,
    });

    return this.storageService.createPresignedUploadUrl({
      clientId: dto.clientId,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
    });
  }

  async create(dto: CreateVideoDto, user: AuthenticatedUser) {
    if (user.role === RoleCode.CLIENTE) {
      throw new ForbiddenException('Solo la agencia o el administrador pueden registrar videos.');
    }
    await this.clientsService.assertClientAccess(dto.clientId, user, true);

    if (!this.storageService.isValidStorageKey(dto.storageKey, dto.clientId)) {
      throw new BadRequestException('La referencia al archivo de video no es válida.');
    }
    if (dto.thumbnailKey && !this.storageService.isValidStorageKey(dto.thumbnailKey, dto.clientId)) {
      throw new BadRequestException('La referencia a la miniatura no es válida.');
    }

    // El navegador informa la duración, pero el límite se aplica sobre la del archivo cuando se puede leer.
    const durationSeconds = (await this.storageService.probeDurationSeconds(dto.storageKey)) ?? dto.durationSeconds;
    const platforms = dto.platformTargets.map((t) => t.platform);
    this.validateVideoSpecsForPlatforms({
      mimeType: dto.mimeType,
      durationSeconds,
      sizeBytes: dto.sizeBytes,
      platforms,
    });

    const cleanTags = Array.from(
      new Set(
        dto.hashtags
          .map((tag) => tag.replace(/^#/, '').trim().toLowerCase())
          .filter((tag) => tag.length > 0),
      ),
    );

    const video = await this.prisma.video.create({
      data: {
        clientId: dto.clientId,
        uploadedByUserId: user.sub,
        title: dto.title.trim(),
        description: dto.description.trim(),
        storageKey: dto.storageKey,
        thumbnailKey: dto.thumbnailKey ?? null,
        durationSeconds,
        sizeBytes: BigInt(dto.sizeBytes),
        mimeType: dto.mimeType.trim().toLowerCase(),
        aspectRatio: dto.aspectRatio || '9:16',
        workflowStatus: this.initialStatus(dto.publishMode),
        hashtags: {
          create: cleanTags.map((tag, index) => ({
            tag,
            position: index,
          })),
        },
        platformTargets: {
          create: dto.platformTargets.map((pt) => ({
            platform: pt.platform,
            customTitle: pt.customTitle ?? null,
            customDescription: pt.customDescription ?? null,
            privacyLevel: pt.privacyLevel,
            shareToFeed: pt.shareToFeed ?? true,
            allowComments: pt.allowComments ?? true,
            allowDuetStitch: pt.allowDuetStitch ?? true,
            madeForKids: pt.madeForKids ?? false,
          })),
        },
      },
      include: {
        hashtags: { orderBy: { position: 'asc' } },
        platformTargets: true,
        client: { select: { id: true, companyName: true, agencyId: true } },
      },
    });

    await this.auditService.log({
      userId: user.sub,
      action: 'VIDEO_CREATED',
      entityType: 'Video',
      entityId: video.id,
      metadata: { clientId: video.clientId, platforms },
    });

    return {
      ...video,
      publicVideoUrl: this.storageService.getPublicUrl(video.storageKey),
    };
  }

  async findAllForUser(user: AuthenticatedUser, clientIdFilter?: string) {
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

    const whereClause: Record<string, unknown> = { deletedAt: null };
    if (clientIdFilter) {
      whereClause.clientId = clientIdFilter;
    } else if (user.role === RoleCode.AGENCIA) {
      // Con un filtro undefined, Prisma devolvería los registros de todas las agencias.
      if (!user.agencyId) return [];
      whereClause.client = { agencyId: user.agencyId };
    } else if (user.role === RoleCode.CLIENTE) {
      if (!user.clientId) return [];
      whereClause.clientId = user.clientId;
    }

    const videos = await this.prisma.video.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, companyName: true, agencyId: true } },
        hashtags: { orderBy: { position: 'asc' } },
        platformTargets: true,
        approvals: { orderBy: { createdAt: 'desc' }, take: 3 },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            authorUser: { select: { id: true, fullName: true, email: true } },
          },
        },
        publications: true,
      },
    });

    return videos.map((v) => ({
      ...v,
      publicVideoUrl: this.storageService.getPublicUrl(v.storageKey),
    }));
  }

  async findOneWithAccess(id: string, user: AuthenticatedUser) {
    const video = await this.prisma.video.findFirst({
      where: { id, deletedAt: null },
      include: {
        client: {
          select: {
            id: true,
            agencyId: true,
            companyName: true,
            industry: true,
            confirmationStatus: true,
            agency: { select: { id: true, name: true } },
            user: { select: { id: true, email: true, fullName: true } },
          },
        },
        hashtags: { orderBy: { position: 'asc' } },
        platformTargets: true,
        approvals: {
          orderBy: { createdAt: 'desc' },
          include: {
            reviewerUser: { select: { id: true, fullName: true, email: true } },
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            authorUser: { select: { id: true, fullName: true, email: true } },
          },
        },
        publications: {
          include: { attempts: { orderBy: { attemptNumber: 'asc' } } },
        },
      },
    });

    if (!video) {
      throw new NotFoundException('Video no encontrado.');
    }

    await this.clientsService.assertClientAccess(video.clientId, user);

    return {
      ...video,
      publicVideoUrl: this.storageService.getPublicUrl(video.storageKey),
    };
  }
}

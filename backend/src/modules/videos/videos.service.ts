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
import { StorageService } from '../storage/storage.service';
import { CreateVideoDto, RequestPresignedUrlDto } from './dto/video.dto';

export interface PlatformSpecRule {
  maxDurationSeconds: number;
  minDurationSeconds: number;
  maxSizeBytes: number;
  allowedMimeTypes: string[];
}

export const PLATFORM_VIDEO_SPECS: Record<SocialPlatform, PlatformSpecRule> = {
  [SocialPlatform.INSTAGRAM]: {
    minDurationSeconds: 1,
    maxDurationSeconds: 900, // 15 min para Reels
    maxSizeBytes: 1024 * 1024 * 1024, // 1 GB
    allowedMimeTypes: ['video/mp4', 'video/quicktime'],
  },
  [SocialPlatform.TIKTOK]: {
    minDurationSeconds: 1,
    maxDurationSeconds: 600, // 10 min
    maxSizeBytes: 500 * 1024 * 1024, // 500 MB
    allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
  },
  [SocialPlatform.YOUTUBE]: {
    minDurationSeconds: 1,
    maxDurationSeconds: 180, // 3 min máximo para YouTube Shorts
    maxSizeBytes: 2 * 1024 * 1024 * 1024, // 2 GB
    allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
  },
};

@Injectable()
export class VideosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
  ) {}

  validateVideoSpecsForPlatforms(params: {
    mimeType: string;
    durationSeconds: number;
    sizeBytes: number;
    platforms: SocialPlatform[];
  }): void {
    const normalizedMime = params.mimeType.trim().toLowerCase();

    for (const platform of params.platforms) {
      const rule = PLATFORM_VIDEO_SPECS[platform];
      if (!rule.allowedMimeTypes.includes(normalizedMime)) {
        throw new BadRequestException(
          `Formato ${normalizedMime} no soportado por ${platform}. Permitidos: ${rule.allowedMimeTypes.join(', ')}`,
        );
      }

      if (
        params.durationSeconds < rule.minDurationSeconds ||
        params.durationSeconds > rule.maxDurationSeconds
      ) {
        throw new BadRequestException(
          `Duración de ${params.durationSeconds}s fuera del rango permitido por ${platform} (${rule.minDurationSeconds}s - ${rule.maxDurationSeconds}s).`,
        );
      }

      if (params.sizeBytes > rule.maxSizeBytes) {
        const maxMb = Math.round(rule.maxSizeBytes / (1024 * 1024));
        throw new BadRequestException(
          `El tamaño del archivo supera el máximo permitido por ${platform} (${maxMb} MB).`,
        );
      }
    }
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

    const platforms = dto.platformTargets.map((t) => t.platform);
    this.validateVideoSpecsForPlatforms({
      mimeType: dto.mimeType,
      durationSeconds: dto.durationSeconds,
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
        durationSeconds: dto.durationSeconds,
        sizeBytes: BigInt(dto.sizeBytes),
        mimeType: dto.mimeType.trim().toLowerCase(),
        aspectRatio: dto.aspectRatio || '9:16',
        workflowStatus:
          dto.publishMode === 'DIRECT'
            ? VideoWorkflowStatus.APPROVED
            : dto.publishMode === 'REVIEW'
              ? VideoWorkflowStatus.IN_REVIEW
              : VideoWorkflowStatus.DRAFT,
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
      whereClause.client = { agencyId: user.agencyId };
    } else if (user.role === RoleCode.CLIENTE) {
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
          include: {
            agency: true,
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

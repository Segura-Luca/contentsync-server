import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalDecision,
  BlockReviewStatus,
  ClientConfirmationStatus,
  NotificationType,
  RoleCode,
  ScheduleStatus,
} from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ClientsService } from '../clients/clients.service';
import { NotificationsService } from '../notifications/notifications.service';
import { mediaFormatFromKey } from '../storage/media-format';
import { StorageService } from '../storage/storage.service';
import {
  AddBlockCommentDto,
  BlockMediaInputDto,
  CreateScheduleBlockDto,
  CreateScheduleDto,
  DuplicateScheduleDto,
  ReviewBlockDto,
  UpdateScheduleBlockDto,
} from './dto/schedule-approval.dto';

const REVIEW_STATUS: Record<ApprovalDecision, BlockReviewStatus> = {
  [ApprovalDecision.APPROVED]: BlockReviewStatus.APPROVED,
  [ApprovalDecision.CHANGES_REQUESTED]: BlockReviewStatus.CHANGES_REQUESTED,
  [ApprovalDecision.REJECTED]: BlockReviewStatus.REJECTED,
};

const REVIEW_NOTIFICATION: Record<ApprovalDecision, { type: NotificationType; verb: string }> = {
  [ApprovalDecision.APPROVED]: { type: NotificationType.BLOCK_APPROVED, verb: 'aprobó' },
  [ApprovalDecision.CHANGES_REQUESTED]: { type: NotificationType.BLOCK_CHANGES_REQUESTED, verb: 'pidió cambios en' },
  [ApprovalDecision.REJECTED]: { type: NotificationType.BLOCK_REJECTED, verb: 'rechazó' },
};

/** Volver a pedir la confirmación del cliente: lo que confirmó ya no es lo que hay en el cronograma. */
const REOPEN_SCHEDULE = { status: ScheduleStatus.IN_REVIEW, confirmedAt: null, confirmedByUserId: null };

const blockInclude = {
  media: { orderBy: { position: 'asc' as const } },
  reviews: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  comments: {
    orderBy: { createdAt: 'asc' as const },
    include: { authorUser: { select: { id: true, fullName: true } } },
  },
};

const scheduleInclude = {
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
    select: { id: true, title: true, weekStartDate: true, weekEndDate: true },
  },
  confirmedByUser: { select: { id: true, fullName: true } },
  items: {
    orderBy: [
      { dayOfWeek: 'asc' as const },
      { plannedTime: 'asc' as const },
      { sortOrder: 'asc' as const },
    ],
    include: blockInclude,
  },
};

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly storageService: StorageService,
  ) {}

  private assertMonday(date: Date): void {
    if (Number.isNaN(date.getTime()) || date.getUTCDay() !== 1) {
      throw new BadRequestException('La semana del plan debe comenzar un lunes.');
    }
  }

  private assertCanEdit(user: AuthenticatedUser): void {
    if (user.role === RoleCode.CLIENTE) {
      throw new ForbiddenException('Solo la agencia o el administrador pueden modificar el cronograma.');
    }
  }

  /** La decisión es del cliente: si la agencia pudiera aprobar su propio contenido, el control no existiría. */
  private assertCanReview(user: AuthenticatedUser): void {
    if (user.role === RoleCode.AGENCIA) {
      throw new ForbiddenException('La aprobación corresponde al cliente: la agencia puede dejar comentarios.');
    }
  }

  /** Agrega a cada foto o video el enlace para verlo dentro de la plataforma. */
  private async withBlockMediaUrls<T extends { media?: Array<{ storageKey: string }> }>(block: T): Promise<T> {
    await Promise.all(
      (block.media ?? []).map(async (media: any) => {
        media.url = await this.storageService.getMediaUrl(media.storageKey);
      }),
    );
    return block;
  }

  private async withMediaUrls<T extends { items?: Array<{ media?: Array<{ storageKey: string }> }> }>(schedule: T): Promise<T> {
    await Promise.all((schedule.items ?? []).map((item) => this.withBlockMediaUrls(item)));
    return schedule;
  }

  /** El tipo y el formato los deduce el servidor de la clave: no se confía en lo que declare el navegador. */
  private mediaRows(media: BlockMediaInputDto[], clientId: string) {
    return media.map((item, position) => {
      const format = mediaFormatFromKey(item.storageKey);
      if (!format || !this.storageService.isValidStorageKey(item.storageKey, clientId)) {
        throw new BadRequestException('Uno de los archivos no es válido. Volvé a subirlo.');
      }
      return {
        kind: format.kind,
        mimeType: format.mimeType,
        storageKey: item.storageKey,
        sizeBytes: BigInt(item.sizeBytes ?? 0),
        originalName: item.originalName?.trim().slice(0, 255) || null,
        description: item.description?.trim() || null,
        position,
      };
    });
  }

  private async findBlockOrThrow(blockId: string) {
    const block = await this.prisma.scheduleItem.findUnique({
      where: { id: blockId },
      include: {
        media: { orderBy: { position: 'asc' } },
        schedule: { include: { client: { include: { agency: { select: { ownerUserId: true } } } } } },
      },
    });
    if (!block) {
      throw new NotFoundException('Bloque no encontrado.');
    }
    return block;
  }

  async createSchedule(dto: CreateScheduleDto, user: AuthenticatedUser) {
    this.assertCanEdit(user);

    const client = await this.clientsService.assertClientAccess(dto.clientId, user, true);
    const startDate = new Date(dto.weekStartDate);
    const endDate = new Date(dto.weekEndDate);

    this.assertMonday(startDate);
    if (endDate < startDate) {
      throw new BadRequestException('La fecha de fin de semana no puede ser anterior a la fecha de inicio.');
    }

    const existing = await this.prisma.schedule.findUnique({
      where: { clientId_weekStartDate: { clientId: dto.clientId, weekStartDate: startDate } },
    });
    if (existing) {
      throw new ConflictException('Ya existe un cronograma para este cliente en esa semana. Podés elegir otro lunes.');
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
      include: scheduleInclude,
    });

    await this.notificationsService.notifyUser({
      userId: client.userId,
      type: NotificationType.NEW_SCHEDULE,
      title: 'Nuevo cronograma para revisar',
      body: `Tu agencia compartió el cronograma "${schedule.title}".`,
      referenceId: schedule.id,
    });

    await this.auditService.log({
      userId: user.sub,
      action: 'SCHEDULE_CREATED',
      entityType: 'Schedule',
      entityId: schedule.id,
      metadata: { clientId: dto.clientId, weekStartDate: dto.weekStartDate },
    });

    return this.withMediaUrls(schedule);
  }

  async createBlock(scheduleId: string, dto: CreateScheduleBlockDto, user: AuthenticatedUser) {
    this.assertCanEdit(user);

    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: { client: true },
    });
    if (!schedule) {
      throw new NotFoundException('Cronograma no encontrado.');
    }
    await this.clientsService.assertClientAccess(schedule.clientId, user, true);

    const media = this.mediaRows(dto.media ?? [], schedule.clientId);
    const sortOrder = await this.prisma.scheduleItem.count({
      where: { scheduleId, dayOfWeek: dto.dayOfWeek },
    });

    const [block] = await this.prisma.$transaction([
      this.prisma.scheduleItem.create({
        data: {
          scheduleId,
          dayOfWeek: dto.dayOfWeek,
          contentType: dto.contentType,
          blockTitle: dto.blockTitle.trim(),
          noteColor: (dto.noteColor || 'AMBER').trim().toUpperCase(),
          notes: dto.notes?.trim() || null,
          caption: dto.caption?.trim() || null,
          productionStatus: dto.productionStatus,
          plannedTime: dto.plannedTime || '18:00',
          sortOrder,
          media: { create: media },
        },
        include: blockInclude,
      }),
      // Un cronograma confirmado cambió: el cliente tiene que volver a verlo.
      this.prisma.schedule.update({
        where: { id: scheduleId },
        data: schedule.status === ScheduleStatus.APPROVED ? REOPEN_SCHEDULE : {},
      }),
    ]);

    await this.notificationsService.notifyUser({
      userId: schedule.client.userId,
      type: NotificationType.BLOCK_IN_REVIEW,
      title: 'Nuevo contenido para revisar',
      body: `Se agregó "${block.blockTitle}" al cronograma "${schedule.title}".`,
      referenceId: block.id,
    });

    await this.auditService.log({
      userId: user.sub,
      action: 'SCHEDULE_BLOCK_CREATED',
      entityType: 'ScheduleItem',
      entityId: block.id,
      metadata: { scheduleId, dayOfWeek: dto.dayOfWeek, contentType: dto.contentType, mediaCount: media.length },
    });

    return this.withBlockMediaUrls(block);
  }

  /**
   * Si cambia algo que el cliente aprueba, el bloque vuelve a revisión. El color y el estado de producción
   * no cuentan: son el avance del trabajo, no el contenido.
   */
  async updateBlock(blockId: string, dto: UpdateScheduleBlockDto, user: AuthenticatedUser) {
    this.assertCanEdit(user);

    const existing = await this.findBlockOrThrow(blockId);
    const schedule = existing.schedule;
    await this.clientsService.assertClientAccess(schedule.clientId, user, true);

    const media = dto.media ? this.mediaRows(dto.media, schedule.clientId) : null;
    const next = {
      dayOfWeek: dto.dayOfWeek ?? existing.dayOfWeek,
      contentType: dto.contentType ?? existing.contentType,
      blockTitle: dto.blockTitle?.trim() ?? existing.blockTitle,
      notes: dto.notes !== undefined ? dto.notes.trim() || null : existing.notes,
      caption: dto.caption !== undefined ? dto.caption.trim() || null : existing.caption,
      plannedTime: dto.plannedTime ?? existing.plannedTime,
    };
    const signature = (rows: Array<{ storageKey: string; description: string | null }>) =>
      JSON.stringify(rows.map((row) => [row.storageKey, row.description]));
    const contentChanged =
      (Object.keys(next) as Array<keyof typeof next>).some((key) => next[key] !== existing[key]) ||
      (media !== null && signature(media) !== signature(existing.media));

    const block = await this.prisma.$transaction(async (tx) => {
      if (media) {
        await tx.scheduleItemMedia.deleteMany({ where: { scheduleItemId: blockId } });
        await tx.scheduleItemMedia.createMany({
          data: media.map((row) => ({ ...row, scheduleItemId: blockId })),
        });
      }
      if (contentChanged && schedule.status === ScheduleStatus.APPROVED) {
        await tx.schedule.update({ where: { id: schedule.id }, data: REOPEN_SCHEDULE });
      }
      return tx.scheduleItem.update({
        where: { id: blockId },
        data: {
          ...next,
          noteColor: dto.noteColor?.trim().toUpperCase() ?? existing.noteColor,
          productionStatus: dto.productionStatus ?? existing.productionStatus,
          ...(contentChanged ? { reviewStatus: BlockReviewStatus.IN_REVIEW } : {}),
        },
        include: blockInclude,
      });
    });

    if (media) {
      const kept = new Set(media.map((row) => row.storageKey));
      await this.storageService.deleteIfUnused(
        existing.media.map((row) => row.storageKey).filter((key) => !kept.has(key)),
      );
    }

    if (contentChanged) {
      await this.notificationsService.notifyUser({
        userId: schedule.client.userId,
        type: NotificationType.BLOCK_IN_REVIEW,
        title: 'Contenido actualizado para revisar',
        body: `Tu agencia actualizó "${block.blockTitle}" en el cronograma "${schedule.title}".`,
        referenceId: block.id,
      });
    }

    await this.auditService.log({
      userId: user.sub,
      action: 'SCHEDULE_BLOCK_UPDATED',
      entityType: 'ScheduleItem',
      entityId: blockId,
      metadata: { scheduleId: schedule.id, contentChanged },
    });

    return this.withBlockMediaUrls(block);
  }

  async deleteBlock(blockId: string, user: AuthenticatedUser) {
    this.assertCanEdit(user);

    const existing = await this.findBlockOrThrow(blockId);
    await this.clientsService.assertClientAccess(existing.schedule.clientId, user);

    await this.prisma.scheduleItem.delete({ where: { id: blockId } });
    await this.storageService.deleteIfUnused(existing.media.map((row) => row.storageKey));

    await this.auditService.log({
      userId: user.sub,
      action: 'SCHEDULE_BLOCK_DELETED',
      entityType: 'ScheduleItem',
      entityId: blockId,
    });

    return { message: 'Bloque eliminado del cronograma.', id: blockId };
  }

  /**
   * Duplica una semana completa. Los bloques copiados vuelven a revisión y a estado pendiente:
   * el cliente no aprobó esta semana ni se produjo todavía.
   */
  async duplicateSchedule(sourceScheduleId: string, dto: DuplicateScheduleDto, user: AuthenticatedUser) {
    this.assertCanEdit(user);

    const source = await this.prisma.schedule.findUnique({
      where: { id: sourceScheduleId },
      include: {
        client: true,
        items: {
          orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }],
          include: { media: { orderBy: { position: 'asc' } } },
        },
      },
    });
    if (!source) {
      throw new NotFoundException('Semana de origen no encontrada.');
    }
    await this.clientsService.assertClientAccess(source.clientId, user, true);

    const targetStart = new Date(dto.targetWeekStartDate);
    this.assertMonday(targetStart);
    const targetEnd = new Date(targetStart.getTime() + 6 * 24 * 60 * 60 * 1000);

    const clash = await this.prisma.schedule.findUnique({
      where: { clientId_weekStartDate: { clientId: source.clientId, weekStartDate: targetStart } },
    });
    if (clash) {
      throw new ConflictException('Ya existe un cronograma en esa fecha para este cliente. Elegí otra semana.');
    }

    const includeMedia = dto.includeMedia ?? false;
    const newTitle = dto.title?.trim() || `${source.title} (Duplicada)`;

    // Todo o nada: una falla a mitad de camino no debe dejar una semana copiada a medias.
    const createdTarget = await this.prisma.$transaction(async (tx) => {
      const createdTarget = await tx.schedule.create({
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

      for (const item of source.items) {
        await tx.scheduleItem.create({
          data: {
            scheduleId: createdTarget.id,
            dayOfWeek: item.dayOfWeek,
            contentType: item.contentType,
            blockTitle: item.blockTitle,
            noteColor: item.noteColor,
            notes: item.notes,
            caption: item.caption,
            plannedTime: item.plannedTime,
            sortOrder: item.sortOrder,
            media: includeMedia
              ? {
                  create: item.media.map((row) => ({
                    kind: row.kind,
                    storageKey: row.storageKey,
                    mimeType: row.mimeType,
                    sizeBytes: row.sizeBytes,
                    originalName: row.originalName,
                    description: row.description,
                    position: row.position,
                  })),
                }
              : undefined,
          },
        });
      }

      return createdTarget;
    });

    await this.notificationsService.notifyUser({
      userId: source.client.userId,
      type: NotificationType.SCHEDULE_DUPLICATED,
      title: 'Nuevo cronograma para revisar',
      body: `Tu agencia compartió el cronograma "${newTitle}" con ${source.items.length} bloques.`,
      referenceId: createdTarget.id,
    });

    await this.auditService.log({
      userId: user.sub,
      action: 'SCHEDULE_DUPLICATED',
      entityType: 'Schedule',
      entityId: createdTarget.id,
      metadata: { sourceScheduleId: source.id, blocksCopiedCount: source.items.length, includeMedia },
    });

    const fullSchedule = await this.prisma.schedule.findUniqueOrThrow({
      where: { id: createdTarget.id },
      include: scheduleInclude,
    });

    return { schedule: await this.withMediaUrls(fullSchedule) };
  }

  async listSchedules(user: AuthenticatedUser, clientIdFilter?: string) {
    if (clientIdFilter) {
      await this.clientsService.assertClientAccess(clientIdFilter, user);
    }

    if (user.role === RoleCode.CLIENTE && user.clientId) {
      const client = await this.prisma.client.findUnique({ where: { id: user.clientId } });
      if (!client || client.confirmationStatus !== ClientConfirmationStatus.CONFIRMED) {
        return [];
      }
    }

    const where: Record<string, unknown> = { client: { deletedAt: null } };
    if (clientIdFilter) {
      where.clientId = clientIdFilter;
    } else if (user.role === RoleCode.AGENCIA) {
      if (!user.agencyId) return [];
      where.client = { agencyId: user.agencyId, deletedAt: null };
    } else if (user.role === RoleCode.CLIENTE) {
      if (!user.clientId) return [];
      where.clientId = user.clientId;
    }

    const schedules = await this.prisma.schedule.findMany({
      where,
      orderBy: { weekStartDate: 'desc' },
      include: scheduleInclude,
    });

    return Promise.all(schedules.map((schedule) => this.withMediaUrls(schedule)));
  }

  async reviewBlock(blockId: string, dto: ReviewBlockDto, user: AuthenticatedUser) {
    this.assertCanReview(user);

    const block = await this.findBlockOrThrow(blockId);
    const schedule = block.schedule;
    await this.clientsService.assertClientAccess(schedule.clientId, user);

    const feedback = dto.feedbackNotes?.trim() || null;
    if (dto.decision !== ApprovalDecision.APPROVED && (!feedback || feedback.length < 3)) {
      throw new BadRequestException('Contá brevemente qué cambiarías o por qué lo rechazás.');
    }

    const reviewStatus = REVIEW_STATUS[dto.decision];
    const operations: any[] = [
      this.prisma.blockReview.create({
        data: { scheduleItemId: blockId, reviewerUserId: user.sub, decision: dto.decision, feedbackNotes: feedback },
      }),
      this.prisma.scheduleItem.update({ where: { id: blockId }, data: { reviewStatus } }),
    ];
    if (feedback) {
      operations.push(
        this.prisma.blockComment.create({
          data: { scheduleItemId: blockId, authorUserId: user.sub, message: feedback },
        }),
      );
    }
    // Pedir cambios sobre una semana ya confirmada la vuelve a abrir.
    if (dto.decision !== ApprovalDecision.APPROVED && schedule.status === ScheduleStatus.APPROVED) {
      operations.push(this.prisma.schedule.update({ where: { id: schedule.id }, data: REOPEN_SCHEDULE }));
    }
    await this.prisma.$transaction(operations);

    const notification = REVIEW_NOTIFICATION[dto.decision];
    await this.notificationsService.notifyUser({
      userId: schedule.client.agency.ownerUserId,
      type: notification.type,
      title: `${schedule.client.companyName} ${notification.verb} un contenido`,
      body: feedback ? `"${block.blockTitle}": ${feedback}` : `"${block.blockTitle}" del cronograma "${schedule.title}".`,
      referenceId: blockId,
    });

    await this.auditService.log({
      userId: user.sub,
      action: `BLOCK_REVIEW_${dto.decision}`,
      entityType: 'ScheduleItem',
      entityId: blockId,
      metadata: { scheduleId: schedule.id },
    });

    return { id: blockId, reviewStatus };
  }

  /**
   * El cliente da el visto bueno a la semana entera. No se puede confirmar con pedidos de cambio
   * abiertos; lo que todavía esté en revisión queda aprobado con la confirmación.
   */
  async confirmSchedule(scheduleId: string, user: AuthenticatedUser) {
    this.assertCanReview(user);

    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        items: true,
        client: { include: { agency: { select: { ownerUserId: true } } } },
      },
    });
    if (!schedule) {
      throw new NotFoundException('Cronograma no encontrado.');
    }
    await this.clientsService.assertClientAccess(schedule.clientId, user, true);

    if (schedule.status === ScheduleStatus.APPROVED) {
      return { id: schedule.id, status: schedule.status, confirmedAt: schedule.confirmedAt };
    }
    if (schedule.items.length === 0) {
      throw new BadRequestException('Este cronograma todavía no tiene contenido para confirmar.');
    }
    const open = schedule.items.filter(
      (item) => item.reviewStatus === BlockReviewStatus.CHANGES_REQUESTED || item.reviewStatus === BlockReviewStatus.REJECTED,
    );
    if (open.length > 0) {
      throw new BadRequestException(
        `Hay ${open.length === 1 ? 'un bloque' : `${open.length} bloques`} con cambios pendientes: la agencia tiene que resolverlos antes de confirmar.`,
      );
    }

    const pending = schedule.items.filter((item) => item.reviewStatus === BlockReviewStatus.IN_REVIEW);
    const confirmedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.blockReview.createMany({
        data: pending.map((item) => ({
          scheduleItemId: item.id,
          reviewerUserId: user.sub,
          decision: ApprovalDecision.APPROVED,
        })),
      }),
      this.prisma.scheduleItem.updateMany({
        where: { id: { in: pending.map((item) => item.id) } },
        data: { reviewStatus: BlockReviewStatus.APPROVED },
      }),
      this.prisma.schedule.update({
        where: { id: scheduleId },
        data: { status: ScheduleStatus.APPROVED, confirmedAt, confirmedByUserId: user.sub },
      }),
    ]);

    await this.notificationsService.notifyUser({
      userId: schedule.client.agency.ownerUserId,
      type: NotificationType.SCHEDULE_CONFIRMED,
      title: `${schedule.client.companyName} confirmó el cronograma`,
      body: `El cronograma "${schedule.title}" quedó confirmado.`,
      referenceId: schedule.id,
    });

    await this.auditService.log({
      userId: user.sub,
      action: 'SCHEDULE_CONFIRMED',
      entityType: 'Schedule',
      entityId: schedule.id,
      metadata: { approvedWithConfirmation: pending.length },
    });

    return { id: schedule.id, status: ScheduleStatus.APPROVED, confirmedAt };
  }

  /** Cada comentario le avisa a la otra parte: es el canal de comunicación entre agencia y cliente. */
  async addComment(blockId: string, dto: AddBlockCommentDto, user: AuthenticatedUser) {
    const block = await this.findBlockOrThrow(blockId);
    const schedule = block.schedule;
    await this.clientsService.assertClientAccess(schedule.clientId, user);

    const message = dto.message.trim();
    if (!message) {
      throw new BadRequestException('Escribí un comentario.');
    }

    const comment = await this.prisma.blockComment.create({
      data: { scheduleItemId: blockId, authorUserId: user.sub, message },
      include: { authorUser: { select: { id: true, fullName: true } } },
    });

    await this.notificationsService.notifyUser({
      userId: user.role === RoleCode.CLIENTE ? schedule.client.agency.ownerUserId : schedule.client.userId,
      type: NotificationType.BLOCK_COMMENT,
      title: `Nuevo comentario en "${block.blockTitle}"`,
      body: `${comment.authorUser.fullName}: ${message}`,
      referenceId: blockId,
    });

    return comment;
  }
}

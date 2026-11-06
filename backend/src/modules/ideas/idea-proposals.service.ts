import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IdeaProposalStatus, NotificationType, RoleCode } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AcceptIdeaProposalDto, CreateIdeaProposalDto } from './dto/idea-proposal.dto';

const proposalInclude = { client: { select: { id: true, companyName: true, userId: true } } };

@Injectable()
export class IdeaProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  private requireText(value: string | undefined, message: string): string {
    const clean = value?.trim();
    if (!clean) throw new BadRequestException(message);
    return clean;
  }

  async list(user: AuthenticatedUser) {
    const scope =
      user.role === RoleCode.CLIENTE
        ? { clientId: user.clientId ?? '' }
        : user.role === RoleCode.AGENCIA
          ? { agencyId: user.agencyId ?? '' }
          : {};

    return this.prisma.clientIdeaProposal.findMany({
      where: { ...scope, client: { deletedAt: null } },
      orderBy: { createdAt: 'desc' },
      include: proposalInclude,
    });
  }

  async create(dto: CreateIdeaProposalDto, user: AuthenticatedUser) {
    const client = await this.prisma.client.findFirst({
      where: { id: user.clientId ?? '', deletedAt: null },
      include: { agency: { select: { ownerUserId: true } } },
    });
    if (!client) {
      throw new ForbiddenException('Tu cuenta no tiene una marca vinculada.');
    }

    const proposal = await this.prisma.clientIdeaProposal.create({
      data: {
        agencyId: client.agencyId,
        clientId: client.id,
        title: this.requireText(dto.title, 'Escribile un título a tu idea.'),
        content: this.requireText(dto.content, 'Contá de qué se trata tu idea.'),
        referenceUrl: dto.referenceUrl?.trim() || null,
      },
      include: proposalInclude,
    });

    await this.notificationsService.notifyUser({
      userId: client.agency.ownerUserId,
      type: NotificationType.IDEA_PROPOSED,
      title: `${client.companyName} te propuso una idea`,
      body: `"${proposal.title}". Respondela en Ideas de contenido.`,
      referenceId: proposal.id,
    });

    return proposal;
  }

  private async findPendingForAgency(id: string, user: AuthenticatedUser) {
    const proposal = await this.prisma.clientIdeaProposal.findUnique({
      where: { id },
      include: proposalInclude,
    });
    if (!proposal) {
      throw new NotFoundException('Propuesta no encontrada.');
    }
    if (user.role === RoleCode.AGENCIA && proposal.agencyId !== user.agencyId) {
      throw new ForbiddenException('Esa propuesta es de otra agencia.');
    }
    if (proposal.status !== IdeaProposalStatus.PENDING) {
      throw new ConflictException('Esa propuesta ya fue respondida.');
    }
    return proposal;
  }

  async accept(id: string, dto: AcceptIdeaProposalDto, user: AuthenticatedUser) {
    const proposal = await this.findPendingForAgency(id, user);

    const section = await this.prisma.contentIdeaSection.findUnique({ where: { id: dto.sectionId } });
    if (!section || section.agencyId !== proposal.agencyId) {
      throw new BadRequestException('La sección seleccionada no pertenece a tu agencia.');
    }

    const title = this.requireText(dto.title ?? proposal.title, 'Escribile un título a la idea.');
    const content = this.requireText(dto.content ?? proposal.content, 'Completá el desarrollo de la idea.');
    const referenceUrl = dto.referenceUrl === undefined ? proposal.referenceUrl : dto.referenceUrl.trim() || null;

    // Dos respuestas casi juntas no deben crear la idea dos veces: gana la primera.
    const idea = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.clientIdeaProposal.updateMany({
        where: { id, status: IdeaProposalStatus.PENDING },
        data: { status: IdeaProposalStatus.ACCEPTED, title, content, referenceUrl, respondedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('Esa propuesta ya fue respondida.');
      }
      return tx.contentIdea.create({
        data: {
          agencyId: proposal.agencyId,
          sectionId: section.id,
          clientId: proposal.clientId,
          createdByUserId: user.sub,
          title,
          content,
          referenceUrl,
        },
      });
    });

    await this.notificationsService.notifyUser({
      userId: proposal.client.userId,
      type: NotificationType.IDEA_ACCEPTED,
      title: 'Tu agencia aceptó tu idea',
      body: `"${title}"`,
      referenceId: proposal.id,
    });
    await this.auditService.log({
      userId: user.sub,
      action: 'IDEA_PROPOSAL_ACCEPTED',
      entityType: 'ClientIdeaProposal',
      entityId: proposal.id,
      metadata: { ideaId: idea.id },
    });

    return idea;
  }

  async reject(id: string, user: AuthenticatedUser) {
    const proposal = await this.findPendingForAgency(id, user);

    const claimed = await this.prisma.clientIdeaProposal.updateMany({
      where: { id, status: IdeaProposalStatus.PENDING },
      data: { status: IdeaProposalStatus.REJECTED, respondedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new ConflictException('Esa propuesta ya fue respondida.');
    }

    await this.notificationsService.notifyUser({
      userId: proposal.client.userId,
      type: NotificationType.IDEA_REJECTED,
      title: 'Tu agencia rechazó tu idea',
      body: `"${proposal.title}"`,
      referenceId: proposal.id,
    });
    await this.auditService.log({
      userId: user.sub,
      action: 'IDEA_PROPOSAL_REJECTED',
      entityType: 'ClientIdeaProposal',
      entityId: proposal.id,
    });

    return { id: proposal.id, status: IdeaProposalStatus.REJECTED };
  }
}

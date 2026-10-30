import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateContentIdeaDto,
  CreateIdeaSectionDto,
  UpdateContentIdeaDto,
  UpdateIdeaSectionDto,
} from './dto/idea.dto';

const DEFAULT_SECTIONS = [
  { name: 'Entretenimiento', color: 'ROSE', sortOrder: 0 },
  { name: 'Educativo', color: 'SKY', sortOrder: 1 },
  { name: 'Venta', color: 'EMERALD', sortOrder: 2 },
];

@Injectable()
export class IdeasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async resolveAgencyId(
    user: AuthenticatedUser,
    explicitAgencyId?: string,
  ): Promise<string> {
    if (user.role === RoleCode.CLIENTE) {
      throw new ForbiddenException(
        'Las ideas de contenido son privadas y exclusivas de la agencia.',
      );
    }

    if (user.role === RoleCode.AGENCIA) {
      if (!user.agencyId) {
        throw new ForbiddenException('Tu cuenta no tiene una agencia vinculada.');
      }
      return user.agencyId;
    }

    if (explicitAgencyId) {
      return explicitAgencyId;
    }

    const firstAgency = await this.prisma.agency.findFirst({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (!firstAgency) {
      throw new BadRequestException('No hay agencias registradas.');
    }
    return firstAgency.id;
  }

  /**
   * Inicializa las secciones base (Entretenimiento, Educativo, Venta) una única vez por agencia.
   */
  private async ensureDefaultSectionsOnce(agencyId: string, userId: string) {
    const existingCount = await this.prisma.contentIdeaSection.count({
      where: { agencyId },
    });
    if (existingCount > 0) return;

    const alreadyInitialized = await this.prisma.auditLog.findFirst({
      where: {
        action: 'IDEA_SECTIONS_INITIALIZED',
        entityType: 'Agency',
        entityId: agencyId,
      },
    });
    if (alreadyInitialized) return;

    await this.prisma.contentIdeaSection.createMany({
      data: DEFAULT_SECTIONS.map((s) => ({
        agencyId,
        name: s.name,
        color: s.color,
        sortOrder: s.sortOrder,
      })),
      skipDuplicates: true,
    });

    await this.auditService.log({
      userId,
      action: 'IDEA_SECTIONS_INITIALIZED',
      entityType: 'Agency',
      entityId: agencyId,
    });
  }

  async listSections(user: AuthenticatedUser, agencyIdQuery?: string) {
    const agencyId = await this.resolveAgencyId(user, agencyIdQuery);
    await this.ensureDefaultSectionsOnce(agencyId, user.sub);

    return this.prisma.contentIdeaSection.findMany({
      where: { agencyId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: {
          select: { ideas: true },
        },
      },
    });
  }

  async createSection(dto: CreateIdeaSectionDto, user: AuthenticatedUser) {
    const agencyId = await this.resolveAgencyId(user, dto.agencyId);
    const cleanName = dto.name.trim();

    const dup = await this.prisma.contentIdeaSection.findUnique({
      where: {
        agencyId_name: {
          agencyId,
          name: cleanName,
        },
      },
    });
    if (dup) {
      throw new ConflictException(`Ya existe una sección llamada "${cleanName}".`);
    }

    const count = await this.prisma.contentIdeaSection.count({
      where: { agencyId },
    });

    const section = await this.prisma.contentIdeaSection.create({
      data: {
        agencyId,
        name: cleanName,
        color: dto.color?.trim().toUpperCase() || 'LIME',
        sortOrder: count,
      },
      include: {
        _count: { select: { ideas: true } },
      },
    });

    await this.auditService.log({
      userId: user.sub,
      action: 'IDEA_SECTION_CREATED',
      entityType: 'ContentIdeaSection',
      entityId: section.id,
      metadata: { name: section.name, agencyId },
    });

    return section;
  }

  async updateSection(
    id: string,
    dto: UpdateIdeaSectionDto,
    user: AuthenticatedUser,
  ) {
    const section = await this.prisma.contentIdeaSection.findUnique({
      where: { id },
    });
    if (!section) {
      throw new NotFoundException('Sección no encontrada.');
    }
    if (user.role === RoleCode.AGENCIA && section.agencyId !== user.agencyId) {
      throw new ForbiddenException('No tienes permiso sobre esta sección.');
    }

    return this.prisma.contentIdeaSection.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        color: dto.color?.trim().toUpperCase(),
      },
      include: {
        _count: { select: { ideas: true } },
      },
    });
  }

  async deleteSection(id: string, user: AuthenticatedUser) {
    const section = await this.prisma.contentIdeaSection.findUnique({
      where: { id },
    });
    if (!section) {
      throw new NotFoundException('Sección no encontrada.');
    }
    if (user.role === RoleCode.AGENCIA && section.agencyId !== user.agencyId) {
      throw new ForbiddenException('No tienes permiso sobre esta sección.');
    }

    await this.prisma.contentIdeaSection.delete({
      where: { id },
    });

    await this.auditService.log({
      userId: user.sub,
      action: 'IDEA_SECTION_DELETED',
      entityType: 'ContentIdeaSection',
      entityId: id,
      metadata: { name: section.name },
    });

    return { message: 'Sección eliminada correctamente.', id };
  }

  async listIdeas(
    user: AuthenticatedUser,
    filters: {
      agencyId?: string;
      sectionId?: string;
      clientId?: string;
      search?: string;
    },
  ) {
    const agencyId = await this.resolveAgencyId(user, filters.agencyId);
    await this.ensureDefaultSectionsOnce(agencyId, user.sub);

    const where: Record<string, unknown> = { agencyId };

    if (filters.sectionId) {
      where.sectionId = filters.sectionId;
    }

    if (filters.clientId === 'GENERAL') {
      where.clientId = null;
    } else if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    if (filters.search?.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { title: { contains: q } },
        { content: { contains: q } },
      ];
    }

    return this.prisma.contentIdea.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        section: true,
        client: { select: { id: true, companyName: true } },
        createdByUser: { select: { id: true, fullName: true } },
      },
    });
  }

  async createIdea(dto: CreateContentIdeaDto, user: AuthenticatedUser) {
    const agencyId = await this.resolveAgencyId(user, dto.agencyId);

    const section = await this.prisma.contentIdeaSection.findUnique({
      where: { id: dto.sectionId },
    });
    if (!section || section.agencyId !== agencyId) {
      throw new BadRequestException(
        'La sección seleccionada no pertenece a tu agencia.',
      );
    }

    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, agencyId, deletedAt: null },
      });
      if (!client) {
        throw new BadRequestException('El cliente seleccionado no pertenece a tu agencia.');
      }
    }

    const idea = await this.prisma.contentIdea.create({
      data: {
        agencyId,
        sectionId: dto.sectionId,
        clientId: dto.clientId || null,
        createdByUserId: user.sub,
        title: dto.title.trim(),
        content: dto.content.trim(),
        referenceUrl: dto.referenceUrl?.trim() || null,
        platforms: dto.platforms?.trim() || 'INSTAGRAM,TIKTOK,YOUTUBE',
        isPinned: dto.isPinned ?? false,
      },
      include: {
        section: true,
        client: { select: { id: true, companyName: true } },
        createdByUser: { select: { id: true, fullName: true } },
      },
    });

    await this.auditService.log({
      userId: user.sub,
      action: 'CONTENT_IDEA_CREATED',
      entityType: 'ContentIdea',
      entityId: idea.id,
      metadata: { section: section.name, title: idea.title },
    });

    return idea;
  }

  async updateIdea(
    id: string,
    dto: UpdateContentIdeaDto,
    user: AuthenticatedUser,
  ) {
    const idea = await this.prisma.contentIdea.findUnique({ where: { id } });
    if (!idea) {
      throw new NotFoundException('Idea de contenido no encontrada.');
    }
    if (user.role === RoleCode.AGENCIA && idea.agencyId !== user.agencyId) {
      throw new ForbiddenException('No tienes acceso a esta idea privada.');
    }

    if (dto.sectionId) {
      const section = await this.prisma.contentIdeaSection.findUnique({
        where: { id: dto.sectionId },
      });
      if (!section || section.agencyId !== idea.agencyId) {
        throw new BadRequestException('Sección inválida.');
      }
    }

    return this.prisma.contentIdea.update({
      where: { id },
      data: {
        sectionId: dto.sectionId,
        clientId: dto.clientId === undefined ? undefined : dto.clientId || null,
        title: dto.title?.trim(),
        content: dto.content?.trim(),
        referenceUrl:
          dto.referenceUrl === undefined
            ? undefined
            : dto.referenceUrl?.trim() || null,
        platforms: dto.platforms?.trim(),
        isPinned: dto.isPinned,
      },
      include: {
        section: true,
        client: { select: { id: true, companyName: true } },
        createdByUser: { select: { id: true, fullName: true } },
      },
    });
  }

  async deleteIdea(id: string, user: AuthenticatedUser) {
    const idea = await this.prisma.contentIdea.findUnique({ where: { id } });
    if (!idea) {
      throw new NotFoundException('Idea de contenido no encontrada.');
    }
    if (user.role === RoleCode.AGENCIA && idea.agencyId !== user.agencyId) {
      throw new ForbiddenException('No tienes permiso para eliminar esta idea.');
    }

    await this.prisma.contentIdea.delete({ where: { id } });

    await this.auditService.log({
      userId: user.sub,
      action: 'CONTENT_IDEA_DELETED',
      entityType: 'ContentIdea',
      entityId: id,
      metadata: { title: idea.title },
    });

    return { message: 'Idea eliminada correctamente.', id };
  }
}

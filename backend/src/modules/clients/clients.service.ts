import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Lista clientes aplicando estricto control de acceso por rol y pertenencia:
   * - ADMIN_GENERAL: ve todos los clientes de todas las agencias.
   * - AGENCIA: ve únicamente los clientes creados por su propia agencia.
   * - CLIENTE: ve únicamente su propio perfil de cliente.
   */
  async findAllForUser(user: AuthenticatedUser) {
    const whereClause: Record<string, unknown> = { deletedAt: null };

    if (user.role === RoleCode.AGENCIA) {
      if (!user.agencyId) {
        throw new ForbiddenException('Tu usuario de agencia no tiene una agencia asignada.');
      }
      whereClause.agencyId = user.agencyId;
    } else if (user.role === RoleCode.CLIENTE) {
      if (!user.clientId) {
        throw new ForbiddenException('Tu usuario no tiene un perfil de cliente vinculado.');
      }
      whereClause.id = user.clientId;
    }

    return this.prisma.client.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        agency: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, email: true, fullName: true, timezone: true },
        },
        platformConnections: {
          select: {
            id: true,
            platform: true,
            accountHandle: true,
            status: true,
            tokenExpiresAt: true,
          },
        },
      },
    });
  }

  /**
   * Verifica que el usuario autenticado tenga permiso sobre el cliente `clientId`.
   * Se reutiliza en cronogramas, videos, aprobaciones y publicaciones.
   */
  async assertClientAccess(clientId: string, user: AuthenticatedUser) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
      include: {
        agency: { select: { id: true, name: true, ownerUserId: true } },
        user: { select: { id: true, email: true, fullName: true, timezone: true } },
        platformConnections: {
          select: {
            id: true,
            platform: true,
            accountHandle: true,
            status: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado.');
    }

    if (user.role === RoleCode.AGENCIA && client.agencyId !== user.agencyId) {
      throw new ForbiddenException(
        'Acceso denegado: no puedes ver ni administrar clientes de otra agencia.',
      );
    }

    if (user.role === RoleCode.CLIENTE && client.id !== user.clientId) {
      throw new ForbiddenException(
        'Acceso denegado: solo puedes acceder a tus propios recursos.',
      );
    }

    return client;
  }

  async create(dto: CreateClientDto, user: AuthenticatedUser) {
    if (user.role === RoleCode.CLIENTE) {
      throw new ForbiddenException('Los clientes no pueden crear otros clientes.');
    }

    const targetAgencyId =
      user.role === RoleCode.AGENCIA ? user.agencyId : dto.agencyId;

    if (!targetAgencyId) {
      throw new BadRequestException('Debe especificar agencyId para asociar el cliente.');
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ConflictException('Ya existe un usuario registrado con ese correo electrónico.');
    }

    const clientRole = await this.prisma.role.upsert({
      where: { code: RoleCode.CLIENTE },
      update: {},
      create: { code: RoleCode.CLIENTE, name: 'Cliente' },
    });

    const passwordHash = await argon2.hash(dto.password);

    const client = await this.prisma.$transaction(async (tx) => {
      const clientUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          fullName: dto.fullName.trim(),
          roleId: clientRole.id,
          emailVerified: true,
        },
      });

      return tx.client.create({
        data: {
          agencyId: targetAgencyId,
          userId: clientUser.id,
          companyName: dto.companyName.trim(),
          industry: dto.industry?.trim() ?? null,
        },
        include: {
          user: {
            select: { id: true, email: true, fullName: true },
          },
        },
      });
    });

    await this.auditService.log({
      userId: user.sub,
      action: 'CLIENT_CREATE',
      entityType: 'Client',
      entityId: client.id,
      metadata: { companyName: client.companyName, agencyId: targetAgencyId },
    });

    return client;
  }

  async update(id: string, dto: UpdateClientDto, user: AuthenticatedUser) {
    if (user.role === RoleCode.CLIENTE) {
      throw new ForbiddenException('Un cliente no puede modificar su estado administrativo.');
    }
    await this.assertClientAccess(id, user);

    const updated = await this.prisma.client.update({
      where: { id },
      data: {
        companyName: dto.companyName?.trim(),
        industry: dto.industry?.trim(),
        isActive: dto.isActive,
      },
    });

    await this.auditService.log({
      userId: user.sub,
      action: 'CLIENT_UPDATE',
      entityType: 'Client',
      entityId: id,
    });

    return updated;
  }

  async softDelete(id: string, user: AuthenticatedUser) {
    if (user.role === RoleCode.CLIENTE) {
      throw new ForbiddenException('Operación no permitida para el rol CLIENTE.');
    }
    const client = await this.assertClientAccess(id, user);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.client.update({
        where: { id },
        data: { deletedAt: now, isActive: false },
      }),
      this.prisma.user.update({
        where: { id: client.userId },
        data: { deletedAt: now, isActive: false },
      }),
    ]);

    await this.auditService.log({
      userId: user.sub,
      action: 'CLIENT_SOFT_DELETE',
      entityType: 'Client',
      entityId: id,
    });

    return { message: 'Cliente eliminado lógicamente.', id };
  }
}

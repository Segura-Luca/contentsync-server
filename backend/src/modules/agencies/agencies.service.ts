import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAgencyDto, UpdateAgencyDto } from './dto/agency.dto';

@Injectable()
export class AgenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll() {
    return this.prisma.agency.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        ownerUser: {
          select: { id: true, email: true, fullName: true, isActive: true },
        },
        _count: {
          select: { clients: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const agency = await this.prisma.agency.findFirst({
      where: { id, deletedAt: null },
      include: {
        ownerUser: {
          select: { id: true, email: true, fullName: true, timezone: true },
        },
        clients: {
          where: { deletedAt: null },
        },
      },
    });
    if (!agency) {
      throw new NotFoundException('Agencia no encontrada.');
    }
    return agency;
  }

  async create(dto: CreateAgencyDto, adminUserId: string) {
    const existingTax = await this.prisma.agency.findUnique({
      where: { taxId: dto.taxId.trim() },
    });
    if (existingTax) {
      throw new ConflictException('Ya existe una agencia con ese identificador fiscal (CUIT/Tax ID).');
    }

    const normalizedEmail = dto.ownerEmail.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ConflictException('Ya existe un usuario con ese correo electrónico.');
    }

    const agencyRole = await this.prisma.role.upsert({
      where: { code: RoleCode.AGENCIA },
      update: {},
      create: { code: RoleCode.AGENCIA, name: 'Agencia de Marketing' },
    });

    const passwordHash = await argon2.hash(dto.ownerPassword);

    const agency = await this.prisma.$transaction(async (tx) => {
      const ownerUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          fullName: dto.ownerFullName.trim(),
          roleId: agencyRole.id,
          emailVerified: true,
        },
      });

      return tx.agency.create({
        data: {
          ownerUserId: ownerUser.id,
          name: dto.name.trim(),
          taxId: dto.taxId.trim(),
          contactPhone: dto.contactPhone ?? null,
          website: dto.website ?? null,
        },
        include: {
          ownerUser: {
            select: { id: true, email: true, fullName: true },
          },
        },
      });
    });

    await this.auditService.log({
      userId: adminUserId,
      action: 'AGENCY_CREATE',
      entityType: 'Agency',
      entityId: agency.id,
      metadata: { name: agency.name, taxId: agency.taxId },
    });

    return agency;
  }

  async update(id: string, dto: UpdateAgencyDto, adminUserId: string) {
    await this.findOne(id);
    const updated = await this.prisma.agency.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        contactPhone: dto.contactPhone,
        website: dto.website,
        isSuspended: dto.isSuspended,
      },
    });

    await this.auditService.log({
      userId: adminUserId,
      action: dto.isSuspended !== undefined ? 'AGENCY_STATUS_CHANGE' : 'AGENCY_UPDATE',
      entityType: 'Agency',
      entityId: id,
      metadata: { isSuspended: updated.isSuspended },
    });

    return updated;
  }

  async softDelete(id: string, adminUserId: string) {
    const agency = await this.findOne(id);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.agency.update({
        where: { id },
        data: { deletedAt: now, isSuspended: true },
      }),
      this.prisma.user.update({
        where: { id: agency.ownerUserId },
        data: { deletedAt: now, isActive: false },
      }),
    ]);

    await this.auditService.log({
      userId: adminUserId,
      action: 'AGENCY_SOFT_DELETE',
      entityType: 'Agency',
      entityId: id,
    });

    return { message: 'Agencia eliminada lógicamente.', id };
  }
}

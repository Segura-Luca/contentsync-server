/** Registro de auditoría: guarda en la tabla audit_logs quién hizo qué, sobre qué dato y desde dónde. */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Datos de un evento de auditoría. `action` es el nombre del evento y `metadata` guarda detalles extra. */
export interface CreateAuditLogInput {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Guarda un evento. `metadata` se almacena como texto JSON. */
  async log(input: CreateAuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  }

  /** Devuelve los eventos más recientes junto con los datos básicos del usuario que los generó. */
  async findAll(limit = 100) {
    return this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });
  }
}

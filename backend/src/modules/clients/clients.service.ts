import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClientConfirmationStatus,
  NotificationType,
  RoleCode,
} from '@prisma/client';
import * as crypto from 'crypto';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { MailService } from '../../common/mail/mail.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { escapeHtml } from '../../common/utils/html';
import { AppConfigService } from '../../config/app-config.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import {
  ConfirmClientIdentityDto,
  CreateClientDto,
  UpdateClientDto,
} from './dto/client.dto';

/** Quita datos que nunca deben salir del servidor: con el token, una agencia podría auto-confirmarse. */
function withoutConfirmationToken<T extends { confirmationToken?: string | null }>(
  client: T,
): Omit<T, 'confirmationToken'> {
  const { confirmationToken: _omitted, ...safe } = client;
  return safe;
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly config: AppConfigService,
    private readonly settings: SettingsService,
  ) {}

  private inviteExpiry(): Date {
    return new Date(Date.now() + this.settings.current().clientInviteTtlHours * 3600000);
  }

  private async sendClientConfirmationEmail(params: {
    email: string;
    fullName: string;
    companyName: string;
    agencyName: string;
    token: string;
  }): Promise<boolean> {
    const baseUrl = this.config.apiUrl('clients/confirm-invitation');
    const acceptUrl = `${baseUrl}?token=${encodeURIComponent(params.token)}&decision=accept`;
    const rejectUrl = `${baseUrl}?token=${encodeURIComponent(params.token)}&decision=reject`;
    const { appName } = this.settings.current();
    const agency = escapeHtml(params.agencyName);
    const company = escapeHtml(params.companyName);
    const subject = `Confirmación de seguridad: ¿Sos cliente de ${params.agencyName}?`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 26px; background: #0f1116; color: #f2f3f5; border: 1px solid #2b3140; border-radius: 8px;">
        <div style="font-family: monospace; font-size: 12px; letter-spacing: 0.08em; color: #d4f238; text-transform: uppercase; margin-bottom: 10px;">${escapeHtml(appName)} · VERIFICACIÓN DE IDENTIDAD</div>
        <h2 style="color: #ffffff; margin: 0 0 14px 0; font-size: 21px;">¿Reconocés esta solicitud de vinculación?</h2>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.55;">Hola <strong>${escapeHtml(params.fullName)}</strong>,</p>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.55;">
          La agencia <strong>${agency}</strong> indicó tu correo electrónico para asociarte como cliente de la marca <strong>${company}</strong>.
        </p>
        <p style="color: #94a3b8; font-size: 14px; line-height: 1.5;">
          Por seguridad, ningún perfil de cliente queda activo hasta que confirmes que realmente sos vos:
        </p>
        <div style="margin: 26px 0;">
          <a href="${acceptUrl}" style="display: inline-block; background: #d4f238; color: #0b0c0e; font-weight: 700; text-decoration: none; padding: 13px 22px; border-radius: 4px; font-size: 14px; margin-right: 10px;">
            ✓ Sí, soy yo
          </a>
          <a href="${rejectUrl}" style="display: inline-block; background: #2d1114; color: #f87171; border: 1px solid #f87171; font-weight: 600; text-decoration: none; padding: 12px 18px; border-radius: 4px; font-size: 14px;">
            ✕ No soy yo, rechazar
          </a>
        </div>
        <p style="color: #64748b; font-size: 12px; line-height: 1.45; margin-top: 20px;">
          Al abrir el enlace vas a confirmar tu decisión en ${escapeHtml(appName)}. Si no reconocés a esta agencia, rechazá o ignorá este mensaje.
        </p>
      </div>
    `;
    const text = `Hola ${params.fullName},\n\nLa agencia ${params.agencyName} solicitó vincularte como cliente de ${params.companyName}.\n\nPara confirmar ("Sí, soy yo"): ${acceptUrl}\nPara rechazar: ${rejectUrl}`;

    return this.mailService.send(
      'general',
      { to: params.email, subject, text, html, meta: { purpose: 'CLIENT_CONFIRMATION' } },
      appName,
    );
  }

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

    const clients = await this.prisma.client.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        agency: {
          select: { id: true, name: true },
        },
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            timezone: true,
            emailVerified: true,
          },
        },
      },
    });
    return clients.map(withoutConfirmationToken);
  }

  /**
   * Verifica que el usuario autenticado tenga permiso sobre el cliente `clientId`.
   */
  async assertClientAccess(
    clientId: string,
    user: AuthenticatedUser,
    requireConfirmed = false,
  ) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
      include: {
        agency: { select: { id: true, name: true, ownerUserId: true } },
        user: { select: { id: true, email: true, fullName: true, timezone: true } },
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

    if (
      requireConfirmed &&
      client.confirmationStatus &&
      client.confirmationStatus !== ClientConfirmationStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        'El cliente aún no confirmó su identidad ("Sí, soy yo"). Por seguridad, el perfil permanece bloqueado hasta que el titular del correo acepte la notificación.',
      );
    }

    return withoutConfirmationToken(client);
  }

  /**
   * Crea una solicitud de perfil de cliente en estado PENDING y envía notificación
   * en la plataforma + correo electrónico para que el destinatario presione "Sí, soy yo".
   */
  async create(dto: CreateClientDto, user: AuthenticatedUser) {
    if (user.role === RoleCode.CLIENTE) {
      throw new ForbiddenException('Los clientes no pueden crear otros clientes.');
    }

    const targetAgencyId =
      user.role === RoleCode.AGENCIA ? user.agencyId : dto.agencyId;

    if (!targetAgencyId) {
      throw new BadRequestException('Debe especificar la agencia para asociar el cliente.');
    }

    const agency = await this.prisma.agency.findUnique({
      where: { id: targetAgencyId },
    });
    if (!agency) {
      throw new NotFoundException('Agencia no encontrada.');
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ConflictException(
        'Ya existe un usuario registrado con ese correo electrónico.',
      );
    }

    const clientRole = await this.prisma.role.upsert({
      where: { code: RoleCode.CLIENTE },
      update: {},
      create: { code: RoleCode.CLIENTE, name: 'Cliente' },
    });

    // El cliente crea su propia contraseña: si la eligiera la agencia, podría aprobar videos en su nombre.
    const confirmationToken = crypto.randomBytes(32).toString('hex');

    const client = await this.prisma.$transaction(async (tx) => {
      const clientUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          fullName: dto.fullName.trim(),
          roleId: clientRole.id,
          timezone: this.settings.current().defaultTimezone,
          emailVerified: false,
          isActive: true,
        },
      });

      return tx.client.create({
        data: {
          agencyId: targetAgencyId,
          userId: clientUser.id,
          companyName: dto.companyName.trim(),
          industry: dto.industry?.trim() ?? null,
          confirmationStatus: ClientConfirmationStatus.PENDING,
          confirmationToken,
          confirmationExpiresAt: this.inviteExpiry(),
          invitedByUserId: user.sub,
          isActive: false,
        },
        include: {
          agency: { select: { id: true, name: true } },
          user: {
            select: { id: true, email: true, fullName: true, emailVerified: true },
          },
        },
      });
    });

    await this.notificationsService.notifyUser({
      userId: client.userId,
      type: NotificationType.CLIENT_CONFIRMATION_REQUEST,
      title: `Confirmación de seguridad: ¿Sos cliente de ${agency.name}?`,
      body: `La agencia "${agency.name}" solicitó vincular tu correo (${normalizedEmail}) como cliente de "${client.companyName}". Presioná "Sí, soy yo" para activar tu cuenta.`,
      referenceId: client.id,
    });

    const emailSent = await this.sendClientConfirmationEmail({
      email: normalizedEmail,
      fullName: dto.fullName.trim(),
      companyName: client.companyName,
      agencyName: agency.name,
      token: confirmationToken,
    });

    await this.auditService.log({
      userId: user.sub,
      action: 'CLIENT_INVITATION_CREATED',
      entityType: 'Client',
      entityId: client.id,
      metadata: {
        companyName: client.companyName,
        agencyId: targetAgencyId,
        email: normalizedEmail,
        emailSent,
      },
    });

    return {
      ...withoutConfirmationToken(client),
      emailSent,
    };
  }

  /**
   * Reenviar la notificación "Sí, soy yo" a un cliente aún pendiente.
   */
  async resendConfirmation(clientId: string, user: AuthenticatedUser) {
    if (user.role === RoleCode.CLIENTE) {
      throw new ForbiddenException('Operación reservada para la agencia.');
    }
    const client = await this.assertClientAccess(clientId, user);

    const fullClient = await this.prisma.client.findUnique({
      where: { id: client.id },
      include: { agency: true, user: true },
    });
    if (!fullClient) {
      throw new NotFoundException('Cliente no encontrado.');
    }

    if (fullClient.confirmationStatus === ClientConfirmationStatus.CONFIRMED) {
      throw new BadRequestException('Este cliente ya confirmó su identidad.');
    }

    // Conservar el token vigente: si no, cada reenvío deja inservibles los correos que el cliente ya recibió.
    const isCurrent =
      fullClient.confirmationStatus === ClientConfirmationStatus.PENDING &&
      fullClient.confirmationToken &&
      fullClient.confirmationExpiresAt &&
      fullClient.confirmationExpiresAt > new Date();
    const token = isCurrent ? fullClient.confirmationToken! : crypto.randomBytes(32).toString('hex');
    await this.prisma.client.update({
      where: { id: fullClient.id },
      data: {
        confirmationToken: token,
        confirmationExpiresAt: this.inviteExpiry(),
        confirmationStatus: ClientConfirmationStatus.PENDING,
      },
    });

    await this.notificationsService.notifyUser({
      userId: fullClient.userId,
      type: NotificationType.CLIENT_CONFIRMATION_REQUEST,
      title: `Confirmación pendiente: ¿Sos cliente de ${fullClient.agency.name}?`,
      body: `Recordatorio de "${fullClient.agency.name}" para confirmar tu perfil de "${fullClient.companyName}". Presioná "Sí, soy yo" si reconocés esta solicitud.`,
      referenceId: fullClient.id,
    });

    const emailSent = await this.sendClientConfirmationEmail({
      email: fullClient.user.email,
      fullName: fullClient.user.fullName,
      companyName: fullClient.companyName,
      agencyName: fullClient.agency.name,
      token,
    });

    return {
      message: 'Notificación de confirmación reenviada al cliente.',
      emailSent,
    };
  }

  /**
   * Consulta si el usuario autenticado (CLIENTE) tiene una confirmación "Sí, soy yo" pendiente.
   */
  async getMyPendingConfirmation(user: AuthenticatedUser) {
    const client = await this.prisma.client.findFirst({
      where: {
        userId: user.sub,
        deletedAt: null,
        confirmationStatus: ClientConfirmationStatus.PENDING,
      },
      include: {
        agency: { select: { id: true, name: true, website: true } },
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
    return { pendingClient: client ? withoutConfirmationToken(client) : null };
  }

  /**
   * Confirmación desde dentro de la app (notificación interactiva "Sí, soy yo" / "No soy yo").
   */
  async confirmIdentityInApp(
    clientId: string,
    dto: ConfirmClientIdentityDto,
    user: AuthenticatedUser,
  ) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
      include: {
        agency: true,
        user: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Solicitud de vinculación no encontrada.');
    }

    if (client.userId !== user.sub) {
      throw new ForbiddenException(
        'Solo el titular del correo electrónico puede confirmar o rechazar esta vinculación.',
      );
    }

    return this.applyConfirmationDecision(client, dto.decision);
  }

  /**
   * Confirmación desde el botón del correo electrónico ("Sí, soy yo" / "No soy yo").
   */
  async confirmIdentityByToken(token: string, decisionRaw: string) {
    if (!token || token.trim().length < 16) {
      throw new BadRequestException('Enlace de confirmación inválido o expirado.');
    }

    const client = await this.prisma.client.findFirst({
      where: {
        confirmationToken: token.trim(),
        deletedAt: null,
      },
      include: {
        agency: true,
        user: true,
      },
    });

    if (!client || !client.confirmationExpiresAt || client.confirmationExpiresAt < new Date()) {
      throw new BadRequestException(
        'Esta solicitud ya fue procesada o el enlace expiró.',
      );
    }

    const decision: 'ACCEPT' | 'REJECT' =
      decisionRaw?.toUpperCase() === 'REJECT' ? 'REJECT' : 'ACCEPT';

    return this.applyConfirmationDecision(client, decision);
  }

  private async applyConfirmationDecision(
    client: {
      id: string;
      userId: string;
      companyName: string;
      confirmationStatus: ClientConfirmationStatus;
      agency: { id: string; name: string; ownerUserId: string };
      user: { id: string; email: string; fullName: string };
    },
    decision: 'ACCEPT' | 'REJECT',
  ) {
    // Una decisión ya tomada no se reabre: "rechazar" anula la cuenta de forma definitiva.
    if (client.confirmationStatus !== ClientConfirmationStatus.PENDING) {
      throw new BadRequestException('Esta solicitud ya fue procesada.');
    }

    if (decision === 'ACCEPT') {
      const now = new Date();
      await this.prisma.$transaction([
        this.prisma.client.update({
          where: { id: client.id },
          data: {
            confirmationStatus: ClientConfirmationStatus.CONFIRMED,
            confirmedAt: now,
            confirmationToken: null,
            confirmationExpiresAt: null,
            isActive: true,
          },
        }),
        this.prisma.user.update({
          where: { id: client.userId },
          data: {
            emailVerified: true,
          },
        }),
        this.prisma.notification.updateMany({
          where: {
            userId: client.userId,
            referenceId: client.id,
            type: NotificationType.CLIENT_CONFIRMATION_REQUEST,
          },
          data: { isRead: true },
        }),
      ]);

      await this.notificationsService.notifyUser({
        userId: client.agency.ownerUserId,
        type: NotificationType.CLIENT_CONFIRMATION_RESPONSE,
        title: `¡Cliente verificado! (${client.companyName})`,
        body: `${client.user.fullName} (${client.user.email}) presionó "Sí, soy yo" y confirmó la vinculación con tu agencia.`,
        referenceId: client.id,
      });

      await this.auditService.log({
        userId: client.userId,
        action: 'CLIENT_IDENTITY_CONFIRMED',
        entityType: 'Client',
        entityId: client.id,
        metadata: { companyName: client.companyName, agencyId: client.agency.id },
      });

      return {
        status: 'CONFIRMED',
        companyName: client.companyName,
        agencyName: client.agency.name,
        message: `Confirmaste tu identidad ("Sí, soy yo"). Tu cuenta de cliente para ${client.companyName} ya está activa.`,
      };
    }

    // REJECT: cancelar el perfil y liberar el correo para evitar apropiación indebida
    const now = new Date();
    const releasedEmail = `rejected_${now.getTime()}_${client.user.email}`.slice(0, 175);

    await this.prisma.$transaction([
      this.prisma.client.update({
        where: { id: client.id },
        data: {
          confirmationStatus: ClientConfirmationStatus.REJECTED,
          confirmationToken: null,
          confirmationExpiresAt: null,
          isActive: false,
          deletedAt: now,
        },
      }),
      this.prisma.user.update({
        where: { id: client.userId },
        data: {
          email: releasedEmail,
          isActive: false,
          deletedAt: now,
        },
      }),
      this.prisma.authSession.updateMany({
        where: { userId: client.userId },
        data: { isRevoked: true },
      }),
    ]);

    await this.notificationsService.notifyUser({
      userId: client.agency.ownerUserId,
      type: NotificationType.CLIENT_CONFIRMATION_RESPONSE,
      title: `Vinculación rechazada (${client.companyName})`,
      body: `El titular de ${client.user.email} indicó que NO reconoce la solicitud para "${client.companyName}". El perfil fue anulado por seguridad.`,
      referenceId: client.id,
    });

    await this.auditService.log({
      userId: client.userId,
      action: 'CLIENT_IDENTITY_REJECTED',
      entityType: 'Client',
      entityId: client.id,
      metadata: { companyName: client.companyName, agencyId: client.agency.id },
    });

    return {
      status: 'REJECTED',
      companyName: client.companyName,
      agencyName: client.agency.name,
      message: 'Rechazaste la vinculación. Tu correo electrónico fue desvinculado por completo.',
    };
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

    return withoutConfirmationToken(updated);
  }

  async softDelete(id: string, user: AuthenticatedUser) {
    if (user.role === RoleCode.CLIENTE) {
      throw new ForbiddenException('Operación no permitida para el rol CLIENTE.');
    }
    const client = await this.assertClientAccess(id, user);
    const now = new Date();
    const userRecord = await this.prisma.user.findUnique({ where: { id: client.userId } });
    const archivedEmail = userRecord
      ? `deleted_${now.getTime()}_${userRecord.email}`.slice(0, 175)
      : undefined;

    await this.prisma.$transaction([
      this.prisma.client.update({
        where: { id },
        data: { deletedAt: now, isActive: false, confirmationToken: null },
      }),
      this.prisma.user.update({
        where: { id: client.userId },
        data: {
          deletedAt: now,
          isActive: false,
          ...(archivedEmail ? { email: archivedEmail } : {}),
        },
      }),
    ]);

    await this.auditService.log({
      userId: user.sub,
      action: 'CLIENT_SOFT_DELETE',
      entityType: 'Client',
      entityId: id,
    });

    return { message: 'Cliente eliminado correctamente.', id };
  }
}

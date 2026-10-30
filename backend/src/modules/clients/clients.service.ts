import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClientConfirmationStatus,
  NotificationType,
  RoleCode,
} from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ConfirmClientIdentityDto,
  CreateClientDto,
  UpdateClientDto,
} from './dto/client.dto';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);
  private mailerTransporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  private getMailer(): nodemailer.Transporter | null {
    if (this.mailerTransporter) return this.mailerTransporter;
    if (!this.configService) return null;
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const port = parseInt(this.configService.get<string>('SMTP_PORT', '587'), 10);
    const secure =
      this.configService.get<string>('SMTP_SECURE', 'false') === 'true' ||
      port === 465;

    if (host && user && pass) {
      this.mailerTransporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
      });
      return this.mailerTransporter;
    }
    return null;
  }

  private async sendClientConfirmationEmail(params: {
    email: string;
    fullName: string;
    companyName: string;
    agencyName: string;
    token: string;
  }): Promise<boolean> {
    const mailer = this.getMailer();
    const port = this.configService?.get<string>('PORT') || '3000';
    // En producción toma PUBLIC_APP_URL o automáticamente RENDER_EXTERNAL_URL
    // para que el enlace del correo se abra desde cualquier celular sin depender de localhost.
    const publicBase = (
      this.configService?.get<string>('PUBLIC_APP_URL') ||
      process.env.RENDER_EXTERNAL_URL ||
      `http://localhost:${port}`
    ).replace(/\/+$/, '');
    const baseUrl = `${publicBase}/api/v1/clients/confirm-invitation`;
    const acceptUrl = `${baseUrl}?token=${encodeURIComponent(params.token)}&decision=accept`;
    const rejectUrl = `${baseUrl}?token=${encodeURIComponent(params.token)}&decision=reject`;

    const from =
      this.configService?.get<string>('SMTP_FROM') ||
      '"ContentSync" <no-reply@contentsync.io>';
    const subject = `Confirmación de seguridad: ¿Sos cliente de ${params.agencyName}?`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 26px; background: #0f1116; color: #f2f3f5; border: 1px solid #2b3140; border-radius: 8px;">
        <div style="font-family: monospace; font-size: 12px; letter-spacing: 0.08em; color: #d4f238; text-transform: uppercase; margin-bottom: 10px;">CONTENTSYNC · VERIFICACIÓN DE IDENTIDAD</div>
        <h2 style="color: #ffffff; margin: 0 0 14px 0; font-size: 21px;">¿Reconocés esta solicitud de vinculación?</h2>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.55;">Hola <strong>${params.fullName}</strong>,</p>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.55;">
          La agencia <strong>${params.agencyName}</strong> indicó tu correo electrónico para asociarte como cliente de la marca <strong>${params.companyName}</strong>.
        </p>
        <p style="color: #94a3b8; font-size: 14px; line-height: 1.5;">
          Por seguridad, ningún perfil de cliente queda activo hasta que confirmes que realmente sos vos:
        </p>
        <div style="margin: 26px 0; display: flex; gap: 12px; flex-wrap: wrap;">
          <a href="${acceptUrl}" style="display: inline-block; background: #d4f238; color: #0b0c0e; font-weight: 700; text-decoration: none; padding: 13px 22px; border-radius: 4px; font-size: 14px; margin-right: 10px;">
            ✓ Sí, soy yo
          </a>
          <a href="${rejectUrl}" style="display: inline-block; background: #2d1114; color: #f87171; border: 1px solid #f87171; font-weight: 600; text-decoration: none; padding: 12px 18px; border-radius: 4px; font-size: 14px;">
            ✕ No soy yo, rechazar
          </a>
        </div>
        <p style="color: #64748b; font-size: 12px; line-height: 1.45; margin-top: 20px;">
          También podés iniciar sesión en ContentSync y confirmar presionando <strong>"Sí, soy yo"</strong> en tu panel de notificaciones. Si no reconocés a esta agencia, rechazá o ignorá este mensaje.
        </p>
      </div>
    `;

    const textBody = `Hola ${params.fullName},\n\nLa agencia ${params.agencyName} solicitó vincularte como cliente de ${params.companyName}.\n\nPara confirmar ("Sí, soy yo"): ${acceptUrl}\nPara rechazar: ${rejectUrl}`;
    const webhookUrl = this.configService?.get<string>('GMAIL_HTTPS_WEBHOOK_URL');
    const webhookSecret = this.configService?.get<string>('GMAIL_WEBHOOK_SECRET') || '';

    if (webhookUrl) {
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: webhookSecret,
            to: params.email,
            subject,
            text: textBody,
            html,
            fromName: 'ContentSync',
          }),
        });
        if (res.ok) {
          this.logger.log(`[HTTPS-MAIL] Notificación "Sí, soy yo" enviada a ${params.email}`);
          return true;
        }
      } catch (err: any) {
        this.logger.warn(`[HTTPS-MAIL] Falló relay HTTPS, probando SMTP: ${err.message}`);
      }
    }

    if (!mailer) {
      this.logger.warn(
        `[SMTP NO CONFIGURADO] Invitación pendiente para ${params.email}. Link de confirmación: ${acceptUrl}`,
      );
      return false;
    }

    try {
      await mailer.sendMail({
        from,
        to: params.email,
        subject,
        text: textBody,
        html,
      });
      this.logger.log(`[SMTP] Notificación "Sí, soy yo" enviada a ${params.email}`);
      return true;
    } catch (err: any) {
      this.logger.error(
        `[SMTP ERROR] No se pudo enviar correo de confirmación a ${params.email}: ${err.message}`,
      );
      return false;
    }
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

    return this.prisma.client.findMany({
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

    if (
      requireConfirmed &&
      client.confirmationStatus &&
      client.confirmationStatus !== ClientConfirmationStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        'El cliente aún no confirmó su identidad ("Sí, soy yo"). Por seguridad, el perfil permanece bloqueado hasta que el titular del correo acepte la notificación.',
      );
    }

    return client;
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

    const passwordHash = await argon2.hash(dto.password);
    const confirmationToken = crypto.randomBytes(32).toString('hex');

    const client = await this.prisma.$transaction(async (tx) => {
      const clientUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          fullName: dto.fullName.trim(),
          roleId: clientRole.id,
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
          invitedByUserId: user.sub,
          isActive: false,
        },
        include: {
          agency: { select: { id: true, name: true } },
          user: {
            select: { id: true, email: true, fullName: true, emailVerified: true },
          },
          platformConnections: true,
        },
      });
    });

    if (this.notificationsService) {
      await this.notificationsService.notifyUser({
        userId: client.userId,
        type: NotificationType.CLIENT_CONFIRMATION_REQUEST,
        title: `Confirmación de seguridad: ¿Sos cliente de ${agency.name}?`,
        body: `La agencia "${agency.name}" solicitó vincular tu correo (${normalizedEmail}) como cliente de "${client.companyName}". Presioná "Sí, soy yo" para activar tu cuenta.`,
        referenceId: client.id,
      });
    }

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
      ...client,
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

    const newToken = crypto.randomBytes(32).toString('hex');
    await this.prisma.client.update({
      where: { id: fullClient.id },
      data: {
        confirmationToken: newToken,
        confirmationStatus: ClientConfirmationStatus.PENDING,
      },
    });

    if (this.notificationsService) {
      await this.notificationsService.notifyUser({
        userId: fullClient.userId,
        type: NotificationType.CLIENT_CONFIRMATION_REQUEST,
        title: `Confirmación pendiente: ¿Sos cliente de ${fullClient.agency.name}?`,
        body: `Recordatorio de "${fullClient.agency.name}" para confirmar tu perfil de "${fullClient.companyName}". Presioná "Sí, soy yo" si reconocés esta solicitud.`,
        referenceId: fullClient.id,
      });
    }

    const emailSent = await this.sendClientConfirmationEmail({
      email: fullClient.user.email,
      fullName: fullClient.user.fullName,
      companyName: fullClient.companyName,
      agencyName: fullClient.agency.name,
      token: newToken,
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
    return { pendingClient: client };
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

    if (!client) {
      throw new BadRequestException(
        'Esta solicitud ya fue procesada o el enlace expiró.',
      );
    }

    const decision: 'ACCEPT' | 'REJECT' =
      decisionRaw?.toLowerCase() === 'reject' ? 'REJECT' : 'ACCEPT';

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
    if (decision === 'ACCEPT') {
      const now = new Date();
      await this.prisma.$transaction([
        this.prisma.client.update({
          where: { id: client.id },
          data: {
            confirmationStatus: ClientConfirmationStatus.CONFIRMED,
            confirmedAt: now,
            confirmationToken: null,
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

      if (this.notificationsService) {
        await this.notificationsService.notifyUser({
          userId: client.agency.ownerUserId,
          type: NotificationType.CLIENT_CONFIRMATION_RESPONSE,
          title: `¡Cliente verificado! (${client.companyName})`,
          body: `${client.user.fullName} (${client.user.email}) presionó "Sí, soy yo" y confirmó la vinculación con tu agencia.`,
          referenceId: client.id,
        });
      }

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

    if (this.notificationsService) {
      await this.notificationsService.notifyUser({
        userId: client.agency.ownerUserId,
        type: NotificationType.CLIENT_CONFIRMATION_RESPONSE,
        title: `Vinculación rechazada (${client.companyName})`,
        body: `El titular de ${client.user.email} indicó que NO reconoce la solicitud para "${client.companyName}". El perfil fue anulado por seguridad.`,
        referenceId: client.id,
      });
    }

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

    return updated;
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

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RoleCode } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SocialTokenVerifierService } from './social-token-verifier.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  SocialLoginDto,
  VerifyEmailDto,
} from './dto/auth.dto';

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: RoleCode;
    timezone: string;
    emailVerified: boolean;
    agencyId: string | null;
    clientId: string | null;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private mailerTransporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly socialVerifier: SocialTokenVerifierService,
  ) {
    this.accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'change_this_to_a_64_char_random_hex_secret_for_access_tokens_2026';
    this.refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'change_this_to_a_64_char_random_hex_secret_for_refresh_tokens_2026';
  }

  private async ensureRoleExists(code: RoleCode) {
    return this.prisma.role.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: code,
      },
    });
  }

  async register(dto: RegisterDto, ipAddress?: string): Promise<AuthTokensResponse> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException('Ya existe una cuenta registrada con ese correo electrónico.');
    }

    // Toda persona que crea una cuenta adquiere jerarquía de AGENCIA
    const role = await this.ensureRoleExists(RoleCode.AGENCIA);
    const passwordHash = await argon2.hash(dto.password);
    const verificationToken = crypto.randomBytes(24).toString('hex');
    const agencyName = dto.agencyName?.trim() || `${dto.fullName.trim()} Media`;
    const taxId = `AG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          fullName: dto.fullName.trim(),
          roleId: role.id,
          timezone: dto.timezone || 'America/Argentina/Buenos_Aires',
          verificationToken,
          emailVerified: false,
        },
      });

      await tx.agency.create({
        data: {
          ownerUserId: createdUser.id,
          name: agencyName,
          taxId,
        },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: createdUser.id },
        include: {
          role: true,
          ownedAgency: true,
          clientProfile: true,
        },
      });
    });

    await this.auditService.log({
      userId: user.id,
      action: 'AUTH_REGISTER',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
      metadata: { role: user.role.code },
    });

    return this.issueSessionTokens(user, 'Registro inicial', ipAddress);
  }

  async login(dto: LoginDto, ipAddress?: string): Promise<AuthTokensResponse> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        role: true,
        ownedAgency: true,
        clientProfile: true,
      },
    });

    if (!user || !user.passwordHash || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Credenciales inválidas o cuenta inactiva.');
    }

    const validPassword = await argon2.verify(user.passwordHash, dto.password);
    if (!validPassword) {
      await this.auditService.log({
        userId: user.id,
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        ipAddress,
      });
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    await this.auditService.log({
      userId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    return this.issueSessionTokens(user, dto.deviceInfo, ipAddress);
  }

  /**
   * Inicio de sesión social con 3 proveedores (GOOGLE, FACEBOOK, GITHUB) y
   * vinculación automática de cuenta por email para evitar duplicados.
   */
  async socialLogin(input: SocialLoginDto, ipAddress?: string): Promise<AuthTokensResponse> {
    if (!input.idToken || input.idToken.trim().length < 10) {
      throw new UnauthorizedException('Token del proveedor social inválido.');
    }

    // La identidad se obtiene verificando el token ante Google/Meta; se ignora lo que declare el cliente.
    const identity = await this.socialVerifier.verify(input.provider, input.idToken.trim());
    const dto = {
      ...input,
      email: identity.email,
      providerUserId: identity.providerUserId,
      fullName: identity.fullName,
    };

    const normalizedEmail = dto.email.trim().toLowerCase();

    // 1. Verificar si ya existe el vínculo social
    const existingSocial = await this.prisma.socialAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: dto.provider,
          providerUserId: dto.providerUserId,
        },
      },
      include: {
        user: {
          include: {
            role: true,
            ownedAgency: true,
            clientProfile: true,
          },
        },
      },
    });

    if (existingSocial) {
      await this.auditService.log({
        userId: existingSocial.userId,
        action: `AUTH_SOCIAL_LOGIN_${dto.provider}`,
        entityType: 'SocialAuthAccount',
        entityId: existingSocial.id,
        ipAddress,
      });
      return this.issueSessionTokens(existingSocial.user, dto.deviceInfo, ipAddress);
    }

    // 2. Buscar si existe usuario con el mismo email para vincular sin duplicar
    let user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        role: true,
        ownedAgency: true,
        clientProfile: true,
      },
    });

    if (!user) {
      const defaultRole = await this.ensureRoleExists(RoleCode.AGENCIA);
      const agencyName = `${dto.fullName.trim()} Media`;
      const taxId = `AG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      user = await this.prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            fullName: dto.fullName.trim(),
            roleId: defaultRole.id,
            emailVerified: true,
          },
        });

        await tx.agency.create({
          data: {
            ownerUserId: createdUser.id,
            name: agencyName,
            taxId,
          },
        });

        return tx.user.findUniqueOrThrow({
          where: { id: createdUser.id },
          include: {
            role: true,
            ownedAgency: true,
            clientProfile: true,
          },
        });
      });
    } else if (!user.emailVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    // 3. Crear vínculo en social_auth_accounts (3FN)
    const socialAccount = await this.prisma.socialAuthAccount.create({
      data: {
        userId: user.id,
        provider: dto.provider,
        providerUserId: dto.providerUserId,
        email: normalizedEmail,
      },
    });

    await this.auditService.log({
      userId: user.id,
      action: `AUTH_SOCIAL_LINKED_${dto.provider}`,
      entityType: 'SocialAuthAccount',
      entityId: socialAccount.id,
      ipAddress,
    });

    return this.issueSessionTokens(user, dto.deviceInfo, ipAddress);
  }

  /** Identificadores públicos (no secretos) que necesitan los clientes para abrir el login social. */
  getSocialPublicConfig() {
    return {
      googleClientId: this.configService.get<string>('GOOGLE_AUTH_CLIENT_ID') || null,
      facebookAppId: this.configService.get<string>('FACEBOOK_AUTH_APP_ID') || null,
    };
  }

  /**
   * Rotación de Refresh Token con detección de reuso (Token Family Reuse Detection).
   */
  async refreshTokens(dto: RefreshTokenDto, ipAddress?: string): Promise<AuthTokensResponse> {
    let decoded: { sub: string; sessionId: string; tokenFamily: string };
    try {
      decoded = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token expirado o firma inválida.');
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: decoded.sessionId },
      include: {
        user: {
          include: {
            role: true,
            ownedAgency: true,
            clientProfile: true,
          },
        },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Sesión no encontrada.');
    }

    // Si la sesión ya fue revocada o rotada, significa intento de reuso de un token robado -> revocar toda la familia
    if (session.isRevoked || session.rotatedAt) {
      await this.prisma.authSession.updateMany({
        where: { tokenFamily: session.tokenFamily },
        data: { isRevoked: true },
      });
      await this.auditService.log({
        userId: session.userId,
        action: 'AUTH_REFRESH_REUSE_DETECTED',
        entityType: 'AuthSession',
        entityId: session.id,
        ipAddress,
      });
      throw new UnauthorizedException(
        'Se detectó reuso de Refresh Token. Por seguridad se cerraron las sesiones asociadas.',
      );
    }

    const matchesHash = await argon2.verify(session.refreshTokenHash, dto.refreshToken);
    if (!matchesHash || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido o vencido.');
    }

    // Marcar sesión actual como rotada e invalidarla para futuros usos
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        rotatedAt: new Date(),
        isRevoked: true,
      },
    });

    return this.issueSessionTokens(
      session.user,
      session.deviceInfo ?? undefined,
      ipAddress,
      session.tokenFamily,
    );
  }

  async logout(userId: string, ipAddress?: string): Promise<{ message: string }> {
    await this.prisma.authSession.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    await this.auditService.log({
      userId,
      action: 'AUTH_LOGOUT',
      entityType: 'User',
      entityId: userId,
      ipAddress,
    });

    return { message: 'Sesión cerrada y tokens revocados correctamente.' };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { verificationToken: dto.token },
    });
    if (!user) {
      throw new BadRequestException('Token de verificación inválido.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
      },
    });

    return { message: 'Correo electrónico verificado exitosamente.' };
  }

  private getMailer(): nodemailer.Transporter | null {
    if (this.mailerTransporter) return this.mailerTransporter;
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const port = parseInt(this.configService.get<string>('SMTP_PORT', '587'), 10);
    const secure = this.configService.get<string>('SMTP_SECURE', 'false') === 'true' || port === 465;

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

  async sendPasswordRecoveryEmail(
    email: string,
    code: string,
    fullName: string,
  ): Promise<boolean> {
    const mailer = this.getMailer();
    const from = this.configService.get<string>(
      'SMTP_FROM',
      '"ContentSync" <no-reply@contentsync.io>',
    );
    const subject = `${code} es tu código de recuperación de ContentSync`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Recuperación de contraseña</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.5;">Hola <strong>${fullName || 'Usuario'}</strong>,</p>
        <p style="color: #475569; font-size: 15px; line-height: 1.5;">Recibimos una solicitud para restablecer tu contraseña en ContentSync. Tu código de verificación de 6 dígitos es:</p>
        <div style="background: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 18px; text-align: center; margin: 24px 0;">
          <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 34px; font-weight: 700; letter-spacing: 6px; color: #0f172a;">${code}</span>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 1.4;">Este código es de un solo uso y expirará en 30 minutos.<br/>Si no realizaste esta solicitud, podés desestimar este mensaje con tranquilidad.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">ContentSync — Publicación multired unificada</p>
      </div>
    `;

    const textBody = `Hola ${fullName},\n\nTu código de recuperación de ContentSync es: ${code}\nExpira en 30 minutos.\n\nSi no fuiste vos, ignora este mensaje.`;
    const webhookUrl = this.configService.get<string>('GMAIL_HTTPS_WEBHOOK_URL');
    const webhookSecret =
      this.configService.get<string>('GMAIL_WEBHOOK_SECRET') || 'cs_mail_relay_2026_x9k2';

    if (webhookUrl) {
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: webhookSecret,
            to: email,
            subject,
            text: textBody,
            html,
            fromName: 'ContentSync',
          }),
        });
        if (res.ok) {
          this.logger.log(`[HTTPS-MAIL] Correo de recuperación enviado exitosamente a ${email}`);
          return true;
        }
      } catch (err: any) {
        this.logger.warn(`[HTTPS-MAIL] Falló relay HTTPS, probando SMTP: ${err.message}`);
      }
    }

    if (mailer) {
      try {
        await mailer.sendMail({
          from,
          to: email,
          subject,
          text: textBody,
          html,
        });
        this.logger.log(`[SMTP] Correo de recuperación enviado exitosamente a ${email}`);
        return true;
      } catch (err: any) {
        this.logger.error(`[SMTP ERROR] Falló el envío de correo a ${email}: ${err.message}`);
        return false;
      }
    } else {
      this.logger.warn(
        `[SMTP NO CONFIGURADO] Código de recuperación generado para ${email}: ${code}. Configura SMTP_HOST, SMTP_USER, SMTP_PASS en backend/.env para entrega automática a la casilla.`,
      );
      return false;
    }
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (!user) {
      return {
        message: 'Si el correo está registrado, enviamos un código de verificación de 6 dígitos a tu casilla de correo.',
      };
    }

    // Genera un código OTP de 6 dígitos de alta entropía para recuperación de clave
    const resetToken = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 1000 * 60 * 30); // 30 minutos de validez

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: expires,
      },
    });

    // Envía el correo al destinatario
    await this.sendPasswordRecoveryEmail(user.email, resetToken, user.fullName);

    // Por seguridad, NUNCA se retorna el token al cliente en la respuesta
    return {
      message: 'Si el correo está registrado, enviamos un código de verificación de 6 dígitos a tu casilla de correo.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: dto.token.trim(),
        passwordResetExpires: { gt: new Date() },
      },
    });
    if (!user) {
      throw new BadRequestException('El código de recuperación es incorrecto o ya expiró.');
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    await this.prisma.authSession.updateMany({
      where: { userId: user.id },
      data: { isRevoked: true },
    });

    return { message: 'Contraseña actualizada exitosamente.' };
  }

  private async issueSessionTokens(
    user: {
      id: string;
      email: string;
      fullName: string;
      timezone: string;
      emailVerified: boolean;
      role: { code: RoleCode };
      ownedAgency?: { id: string } | null;
      clientProfile?: { id: string; agencyId: string } | null;
    },
    deviceInfo?: string,
    ipAddress?: string,
    existingTokenFamily?: string,
  ): Promise<AuthTokensResponse> {
    const sessionId = crypto.randomUUID();
    const tokenFamily = existingTokenFamily || crypto.randomUUID();
    const agencyId = user.ownedAgency?.id ?? user.clientProfile?.agencyId ?? null;
    const clientId = user.clientProfile?.id ?? null;

    const accessPayload: AuthenticatedUser = {
      sub: user.id,
      email: user.email,
      role: user.role.code,
      agencyId,
      clientId,
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.accessSecret,
      expiresIn: '15m',
    });

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        sessionId,
        tokenFamily,
      },
      {
        secret: this.refreshSecret,
        expiresIn: '7d',
      },
    );

    const refreshTokenHash = await argon2.hash(refreshToken);

    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenFamily,
        refreshTokenHash,
        deviceInfo: deviceInfo ?? null,
        ipAddress: ipAddress ?? null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresInSeconds: 900,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role.code,
        timezone: user.timezone,
        emailVerified: user.emailVerified,
        agencyId,
        clientId,
      },
    };
  }
}

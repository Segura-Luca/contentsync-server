import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RoleCode, SocialProvider } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  SocialTokenVerifierService,
  VerifiedSocialIdentity,
} from './social-token-verifier.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  SocialLoginDto,
  VerifyEmailDto,
  VerifyOtpCodeDto,
  VerifyRegistrationCodeDto,
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

export interface PendingVerificationResponse {
  requiresEmailVerification?: boolean;
  requiresPasswordCreation?: boolean;
  email: string;
  message: string;
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

  /**
   * Registro en 2 pasos:
   * Paso 1: Guarda los datos de la Agencia en estado no verificado y envía un código
   * de 6 dígitos mediante automatización en n8n desde lucasegura2007@gmail.com.
   */
  async register(
    dto: RegisterDto,
    ipAddress?: string,
  ): Promise<PendingVerificationResponse> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { ownedAgency: true },
    });

    if (existing && existing.emailVerified) {
      throw new ConflictException(
        'Ya existe una cuenta verificada con ese correo electrónico.',
      );
    }

    const composedName =
      dto.firstName?.trim() && dto.lastName?.trim()
        ? `${dto.firstName.trim()} ${dto.lastName.trim()}`
        : dto.fullName.trim();

    const agencyName = dto.agencyName?.trim() || `${composedName} Media`;
    const passwordHash = await argon2.hash(dto.password);
    const sixDigitCode = crypto.randomInt(100000, 999999).toString();

    if (existing && !existing.emailVerified) {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: existing.id },
          data: {
            fullName: composedName,
            passwordHash,
            verificationToken: sixDigitCode,
          },
        });
        if (existing.ownedAgency) {
          await tx.agency.update({
            where: { id: existing.ownedAgency.id },
            data: { name: agencyName },
          });
        }
      });
    } else {
      const role = await this.ensureRoleExists(RoleCode.AGENCIA);
      const taxId = `AG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      await this.prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            fullName: composedName,
            roleId: role.id,
            timezone: dto.timezone || 'America/Argentina/Buenos_Aires',
            verificationToken: sixDigitCode,
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
      });
    }

    await this.sendSixDigitVerificationEmail({
      email: normalizedEmail,
      code: sixDigitCode,
      fullName: composedName,
      purpose: 'REGISTER_VERIFY',
    });

    await this.auditService.log({
      action: 'AUTH_REGISTER_OTP_SENT',
      entityType: 'User',
      ipAddress,
      metadata: { email: normalizedEmail },
    });

    return {
      requiresEmailVerification: true,
      email: normalizedEmail,
      message:
        'Te enviamos un código de verificación de 6 dígitos desde lucasegura2007@gmail.com para comprobar que este correo es tuyo.',
    };
  }

  /**
   * Paso 2 del registro: valida el código de 6 dígitos enviado por n8n y activa la sesión.
   */
  async verifyRegistrationCode(
    dto: VerifyRegistrationCodeDto,
    ipAddress?: string,
  ): Promise<AuthTokensResponse> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        role: true,
        ownedAgency: true,
        clientProfile: true,
      },
    });

    if (!user || !user.verificationToken || user.verificationToken !== dto.code.trim()) {
      throw new BadRequestException(
        'El código de 6 dígitos es incorrecto. Revisá tu bandeja de entrada e intentá nuevamente.',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
      },
      include: {
        role: true,
        ownedAgency: true,
        clientProfile: true,
      },
    });

    await this.auditService.log({
      userId: updatedUser.id,
      action: 'AUTH_EMAIL_VERIFIED_OTP',
      entityType: 'User',
      entityId: updatedUser.id,
      ipAddress,
    });

    return this.issueSessionTokens(
      updatedUser,
      'Registro verificado con código de 6 dígitos',
      ipAddress,
    );
  }

  async login(
    dto: LoginDto,
    ipAddress?: string,
  ): Promise<AuthTokensResponse | PendingVerificationResponse> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        role: true,
        ownedAgency: true,
        clientProfile: true,
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Credenciales inválidas o cuenta inactiva.');
    }

    // Requerimiento 4: Si el usuario creó su cuenta con Google/Redes y no posee contraseña guardada,
    // enviamos un código de 6 dígitos vía n8n para que compruebe su identidad y cree su contraseña.
    if (!user.passwordHash) {
      const setupCode = crypto.randomInt(100000, 999999).toString();
      const expires = new Date(Date.now() + 1000 * 60 * 30);

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: setupCode,
          passwordResetExpires: expires,
        },
      });

      await this.sendSixDigitVerificationEmail({
        email: user.email,
        code: setupCode,
        fullName: user.fullName,
        purpose: 'SET_GOOGLE_PASSWORD',
      });

      return {
        requiresPasswordCreation: true,
        email: user.email,
        message:
          'Tu cuenta fue vinculada con Google y aún no tiene contraseña. Te enviamos un código de 6 dígitos a tu correo para comprobar tu identidad y crear tu contraseña.',
      };
    }

    // Si registró su cuenta por formulario pero aún no verificó el código de 6 dígitos de su email:
    if (!user.emailVerified) {
      const sixDigitCode = crypto.randomInt(100000, 999999).toString();
      await this.prisma.user.update({
        where: { id: user.id },
        data: { verificationToken: sixDigitCode },
      });

      await this.sendSixDigitVerificationEmail({
        email: user.email,
        code: sixDigitCode,
        fullName: user.fullName,
        purpose: 'REGISTER_VERIFY',
      });

      return {
        requiresEmailVerification: true,
        email: user.email,
        message:
          'Antes de ingresar debés verificar que este correo te pertenece. Te enviamos un nuevo código de 6 dígitos.',
      };
    }

    if (!dto.password) {
      throw new UnauthorizedException('Ingresá tu contraseña para continuar.');
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
   * Inicio de sesión social (GOOGLE, FACEBOOK, GITHUB) exigiendo Nombre, Apellido y Nombre de Agencia.
   */
  async socialLogin(input: SocialLoginDto, ipAddress?: string): Promise<AuthTokensResponse> {
    if (!input.idToken || input.idToken.trim().length < 10) {
      throw new UnauthorizedException('Token del proveedor social inválido.');
    }

    const identity = await this.socialVerifier.verify(input.provider, input.idToken.trim());
    return this.completeVerifiedSocialLogin({
      provider: input.provider,
      identity,
      firstName: input.firstName,
      lastName: input.lastName,
      fullName: input.fullName,
      agencyName: input.agencyName,
      deviceInfo: input.deviceInfo,
      ipAddress,
    });
  }

  async completeVerifiedSocialLogin(params: {
    provider: SocialProvider;
    identity: VerifiedSocialIdentity;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    agencyName?: string;
    deviceInfo?: string;
    ipAddress?: string;
  }): Promise<AuthTokensResponse> {
    const { provider, identity, ipAddress } = params;
    const normalizedEmail = identity.email.trim().toLowerCase();

    const customFullName =
      params.firstName?.trim() && params.lastName?.trim()
        ? `${params.firstName.trim()} ${params.lastName.trim()}`
        : params.fullName?.trim() || '';
    const customAgencyName = params.agencyName?.trim() || '';

    // 1. Verificar si ya existe el vínculo social
    const existingSocial = await this.prisma.socialAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: identity.providerUserId,
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
      let targetUser = existingSocial.user;
      if (customFullName || (customAgencyName && targetUser.ownedAgency)) {
        await this.prisma.$transaction(async (tx) => {
          if (customFullName) {
            await tx.user.update({
              where: { id: targetUser.id },
              data: { fullName: customFullName },
            });
          }
          if (customAgencyName && targetUser.ownedAgency) {
            await tx.agency.update({
              where: { id: targetUser.ownedAgency.id },
              data: { name: customAgencyName },
            });
          }
        });
        targetUser = await this.prisma.user.findUniqueOrThrow({
          where: { id: targetUser.id },
          include: {
            role: true,
            ownedAgency: true,
            clientProfile: true,
          },
        });
      }

      await this.auditService.log({
        userId: existingSocial.userId,
        action: `AUTH_SOCIAL_LOGIN_${provider}`,
        entityType: 'SocialAuthAccount',
        entityId: existingSocial.id,
        ipAddress,
      });
      return this.issueSessionTokens(targetUser, params.deviceInfo, ipAddress);
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
      if (!customFullName || !customAgencyName) {
        throw new BadRequestException(
          'Completá los campos de Nombre, Apellido y Nombre de la agencia antes de continuar.',
        );
      }

      const defaultRole = await this.ensureRoleExists(RoleCode.AGENCIA);
      const finalName = customFullName || identity.fullName.trim();
      const finalAgencyName = customAgencyName || `${finalName} Media`;
      const taxId = `AG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      user = await this.prisma.$transaction(async (tx) => {
        // Importante: passwordHash queda en null porque inició con Google/Red Social
        const createdUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            fullName: finalName,
            roleId: defaultRole.id,
            emailVerified: true,
          },
        });

        await tx.agency.create({
          data: {
            ownerUserId: createdUser.id,
            name: finalAgencyName,
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
    } else {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user!.id },
          data: {
            emailVerified: true,
            ...(customFullName ? { fullName: customFullName } : {}),
          },
        });
        if (customAgencyName && user!.ownedAgency) {
          await tx.agency.update({
            where: { id: user!.ownedAgency.id },
            data: { name: customAgencyName },
          });
        }
      });
      user = await this.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: {
          role: true,
          ownedAgency: true,
          clientProfile: true,
        },
      });
    }

    // 3. Crear vínculo en social_auth_accounts (3FN)
    const socialAccount = await this.prisma.socialAuthAccount.create({
      data: {
        userId: user.id,
        provider,
        providerUserId: identity.providerUserId,
        email: normalizedEmail,
      },
    });

    await this.auditService.log({
      userId: user.id,
      action: `AUTH_SOCIAL_LINKED_${provider}`,
      entityType: 'SocialAuthAccount',
      entityId: socialAccount.id,
      ipAddress,
    });

    return this.issueSessionTokens(user, params.deviceInfo, ipAddress);
  }

  /** Identificadores públicos para iniciar sesión con Google, Facebook y GitHub. */
  getSocialPublicConfig() {
    return {
      googleClientId: this.configService.get<string>('GOOGLE_AUTH_CLIENT_ID') || null,
      facebookAppId: this.configService.get<string>('FACEBOOK_AUTH_APP_ID') || null,
      githubClientId: this.configService.get<string>('GITHUB_AUTH_CLIENT_ID') || null,
    };
  }

  getOAuthAuthorizeUrl(
    providerParam: string,
    query: { firstName?: string; lastName?: string; agencyName?: string },
    publicBase: string,
  ): string {
    const p = providerParam.trim().toLowerCase();
    const statePayload = Buffer.from(
      JSON.stringify({
        firstName: (query.firstName || '').trim(),
        lastName: (query.lastName || '').trim(),
        agencyName: (query.agencyName || '').trim(),
      }),
      'utf8',
    ).toString('base64url');

    if (p === 'facebook') {
      const appId = this.configService.get<string>('FACEBOOK_AUTH_APP_ID');
      if (!appId) {
        throw new BadRequestException('El inicio de sesión con Facebook no está configurado.');
      }
      const redirectUri = `${publicBase}/api/v1/auth/oauth/facebook/callback`;
      return (
        `https://www.facebook.com/v19.0/dialog/oauth` +
        `?client_id=${encodeURIComponent(appId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=public_profile` +
        `&response_type=code` +
        `&state=${encodeURIComponent(statePayload)}`
      );
    }

    if (p === 'github') {
      const clientId = this.configService.get<string>('GITHUB_AUTH_CLIENT_ID');
      if (!clientId || clientId === 'your-github-client-id') {
        throw new BadRequestException('El inicio de sesión con GitHub no está configurado.');
      }
      const redirectUri = `${publicBase}/api/v1/auth/oauth/github/callback`;
      return (
        `https://github.com/login/oauth/authorize` +
        `?client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent('read:user user:email')}` +
        `&state=${encodeURIComponent(statePayload)}`
      );
    }

    throw new BadRequestException('Proveedor OAuth no soportado.');
  }

  async handleOAuthCallback(
    providerParam: string,
    code: string,
    stateParam: string | undefined,
    ipAddress: string | undefined,
    publicBase: string,
  ): Promise<AuthTokensResponse> {
    if (!code) {
      throw new UnauthorizedException('No se recibió el código de autorización.');
    }

    let parsedState: { firstName?: string; lastName?: string; agencyName?: string } = {};
    if (stateParam) {
      try {
        parsedState = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf8'));
      } catch {
        parsedState = {};
      }
    }

    const p = providerParam.trim().toLowerCase();
    if (p === 'facebook') {
      const redirectUri = `${publicBase}/api/v1/auth/oauth/facebook/callback`;
      const identity = await this.socialVerifier.exchangeFacebookCode(code, redirectUri);
      return this.completeVerifiedSocialLogin({
        provider: SocialProvider.FACEBOOK,
        identity,
        firstName: parsedState.firstName,
        lastName: parsedState.lastName,
        agencyName: parsedState.agencyName,
        deviceInfo: 'OAuth Web Facebook',
        ipAddress,
      });
    }

    if (p === 'github') {
      const redirectUri = `${publicBase}/api/v1/auth/oauth/github/callback`;
      const identity = await this.socialVerifier.exchangeGithubCode(code, redirectUri);
      return this.completeVerifiedSocialLogin({
        provider: SocialProvider.GITHUB,
        identity,
        firstName: parsedState.firstName,
        lastName: parsedState.lastName,
        agencyName: parsedState.agencyName,
        deviceInfo: 'OAuth Web GitHub',
        ipAddress,
      });
    }

    throw new BadRequestException('Proveedor OAuth no soportado.');
  }

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
    const secure =
      this.configService.get<string>('SMTP_SECURE', 'false') === 'true' || port === 465;

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

  /**
   * Envía un código de verificación de 6 dígitos a través de una automatización en n8n
   * enviada desde lucasegura2007@gmail.com (con respaldo automático HTTPS/SMTP).
   */
  async sendSixDigitVerificationEmail(params: {
    email: string;
    code: string;
    fullName: string;
    purpose: 'REGISTER_VERIFY' | 'SET_GOOGLE_PASSWORD' | 'PASSWORD_RECOVERY';
  }): Promise<boolean> {
    const { email, code, fullName, purpose } = params;
    const mailer = this.getMailer();
    const from = this.configService.get<string>(
      'SMTP_FROM',
      '"ContentSync" <lucasegura2007@gmail.com>',
    );

    const titles: Record<typeof purpose, { subject: string; heading: string; intro: string }> = {
      REGISTER_VERIFY: {
        subject: `${code} es tu código de verificación de cuenta en ContentSync`,
        heading: 'Verificación de tu correo electrónico',
        intro:
          'Para comprobar que este correo te pertenece y activar tu cuenta de Agencia en ContentSync, ingresá el siguiente código de 6 dígitos:',
      },
      SET_GOOGLE_PASSWORD: {
        subject: `${code} es tu código para crear tu contraseña en ContentSync`,
        heading: 'Comprobación de identidad · Crear contraseña',
        intro:
          'Tu cuenta fue creada continuando con Google. Para comprobar tu identidad y guardar una contraseña propia en ContentSync, ingresá este código de 6 dígitos:',
      },
      PASSWORD_RECOVERY: {
        subject: `${code} es tu código de recuperación de ContentSync`,
        heading: 'Recuperación de contraseña',
        intro:
          'Recibimos una solicitud para restablecer tu contraseña en ContentSync. Tu código de verificación de 6 dígitos es:',
      },
    };

    const copy = titles[purpose];
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #0f1116; color: #f2f3f5; border: 1px solid #2b3140; border-radius: 8px;">
        <div style="font-family: monospace; font-size: 12px; letter-spacing: 0.08em; color: #d4f238; text-transform: uppercase; margin-bottom: 10px;">CONTENTSYNC · VERIFICACIÓN DE 6 DÍGITOS</div>
        <h2 style="color: #ffffff; margin-top: 0; font-size: 20px;">${copy.heading}</h2>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.5;">Hola <strong>${fullName || 'Usuario'}</strong>,</p>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.5;">${copy.intro}</p>
        <div style="background: #171a21; border: 1px dashed #d4f238; border-radius: 6px; padding: 18px; text-align: center; margin: 24px 0;">
          <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 34px; font-weight: 700; letter-spacing: 6px; color: #d4f238;">${code}</span>
        </div>
        <p style="color: #94a3b8; font-size: 13px; line-height: 1.4;">Este código es de un solo uso y expirará en 30 minutos.<br/>Enviado desde <strong>lucasegura2007@gmail.com</strong> mediante automatización n8n.</p>
      </div>
    `;

    const textBody = `Hola ${fullName},\n\n${copy.intro}\n\nCódigo de 6 dígitos: ${code}\n\nExpira en 30 minutos.`;

    // 1. Automatización n8n (Webhook primario)
    const n8nWebhookUrl = this.configService.get<string>('N8N_WEBHOOK_URL');
    if (n8nWebhookUrl) {
      try {
        const n8nRes = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            to: email,
            fullName,
            code,
            purpose,
            subject: copy.subject,
            text: textBody,
            html,
            senderEmail: 'lucasegura2007@gmail.com',
            fromName: 'ContentSync',
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (n8nRes.ok) {
          this.logger.log(`[N8N-AUTOMATION] Código 6 dígitos (${purpose}) enviado a ${email}`);
          return true;
        }
      } catch (err: any) {
        this.logger.warn(
          `[N8N-AUTOMATION] Falló webhook n8n (${err.message}), usando respaldo directo de lucasegura2007@gmail.com`,
        );
      }
    }

    // 2. Respaldo HTTPS directo desde lucasegura2007@gmail.com
    const webhookUrl = this.configService.get<string>('GMAIL_HTTPS_WEBHOOK_URL');
    const webhookSecret = this.configService.get<string>('GMAIL_WEBHOOK_SECRET') || '';

    if (webhookUrl) {
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: webhookSecret,
            to: email,
            subject: copy.subject,
            text: textBody,
            html,
            fromName: 'ContentSync',
          }),
        });
        if (res.ok) {
          this.logger.log(`[HTTPS-MAIL] Código 6 dígitos (${purpose}) enviado a ${email}`);
          return true;
        }
      } catch (err: any) {
        this.logger.warn(`[HTTPS-MAIL] Falló relay HTTPS, probando SMTP: ${err.message}`);
      }
    }

    // 3. Respaldo SMTP directo desde lucasegura2007@gmail.com
    if (mailer) {
      try {
        await mailer.sendMail({
          from,
          to: email,
          subject: copy.subject,
          text: textBody,
          html,
        });
        this.logger.log(`[SMTP] Código 6 dígitos (${purpose}) enviado a ${email}`);
        return true;
      } catch (err: any) {
        this.logger.error(`[SMTP ERROR] Falló el envío de correo a ${email}: ${err.message}`);
        return false;
      }
    }

    this.logger.warn(`[MAIL NO CONFIGURADO] Código (${purpose}) para ${email}: ${code}`);
    return false;
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string; hasPassword?: boolean }> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user) {
      return {
        message:
          'Si el correo está registrado, enviamos un código de verificación de 6 dígitos a tu casilla de correo.',
      };
    }

    const resetToken = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 1000 * 60 * 30);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: expires,
      },
    });

    await this.sendSixDigitVerificationEmail({
      email: user.email,
      code: resetToken,
      fullName: user.fullName,
      purpose: user.passwordHash ? 'PASSWORD_RECOVERY' : 'SET_GOOGLE_PASSWORD',
    });

    return {
      hasPassword: Boolean(user.passwordHash),
      message: user.passwordHash
        ? 'Enviamos un código de verificación de 6 dígitos a tu correo.'
        : 'Tu cuenta fue creada con Google. Enviamos un código de 6 dígitos a tu correo para comprobar tu identidad y crear tu contraseña.',
    };
  }

  /**
   * Comprueba únicamente el código de 6 dígitos antes de habilitar el campo para guardar la contraseña.
   */
  async verifyOtpCode(dto: VerifyOtpCodeDto): Promise<{ verified: boolean; message: string }> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        passwordResetToken: dto.code.trim(),
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException(
        'El código de 6 dígitos es incorrecto o ya expiró. Verificá tu correo.',
      );
    }

    return {
      verified: true,
      message: 'Identidad comprobada. Ahora podés ingresar y guardar tu contraseña.',
    };
  }

  async resetPassword(
    dto: ResetPasswordDto,
    ipAddress?: string,
  ): Promise<{ message: string; session: AuthTokensResponse }> {
    const whereClause: Record<string, any> = {
      passwordResetToken: dto.token.trim(),
      passwordResetExpires: { gt: new Date() },
    };
    if (dto.email) {
      whereClause.email = dto.email.trim().toLowerCase();
    }

    const user = await this.prisma.user.findFirst({
      where: whereClause,
    });
    if (!user) {
      throw new BadRequestException('El código de verificación es incorrecto o ya expiró.');
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        emailVerified: true,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
      include: {
        role: true,
        ownedAgency: true,
        clientProfile: true,
      },
    });

    await this.prisma.authSession.updateMany({
      where: { userId: user.id },
      data: { isRevoked: true },
    });

    const session = await this.issueSessionTokens(
      updatedUser,
      'Contraseña configurada con código de 6 dígitos',
      ipAddress,
    );

    return {
      message: 'Contraseña guardada exitosamente.',
      session,
    };
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
      expiresIn: '7d',
    });

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        sessionId,
        tokenFamily,
      },
      {
        secret: this.refreshSecret,
        expiresIn: '30d',
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
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresInSeconds: 604800,
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

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RoleCode, SocialProvider } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { MailService } from '../../common/mail/mail.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { escapeHtml } from '../../common/utils/html';
import { OAuthStateService } from '../../common/utils/oauth-state.service';
import { isValidTimeZone } from '../../common/utils/timezone';
import { AppConfigService, durationToSeconds } from '../../config/app-config.service';
import { SettingsService } from '../settings/settings.service';
import { SocialTokenVerifierService, VerifiedSocialIdentity } from './social-token-verifier.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  SocialLoginDto,
  UpdateProfileDto,
  CompleteProfileDto,
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
    agencyName: string | null;
    needsProfileSetup: boolean;
    clientId: string | null;
  };
}

export interface PendingVerificationResponse {
  requiresEmailVerification?: boolean;
  requiresPasswordCreation?: boolean;
  email: string;
  message: string;
}

type OtpPurpose = 'REGISTER_VERIFY' | 'SET_GOOGLE_PASSWORD' | 'PASSWORD_RECOVERY';

const USER_RELATIONS = {
  role: true,
  ownedAgency: true,
  clientProfile: { include: { agency: { select: { isSuspended: true } } } },
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
    private readonly auditService: AuditService,
    private readonly socialVerifier: SocialTokenVerifierService,
    private readonly mailService: MailService,
    private readonly settings: SettingsService,
    private readonly oauthState: OAuthStateService,
  ) {}

  private ensureRoleExists(code: RoleCode) {
    return this.prisma.role.upsert({
      where: { code },
      update: {},
      create: { code, name: code },
    });
  }

  private assertAccountUsable(user: {
    isActive: boolean;
    deletedAt: Date | null;
    ownedAgency?: { isSuspended: boolean } | null;
    clientProfile?: { agency?: { isSuspended: boolean } | null } | null;
  }): void {
    if (!user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Credenciales inválidas o cuenta inactiva.');
    }
    if (user.ownedAgency?.isSuspended || user.clientProfile?.agency?.isSuspended) {
      throw new ForbiddenException('La agencia asociada a esta cuenta se encuentra suspendida.');
    }
  }

  // ---------------------------------------------------------------------------
  // Códigos OTP: se guardan como HMAC, vencen y admiten una cantidad limitada de intentos.
  // ---------------------------------------------------------------------------

  private newOtp(): string {
    return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  }

  private hashOtp(code: string): string {
    return crypto.createHmac('sha256', this.config.jwtRefreshSecret).update(code.trim()).digest('hex');
  }

  private otpMatches(storedHash: string | null, code: string): boolean {
    if (!storedHash) return false;
    const stored = Buffer.from(storedHash);
    const received = Buffer.from(this.hashOtp(code));
    return stored.length === received.length && crypto.timingSafeEqual(stored, received);
  }

  private otpExpiry(): Date {
    return new Date(Date.now() + this.settings.current().otpTtlMinutes * 60000);
  }

  /** Un código emitido hace menos del tiempo de espera sigue vigente: no se reenvía otro correo. */
  private recentlySent(expires: Date | null): boolean {
    if (!expires) return false;
    const { otpTtlMinutes, otpResendCooldownSeconds } = this.settings.current();
    const sentAt = expires.getTime() - otpTtlMinutes * 60000;
    return Date.now() - sentAt < otpResendCooldownSeconds * 1000;
  }

  /** Registra un intento fallido e invalida el código al alcanzar el máximo configurado. */
  private async registerOtpFailure(user: { id: string; otpFailedAttempts: number }): Promise<never> {
    const attempts = user.otpFailedAttempts + 1;
    const exhausted = attempts >= this.settings.current().otpMaxAttempts;
    await this.prisma.user.update({
      where: { id: user.id },
      data: exhausted
        ? {
            otpFailedAttempts: 0,
            verificationToken: null,
            verificationExpires: null,
            passwordResetToken: null,
            passwordResetExpires: null,
          }
        : { otpFailedAttempts: attempts },
    });
    throw new BadRequestException(
      exhausted
        ? 'Superaste el máximo de intentos. Solicitá un código nuevo.'
        : 'El código de 6 dígitos es incorrecto o ya expiró. Verificá tu correo.',
    );
  }

  private async sendOtpOrFail(params: { email: string; code: string; fullName: string; purpose: OtpPurpose }) {
    const sent = await this.sendSixDigitVerificationEmail(params);
    // En desarrollo el código queda en el log del servidor; en producción sería un callejón sin salida.
    if (!sent && this.config.isProduction) {
      throw new ServiceUnavailableException('No pudimos enviar el correo de verificación. Intentá de nuevo en unos minutos.');
    }
  }

  private async sendSixDigitVerificationEmail(params: {
    email: string;
    code: string;
    fullName: string;
    purpose: OtpPurpose;
  }): Promise<boolean> {
    const { email, code, fullName, purpose } = params;
    const { appName, otpTtlMinutes } = this.settings.current();
    const brand = escapeHtml(appName);
    const senderAddress = this.config.mailSenderAddress;

    const titles: Record<OtpPurpose, { subject: string; heading: string; intro: string }> = {
      REGISTER_VERIFY: {
        subject: `${code} es tu código de verificación de cuenta en ${appName}`,
        heading: 'Verificación de tu correo electrónico',
        intro: `Para comprobar que este correo te pertenece y activar tu cuenta en ${appName}, ingresá el siguiente código de 6 dígitos:`,
      },
      SET_GOOGLE_PASSWORD: {
        subject: `${code} es tu código para crear tu contraseña en ${appName}`,
        heading: 'Comprobación de identidad · Crear contraseña',
        intro: `Tu cuenta todavía no tiene contraseña. Para comprobar tu identidad y guardar una contraseña propia en ${appName}, ingresá este código de 6 dígitos:`,
      },
      PASSWORD_RECOVERY: {
        subject: `${code} es tu código de recuperación de ${appName}`,
        heading: 'Recuperación de contraseña',
        intro: `Recibimos una solicitud para restablecer tu contraseña en ${appName}. Tu código de verificación de 6 dígitos es:`,
      },
    };

    const copy = titles[purpose];
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #0f1116; color: #f2f3f5; border: 1px solid #2b3140; border-radius: 8px;">
        <div style="font-family: monospace; font-size: 12px; letter-spacing: 0.08em; color: #d4f238; text-transform: uppercase; margin-bottom: 10px;">${brand} · VERIFICACIÓN DE 6 DÍGITOS</div>
        <h2 style="color: #ffffff; margin-top: 0; font-size: 20px;">${copy.heading}</h2>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.5;">Hola <strong>${escapeHtml(fullName) || 'Usuario'}</strong>,</p>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.5;">${escapeHtml(copy.intro)}</p>
        <div style="background: #171a21; border: 1px dashed #d4f238; border-radius: 6px; padding: 18px; text-align: center; margin: 24px 0;">
          <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 34px; font-weight: 700; letter-spacing: 6px; color: #d4f238;">${code}</span>
        </div>
        <p style="color: #94a3b8; font-size: 13px; line-height: 1.4;">Este código es de un solo uso y expira en ${otpTtlMinutes} minutos.${senderAddress ? `<br/>Enviado desde <strong>${escapeHtml(senderAddress)}</strong>.` : ''}</p>
      </div>
    `;
    const text = `Hola ${fullName},\n\n${copy.intro}\n\nCódigo de 6 dígitos: ${code}\n\nExpira en ${otpTtlMinutes} minutos.`;

    return this.mailService.send(
      'otp',
      { to: email, subject: copy.subject, text, html, meta: { code, purpose, fullName } },
      appName,
    );
  }

  private senderHint(): string {
    const address = this.config.mailSenderAddress;
    return address ? ` desde ${address}` : '';
  }

  // ---------------------------------------------------------------------------
  // Registro y verificación
  // ---------------------------------------------------------------------------

  /** Registro en 2 pasos: guarda la agencia sin verificar y envía un código de 6 dígitos. */
  async register(dto: RegisterDto, ipAddress?: string): Promise<PendingVerificationResponse> {
    const settings = this.settings.current();
    if (!settings.registrationEnabled) {
      throw new ForbiddenException('El registro de nuevas agencias está deshabilitado.');
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { ownedAgency: true, clientProfile: true },
    });

    // Un perfil de cliente pendiente no se puede pisar: su titular lo resuelve con "Sí, soy yo".
    if (existing && (existing.emailVerified || existing.clientProfile || existing.deletedAt)) {
      throw new ConflictException('Ya existe una cuenta con ese correo electrónico.');
    }

    if (dto.timezone && !isValidTimeZone(dto.timezone)) {
      throw new BadRequestException('Zona horaria desconocida.');
    }

    const composedName =
      dto.firstName?.trim() && dto.lastName?.trim()
        ? `${dto.firstName.trim()} ${dto.lastName.trim()}`
        : dto.fullName.trim();
    const agencyName = dto.agencyName?.trim() || `${composedName} Media`;
    const passwordHash = await argon2.hash(dto.password);
    const code = this.newOtp();
    const otpData = {
      verificationToken: this.hashOtp(code),
      verificationExpires: this.otpExpiry(),
      otpFailedAttempts: 0,
    };

    if (existing) {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: existing.id },
          data: { fullName: composedName, passwordHash, ...otpData },
        });
        if (existing.ownedAgency) {
          await tx.agency.update({ where: { id: existing.ownedAgency.id }, data: { name: agencyName } });
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
            timezone: dto.timezone || settings.defaultTimezone,
            emailVerified: false,
            ...otpData,
          },
        });
        await tx.agency.create({ data: { ownerUserId: createdUser.id, name: agencyName, taxId } });
      });
    }

    await this.sendOtpOrFail({
      email: normalizedEmail,
      code,
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
      message: `Te enviamos un código de verificación de 6 dígitos${this.senderHint()} para comprobar que este correo es tuyo.`,
    };
  }

  /** Paso 2 del registro: valida el código de 6 dígitos y abre la sesión. */
  async verifyRegistrationCode(dto: VerifyRegistrationCodeDto, ipAddress?: string): Promise<AuthTokensResponse> {
    const invalid = () =>
      new BadRequestException('El código de 6 dígitos es incorrecto o ya expiró. Verificá tu correo.');
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      include: USER_RELATIONS,
    });
    if (!user || !user.isActive || user.deletedAt || !user.verificationToken) throw invalid();
    if (!user.verificationExpires || user.verificationExpires < new Date()) throw invalid();
    if (!this.otpMatches(user.verificationToken, dto.code)) {
      return this.registerOtpFailure(user);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationToken: null, verificationExpires: null, otpFailedAttempts: 0 },
      include: USER_RELATIONS,
    });

    await this.auditService.log({
      userId: updatedUser.id,
      action: 'AUTH_EMAIL_VERIFIED_OTP',
      entityType: 'User',
      entityId: updatedUser.id,
      ipAddress,
    });

    return this.issueSessionTokens(updatedUser, 'Registro verificado con código de 6 dígitos', ipAddress);
  }

  async login(dto: LoginDto, ipAddress?: string): Promise<AuthTokensResponse | PendingVerificationResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      include: USER_RELATIONS,
    });

    if (!user) throw new UnauthorizedException('Credenciales inválidas o cuenta inactiva.');
    this.assertAccountUsable(user);

    // Cuentas sin contraseña (login social o cliente recién invitado): se comprueba la identidad por correo.
    if (!user.passwordHash) {
      if (!this.recentlySent(user.passwordResetExpires)) {
        const code = this.newOtp();
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            passwordResetToken: this.hashOtp(code),
            passwordResetExpires: this.otpExpiry(),
            otpFailedAttempts: 0,
          },
        });
        await this.sendOtpOrFail({
          email: user.email,
          code,
          fullName: user.fullName,
          purpose: 'SET_GOOGLE_PASSWORD',
        });
      }
      return {
        requiresPasswordCreation: true,
        email: user.email,
        message:
          'Tu cuenta aún no tiene contraseña. Te enviamos un código de 6 dígitos a tu correo para comprobar tu identidad y crearla.',
      };
    }

    if (!dto.password) {
      throw new UnauthorizedException('Ingresá tu contraseña para continuar.');
    }

    // La contraseña se valida antes de cualquier envío: si no, un tercero podría disparar correos.
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

    if (!user.emailVerified) {
      if (!this.recentlySent(user.verificationExpires)) {
        const code = this.newOtp();
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            verificationToken: this.hashOtp(code),
            verificationExpires: this.otpExpiry(),
            otpFailedAttempts: 0,
          },
        });
        await this.sendOtpOrFail({
          email: user.email,
          code,
          fullName: user.fullName,
          purpose: 'REGISTER_VERIFY',
        });
      }
      return {
        requiresEmailVerification: true,
        email: user.email,
        message: 'Antes de ingresar debés verificar que este correo te pertenece. Revisá tu código de 6 dígitos.',
      };
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

  // ---------------------------------------------------------------------------
  // Acceso social
  // ---------------------------------------------------------------------------

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

    const existingSocial = await this.prisma.socialAuthAccount.findUnique({
      where: { provider_providerUserId: { provider, providerUserId: identity.providerUserId } },
      include: { user: { include: USER_RELATIONS } },
    });

    if (existingSocial) {
      this.assertAccountUsable(existingSocial.user);
      await this.auditService.log({
        userId: existingSocial.userId,
        action: `AUTH_SOCIAL_LOGIN_${provider}`,
        entityType: 'SocialAuthAccount',
        entityId: existingSocial.id,
        ipAddress,
      });
      return this.issueSessionTokens(existingSocial.user, params.deviceInfo, ipAddress);
    }

    let user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: USER_RELATIONS,
    });

    if (!user) {
      const settings = this.settings.current();
      if (!settings.registrationEnabled) {
        throw new ForbiddenException('El registro de nuevas agencias está deshabilitado.');
      }
      // Valores provisorios: al entrar, el pop up obligatorio le pide que confirme sus datos.
      const customFullName =
        params.firstName?.trim() && params.lastName?.trim()
          ? `${params.firstName.trim()} ${params.lastName.trim()}`
          : params.fullName?.trim() || identity.fullName.trim() || normalizedEmail.split('@')[0];
      const customAgencyName = params.agencyName?.trim() || `Agencia de ${customFullName.split(' ')[0]}`;

      const defaultRole = await this.ensureRoleExists(RoleCode.AGENCIA);
      const taxId = `AG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      user = await this.prisma.$transaction(async (tx) => {
        // passwordHash queda en null: la cuenta se creó con un proveedor social.
        const createdUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            fullName: customFullName,
            roleId: defaultRole.id,
            timezone: settings.defaultTimezone,
            emailVerified: true,
            needsProfileSetup: true,
          },
        });
        await tx.agency.create({
          data: { ownerUserId: createdUser.id, name: customAgencyName, taxId },
        });
        return tx.user.findUniqueOrThrow({ where: { id: createdUser.id }, include: USER_RELATIONS });
      });
    } else {
      // Vincular por correo equivale a entregar la cuenta: exige un correo verificado por el proveedor.
      if (!identity.emailVerified) {
        throw new ConflictException(
          'Ya existe una cuenta con ese correo. Iniciá sesión con tu contraseña o con el proveedor que usaste originalmente.',
        );
      }
      this.assertAccountUsable(user);
      const target = user;
      user = await this.prisma.user.update({
        where: { id: target.id },
        data: {
          emailVerified: true,
          // Si nadie verificó el correo, esa contraseña pudo haberla puesto un tercero: se descarta.
          ...(target.emailVerified
            ? {}
            : { passwordHash: null, verificationToken: null, verificationExpires: null }),
        },
        include: USER_RELATIONS,
      });
    }

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
      googleClientId: this.config.get('GOOGLE_AUTH_CLIENT_ID') || null,
      facebookAppId: this.config.get('FACEBOOK_AUTH_APP_ID') || null,
      githubClientId: this.config.get('GITHUB_AUTH_CLIENT_ID') || null,
    };
  }

  private socialCallbackUrl(provider: string, requestBase?: string): string {
    return this.config.apiUrl(`auth/oauth/${provider}/callback`, requestBase);
  }

  getOAuthAuthorizeUrl(
    providerParam: string,
    query: { firstName?: string; lastName?: string; agencyName?: string },
    requestBase: string | undefined,
    nonce: string,
  ): string {
    const provider = providerParam.trim().toLowerCase();
    const state = this.oauthState.sign('social-login', {
      nonce,
      firstName: (query.firstName || '').trim().slice(0, 80),
      lastName: (query.lastName || '').trim().slice(0, 80),
      agencyName: (query.agencyName || '').trim().slice(0, 150),
    });
    const redirectUri = this.socialCallbackUrl(provider, requestBase);

    if (provider === 'facebook') {
      const appId = this.config.get('FACEBOOK_AUTH_APP_ID');
      if (!appId) {
        throw new BadRequestException('El inicio de sesión con Facebook no está configurado.');
      }
      const params = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        scope: 'public_profile,email',
        response_type: 'code',
        state,
      });
      return `https://www.facebook.com/${this.config.metaGraphVersion}/dialog/oauth?${params.toString()}`;
    }

    if (provider === 'github') {
      const clientId = this.config.get('GITHUB_AUTH_CLIENT_ID');
      if (!clientId) {
        throw new BadRequestException('El inicio de sesión con GitHub no está configurado.');
      }
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'read:user user:email',
        state,
      });
      return `https://github.com/login/oauth/authorize?${params.toString()}`;
    }

    throw new BadRequestException('Proveedor OAuth no soportado.');
  }

  async handleOAuthCallback(
    providerParam: string,
    code: string,
    stateParam: string | undefined,
    cookieNonce: string | undefined,
    ipAddress: string | undefined,
    requestBase: string | undefined,
  ): Promise<AuthTokensResponse> {
    const state = this.oauthState.verify<{
      nonce?: string;
      firstName?: string;
      lastName?: string;
      agencyName?: string;
    }>('social-login', stateParam);

    // Atar el flujo al navegador que lo inició impide que alguien inicie sesión a otro con su propia cuenta.
    if (!this.oauthState.nonceMatches(state.nonce, cookieNonce)) {
      throw new UnauthorizedException('La autorización no se inició desde este navegador. Volvé a intentarlo.');
    }

    const provider = providerParam.trim().toLowerCase();
    const redirectUri = this.socialCallbackUrl(provider, requestBase);
    let socialProvider: SocialProvider;
    let identity: VerifiedSocialIdentity;
    if (provider === 'facebook') {
      socialProvider = SocialProvider.FACEBOOK;
      identity = await this.socialVerifier.exchangeFacebookCode(code, redirectUri);
    } else if (provider === 'github') {
      socialProvider = SocialProvider.GITHUB;
      identity = await this.socialVerifier.exchangeGithubCode(code, redirectUri);
    } else {
      throw new BadRequestException('Proveedor OAuth no soportado.');
    }

    return this.completeVerifiedSocialLogin({
      provider: socialProvider,
      identity,
      firstName: state.firstName,
      lastName: state.lastName,
      agencyName: state.agencyName,
      deviceInfo: `OAuth Web ${socialProvider}`,
      ipAddress,
    });
  }

  // ---------------------------------------------------------------------------
  // Sesiones
  // ---------------------------------------------------------------------------

  async refreshTokens(dto: RefreshTokenDto, ipAddress?: string): Promise<AuthTokensResponse> {
    let decoded: { sub: string; sessionId?: string; tokenFamily: string };
    try {
      decoded = await this.jwtService.verifyAsync(dto.refreshToken, { secret: this.config.jwtRefreshSecret });
    } catch {
      throw new UnauthorizedException('Refresh token expirado o firma inválida.');
    }
    if (!decoded.sessionId) {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: decoded.sessionId },
      include: { user: { include: USER_RELATIONS } },
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
    this.assertAccountUsable(session.user);

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { rotatedAt: new Date(), isRevoked: true },
    });

    return this.issueSessionTokens(session.user, session.deviceInfo ?? undefined, ipAddress, session.tokenFamily);
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

  /** No depende del access token: cerrar sesión debe funcionar aunque ya haya vencido. */
  async logoutWithRefreshToken(refreshToken: string | null | undefined, ipAddress?: string) {
    if (refreshToken) {
      try {
        const decoded = await this.jwtService.verifyAsync<{ sub: string }>(refreshToken, {
          secret: this.config.jwtRefreshSecret,
        });
        return await this.logout(decoded.sub, ipAddress);
      } catch {
        // Un token vencido o inválido ya no abre sesión: alcanza con borrar la cookie.
      }
    }
    return { message: 'Sesión cerrada.' };
  }

  /** Se completa una sola vez: después, estos datos se editan en Ajustes. */
  async completeProfile(userId: string, dto: CompleteProfileDto) {
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const agencyName = dto.agencyName.trim();
    if (firstName.length < 2 || lastName.length < 2 || agencyName.length < 2) {
      throw new BadRequestException('Completá tu nombre, tu apellido y el nombre de tu agencia.');
    }
    const fullName = `${firstName} ${lastName}`;
    await this.prisma.$transaction([
      this.prisma.agency.updateMany({ where: { ownerUserId: userId }, data: { name: agencyName } }),
      this.prisma.user.update({ where: { id: userId }, data: { fullName, needsProfileSetup: false } }),
    ]);
    return { fullName, agencyName, needsProfileSetup: false };
  }

  /** Perfil propio editable: nombre visible, zona horaria y el nombre de la agencia de la que es dueño. */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.timezone && !isValidTimeZone(dto.timezone)) {
      throw new BadRequestException('Zona horaria desconocida.');
    }
    const agencyName = dto.agencyName?.trim();
    if (agencyName) {
      // updateMany: quien no es dueño de una agencia, como un cliente, no cambia nada.
      await this.prisma.agency.updateMany({ where: { ownerUserId: userId }, data: { name: agencyName } });
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { fullName: dto.fullName?.trim(), timezone: dto.timezone },
      include: { ownedAgency: { select: { name: true } } },
    });
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      timezone: user.timezone,
      agencyName: user.ownedAgency?.name ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // Recuperación y creación de contraseña
  // ---------------------------------------------------------------------------

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    // La respuesta es idéntica exista o no la cuenta, para no revelar qué correos están registrados.
    const message = 'Si el correo está registrado, enviamos un código de verificación de 6 dígitos a tu casilla.';
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (!user || !user.isActive || user.deletedAt || this.recentlySent(user.passwordResetExpires)) {
      return { message };
    }

    const code = this.newOtp();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: this.hashOtp(code),
        passwordResetExpires: this.otpExpiry(),
        otpFailedAttempts: 0,
      },
    });
    await this.sendOtpOrFail({
      email: user.email,
      code,
      fullName: user.fullName,
      purpose: user.passwordHash ? 'PASSWORD_RECOVERY' : 'SET_GOOGLE_PASSWORD',
    });
    return { message };
  }

  private async findUserWithValidResetCode(email: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    const invalid = () =>
      new BadRequestException('El código de 6 dígitos es incorrecto o ya expiró. Verificá tu correo.');
    if (!user || !user.isActive || user.deletedAt || !user.passwordResetToken) throw invalid();
    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) throw invalid();
    if (!this.otpMatches(user.passwordResetToken, code)) {
      return this.registerOtpFailure(user);
    }
    return user;
  }

  /** Comprueba el código de 6 dígitos antes de habilitar el campo para guardar la contraseña. */
  async verifyOtpCode(dto: VerifyOtpCodeDto): Promise<{ verified: boolean; message: string }> {
    await this.findUserWithValidResetCode(dto.email, dto.code);
    return { verified: true, message: 'Identidad comprobada. Ahora podés ingresar y guardar tu contraseña.' };
  }

  async resetPassword(
    dto: ResetPasswordDto,
    ipAddress?: string,
  ): Promise<{ message: string; session: AuthTokensResponse }> {
    const user = await this.findUserWithValidResetCode(dto.email, dto.token);
    const passwordHash = await argon2.hash(dto.newPassword);
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        emailVerified: true,
        passwordResetToken: null,
        passwordResetExpires: null,
        verificationToken: null,
        verificationExpires: null,
        otpFailedAttempts: 0,
      },
      include: USER_RELATIONS,
    });

    await this.prisma.authSession.updateMany({ where: { userId: user.id }, data: { isRevoked: true } });
    await this.auditService.log({
      userId: user.id,
      action: 'AUTH_PASSWORD_RESET',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    const session = await this.issueSessionTokens(
      updatedUser,
      'Contraseña configurada con código de 6 dígitos',
      ipAddress,
    );
    return { message: 'Contraseña guardada exitosamente.', session };
  }

  private async issueSessionTokens(
    user: {
      id: string;
      email: string;
      fullName: string;
      timezone: string;
      emailVerified: boolean;
      needsProfileSetup?: boolean;
      role: { code: RoleCode };
      ownedAgency?: { id: string; name?: string } | null;
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
    const accessTtlSeconds = durationToSeconds(this.config.jwtAccessExpiresIn);
    const refreshTtlSeconds = durationToSeconds(this.config.jwtRefreshExpiresIn);

    const accessPayload: AuthenticatedUser = {
      sub: user.id,
      email: user.email,
      role: user.role.code,
      agencyId,
      clientId,
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.config.jwtAccessSecret,
      expiresIn: accessTtlSeconds,
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, sessionId, tokenFamily },
      { secret: this.config.jwtRefreshSecret, expiresIn: refreshTtlSeconds },
    );

    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenFamily,
        refreshTokenHash: await argon2.hash(refreshToken),
        deviceInfo: deviceInfo?.slice(0, 255) ?? null,
        ipAddress: ipAddress ?? null,
        expiresAt: new Date(Date.now() + refreshTtlSeconds * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresInSeconds: accessTtlSeconds,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role.code,
        timezone: user.timezone,
        emailVerified: user.emailVerified,
        agencyId,
        agencyName: user.ownedAgency?.name ?? null,
        needsProfileSetup: Boolean(user.needsProfileSetup),
        clientId,
      },
    };
  }
}

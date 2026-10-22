import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RoleCode } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
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
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
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

    const targetRoleCode = dto.role === RoleCode.CLIENTE ? RoleCode.CLIENTE : RoleCode.AGENCIA;
    const role = await this.ensureRoleExists(targetRoleCode);
    const passwordHash = await argon2.hash(dto.password);
    const verificationToken = crypto.randomBytes(24).toString('hex');

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        fullName: dto.fullName.trim(),
        roleId: role.id,
        timezone: dto.timezone || 'America/Argentina/Buenos_Aires',
        verificationToken,
        emailVerified: false,
      },
      include: {
        role: true,
        ownedAgency: true,
        clientProfile: true,
      },
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
  async socialLogin(dto: SocialLoginDto, ipAddress?: string): Promise<AuthTokensResponse> {
    if (!dto.idToken || dto.idToken.trim().length < 10) {
      throw new UnauthorizedException('Token del proveedor social inválido.');
    }

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
      user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          fullName: dto.fullName.trim(),
          roleId: defaultRole.id,
          emailVerified: true,
        },
        include: {
          role: true,
          ownedAgency: true,
          clientProfile: true,
        },
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

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ message: string; resetTokenMock?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (!user) {
      return {
        message: 'Si el correo existe, se han enviado las instrucciones de recuperación.',
      };
    }

    const resetToken = crypto.randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 30); // 30 minutos

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: expires,
      },
    });

    return {
      message: 'Si el correo existe, se han enviado las instrucciones de recuperación.',
      resetTokenMock: resetToken,
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: dto.token,
        passwordResetExpires: { gt: new Date() },
      },
    });
    if (!user) {
      throw new BadRequestException('Token de recuperación inválido o expirado.');
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

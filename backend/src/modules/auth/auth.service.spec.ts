import {
  BadRequestException,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RoleCode, SocialProvider } from '@prisma/client';
import * as argon2 from 'argon2';
import { RolesGuard } from '../../common/guards/auth-rbac.guards';
import { OAuthStateService } from '../../common/utils/oauth-state.service';
import { AppConfigService } from '../../config/app-config.service';
import { cloneDefaultSettings } from '../settings/settings.defaults';
import { AuthService } from './auth.service';

const REFRESH_SECRET = 'test_refresh_secret_0123456789abcdef0123456789abcdef';

describe('AuthService & RolesGuard', () => {
  const tx = {
    user: { create: jest.fn().mockResolvedValue({ id: 'user-new' }), update: jest.fn(), findUniqueOrThrow: jest.fn() },
    agency: { create: jest.fn(), update: jest.fn() },
  };
  const mockPrisma: any = {
    agency: { updateMany: jest.fn() },
    role: { upsert: jest.fn().mockResolvedValue({ id: 'role-agency-uuid', code: RoleCode.AGENCIA }) },
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    authSession: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    socialAuthAccount: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
  };
  const mockAudit: any = { log: jest.fn().mockResolvedValue(undefined) };
  const mockVerifier: any = { verify: jest.fn() };
  const mockMail: any = { send: jest.fn().mockResolvedValue(true) };
  const settings: any = { current: jest.fn(() => cloneDefaultSettings()) };

  const baseUser = {
    id: 'user-1',
    email: 'user@agencia.com',
    fullName: 'Usuario',
    timezone: 'America/Argentina/Buenos_Aires',
    emailVerified: true,
    isActive: true,
    deletedAt: null,
    passwordHash: null as string | null,
    verificationToken: null as string | null,
    verificationExpires: null as Date | null,
    passwordResetToken: null as string | null,
    passwordResetExpires: null as Date | null,
    otpFailedAttempts: 0,
    role: { code: RoleCode.AGENCIA },
    ownedAgency: { id: 'agency-1', isSuspended: false },
    clientProfile: null,
  };

  let authService: AuthService;
  let jwtService: JwtService;
  let config: AppConfigService;

  /** Reproduce el código tal como lo guarda el servicio, sin exponer el método privado en producción. */
  const hashOf = (code: string) => (authService as any).hashOtp(code) as string;
  const sentCode = () => mockMail.send.mock.calls.at(-1)[1].meta.code as string;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockReset();
    mockPrisma.socialAuthAccount.findUnique.mockReset();
    mockMail.send.mockResolvedValue(true);
    jwtService = new JwtService({});
    const configService = new ConfigService({
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'test_access_secret_0123456789abcdef0123456789abcdef',
      JWT_REFRESH_SECRET: REFRESH_SECRET,
    });
    config = new AppConfigService(configService);
    authService = new AuthService(
      mockPrisma,
      jwtService,
      config,
      mockAudit,
      mockVerifier,
      mockMail,
      settings,
      new OAuthStateService(config),
    );
  });

  describe('registro', () => {
    it('crea la cuenta sin sesión y guarda el código solo como hash', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      const result = await authService.register({
        email: 'Test@Agencia.com',
        password: 'StrongPassword2026!',
        fullName: 'Agencia Demo',
      });

      expect(result.requiresEmailVerification).toBe(true);
      expect(result.email).toBe('test@agencia.com');
      expect(mockPrisma.authSession.create).not.toHaveBeenCalled();
      const stored = tx.user.create.mock.calls[0][0].data;
      expect(sentCode()).toMatch(/^\d{6}$/);
      expect(stored.verificationToken).toBe(hashOf(sentCode()));
      expect(stored.verificationToken).not.toBe(sentCode());
      expect(stored.verificationExpires.getTime()).toBeGreaterThan(Date.now());
    });

    it('no permite pisar la contraseña de un cliente invitado pendiente', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...baseUser,
        emailVerified: false,
        clientProfile: { id: 'c-1' },
      });

      await expect(
        authService.register({ email: 'user@agencia.com', password: 'StrongPassword2026!', fullName: 'Atacante' }),
      ).rejects.toThrow(ConflictException);
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('respeta el ajuste que deshabilita los registros', async () => {
      settings.current.mockReturnValueOnce({ ...cloneDefaultSettings(), registrationEnabled: false });
      await expect(
        authService.register({ email: 'a@b.com', password: 'StrongPassword2026!', fullName: 'X' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('códigos OTP', () => {
    const pending = () => ({
      ...baseUser,
      emailVerified: false,
      verificationToken: hashOf('123456'),
      verificationExpires: new Date(Date.now() + 60000),
    });

    it('activa la cuenta con el código correcto', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(pending());
      mockPrisma.user.update.mockResolvedValueOnce({ ...pending(), emailVerified: true });

      const session = await authService.verifyRegistrationCode({ email: 'user@agencia.com', code: '123456' });

      expect(session.accessToken).toBeDefined();
      expect(mockPrisma.authSession.create).toHaveBeenCalledTimes(1);
    });

    it('rechaza un código vencido aunque sea correcto', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...pending(),
        verificationExpires: new Date(Date.now() - 1000),
      });
      await expect(
        authService.verifyRegistrationCode({ email: 'user@agencia.com', code: '123456' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.authSession.create).not.toHaveBeenCalled();
    });

    it('invalida el código al agotar los intentos', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ ...pending(), otpFailedAttempts: 4 });
      await expect(
        authService.verifyRegistrationCode({ email: 'user@agencia.com', code: '000000' }),
      ).rejects.toThrow('máximo de intentos');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ verificationToken: null }) }),
      );
    });

    it('el restablecimiento de contraseña exige coincidir con el correo indicado', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...baseUser,
        passwordResetToken: hashOf('654321'),
        passwordResetExpires: new Date(Date.now() + 60000),
      });
      await expect(
        authService.resetPassword({ email: 'user@agencia.com', token: '111111', newPassword: 'NuevaClave2026!' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'user@agencia.com' } });
    });

    it('no revela si un correo está registrado al pedir recuperación', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      const unknown = await authService.forgotPassword({ email: 'nadie@x.com' });
      mockPrisma.user.findUnique.mockResolvedValueOnce({ ...baseUser, passwordHash: 'hash' });
      const known = await authService.forgotPassword({ email: 'user@agencia.com' });
      expect(known).toEqual(unknown);
    });
  });

  describe('login', () => {
    it('no envía correos a una cuenta sin verificar si la contraseña es incorrecta', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...baseUser,
        emailVerified: false,
        passwordHash: await argon2.hash('ClaveCorrecta2026!'),
      });
      await expect(authService.login({ email: 'user@agencia.com', password: 'otra' })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockMail.send).not.toHaveBeenCalled();
    });

    it('emite tokens con la duración configurada', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...baseUser,
        passwordHash: await argon2.hash('ClaveCorrecta2026!'),
      });
      const session: any = await authService.login({ email: 'user@agencia.com', password: 'ClaveCorrecta2026!' });
      expect(session.expiresInSeconds).toBe(900);
    });
  });

  describe('acceso social', () => {
    const verifiedIdentity = {
      providerUserId: 'google-sub-999',
      email: 'user@agencia.com',
      fullName: 'Usuario',
      emailVerified: true,
    };

    it('crea la cuenta con el nombre del proveedor, sin pedir datos', async () => {
      mockVerifier.verify.mockResolvedValueOnce({ ...verifiedIdentity, fullName: 'Ana Gómez' });
      mockPrisma.socialAuthAccount.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      tx.user.create.mockResolvedValueOnce({ id: 'user-1' });
      tx.user.findUniqueOrThrow.mockResolvedValueOnce(baseUser);
      mockPrisma.socialAuthAccount.create.mockResolvedValueOnce({ id: 'link-1' });

      await authService.socialLogin({ provider: SocialProvider.GOOGLE, idToken: 'valid_google_id_token_123456789' });

      expect(tx.user.create.mock.calls[0][0].data.fullName).toBe('Ana Gómez');
      expect(tx.agency.create.mock.calls[0][0].data.name).toBe('Agencia de Ana');
      expect(tx.user.create.mock.calls[0][0].data.needsProfileSetup).toBe(true);
    });

    it('una cuenta que ya existía no vuelve a pedir datos', async () => {
      mockVerifier.verify.mockResolvedValueOnce(verifiedIdentity);
      mockPrisma.socialAuthAccount.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.findUnique.mockResolvedValueOnce(baseUser);
      mockPrisma.user.update.mockResolvedValueOnce(baseUser);
      mockPrisma.socialAuthAccount.create.mockResolvedValueOnce({ id: 'link-1' });

      const res = await authService.socialLogin({ provider: SocialProvider.GOOGLE, idToken: 'valid_google_id_token_123456789' });

      expect(res.user.needsProfileSetup).toBe(false);
    });

    it('completar los datos los guarda y no los vuelve a pedir', async () => {
      const res = await authService.completeProfile('user-1', { firstName: ' Ana ', lastName: 'Gómez', agencyName: ' Nova ' });

      expect(mockPrisma.agency.updateMany).toHaveBeenCalledWith({ where: { ownerUserId: 'user-1' }, data: { name: 'Nova' } });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { fullName: 'Ana Gómez', needsProfileSetup: false },
      });
      expect(res.needsProfileSetup).toBe(false);
    });

    it('no acepta datos solo con espacios', async () => {
      await expect(
        authService.completeProfile('user-1', { firstName: '   ', lastName: 'Gómez', agencyName: 'Nova' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('vincula por correo sin duplicar al usuario', async () => {
      mockVerifier.verify.mockResolvedValueOnce(verifiedIdentity);
      mockPrisma.socialAuthAccount.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.findUnique.mockResolvedValueOnce(baseUser);
      mockPrisma.user.update.mockResolvedValueOnce(baseUser);
      mockPrisma.socialAuthAccount.create.mockResolvedValueOnce({ id: 'link-1' });

      const res = await authService.socialLogin({
        provider: SocialProvider.GOOGLE,
        idToken: 'valid_google_id_token_123456789',
      });

      expect(tx.user.create).not.toHaveBeenCalled();
      expect(res.user.id).toBe('user-1');
    });

    it('no entrega una cuenta existente a un proveedor que no verificó el correo', async () => {
      mockVerifier.verify.mockResolvedValueOnce({ ...verifiedIdentity, emailVerified: false });
      mockPrisma.socialAuthAccount.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.findUnique.mockResolvedValueOnce(baseUser);

      await expect(
        authService.socialLogin({ provider: SocialProvider.GITHUB, idToken: 'github_access_token_123456' }),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.socialAuthAccount.create).not.toHaveBeenCalled();
    });

    it('descarta la contraseña de una cuenta que nadie había verificado al vincularla', async () => {
      mockVerifier.verify.mockResolvedValueOnce(verifiedIdentity);
      mockPrisma.socialAuthAccount.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...baseUser,
        emailVerified: false,
        passwordHash: 'puesta-por-un-tercero',
      });
      mockPrisma.user.update.mockResolvedValueOnce(baseUser);
      mockPrisma.socialAuthAccount.create.mockResolvedValueOnce({ id: 'link-1' });

      await authService.socialLogin({ provider: SocialProvider.GOOGLE, idToken: 'valid_google_id_token_123456789' });

      expect(mockPrisma.user.update.mock.calls[0][0].data.passwordHash).toBeNull();
    });

    it('rechaza un callback sin la cookie del navegador que inició el flujo', async () => {
      const oauthState = new OAuthStateService(config);
      const state = oauthState.sign('social-login', { nonce: 'nonce-real' });
      await expect(
        authService.handleOAuthCallback('github', 'code', state, 'otro-nonce', '1.1.1.1', undefined),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  it('detecta la reutilización de un refresh token y revoca toda la familia', async () => {
    const token = await jwtService.signAsync(
      { sub: 'user-1', sessionId: 'session-rotated', tokenFamily: 'family-abc' },
      { secret: config.jwtRefreshSecret },
    );
    mockPrisma.authSession.findUnique.mockResolvedValueOnce({
      id: 'session-rotated',
      userId: 'user-1',
      tokenFamily: 'family-abc',
      isRevoked: true,
      rotatedAt: new Date(),
    });

    await expect(authService.refreshTokens({ refreshToken: token })).rejects.toThrow(UnauthorizedException);
    expect(mockPrisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { tokenFamily: 'family-abc' },
      data: { isRevoked: true },
    });
  });

  it('aplica los roles en RolesGuard', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([RoleCode.ADMIN_GENERAL]);
    const guard = new RolesGuard(reflector);
    const contextFor = (role: RoleCode) =>
      ({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => ({ user: { sub: 'u', email: 'a@b.com', role } }) }),
      }) as unknown as ExecutionContext;

    expect(() => guard.canActivate(contextFor(RoleCode.AGENCIA))).toThrow(ForbiddenException);
    expect(guard.canActivate(contextFor(RoleCode.ADMIN_GENERAL))).toBe(true);
  });
});

import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RoleCode, SocialProvider } from '@prisma/client';
import { AuthService } from './auth.service';
import { RolesGuard } from '../../common/guards/auth-rbac.guards';
import { CryptoService } from '../../common/crypto/crypto.service';

describe('AuthService, CryptoService & RolesGuard (Phase 2 Security & RBAC)', () => {
  const mockPrisma: any = {
    role: {
      upsert: jest.fn().mockResolvedValue({ id: 'role-agency-uuid', code: RoleCode.AGENCIA }),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    authSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    socialAuthAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const mockAudit: any = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  let authService: AuthService;
  let jwtService: JwtService;
  let cryptoService: CryptoService;

  beforeEach(() => {
    jest.clearAllMocks();
    jwtService = new JwtService({});
    const configService = new ConfigService({
      JWT_ACCESS_SECRET: 'test_access_secret_0123456789abcdef0123456789abcdef',
      JWT_REFRESH_SECRET: 'test_refresh_secret_0123456789abcdef0123456789abcdef',
      OAUTH_ENCRYPTION_KEY:
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    });
    authService = new AuthService(mockPrisma, jwtService, configService, mockAudit);
    cryptoService = new CryptoService(configService);
  });

  it('should register a user with Argon2id hashed password and issue rotating tokens', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.create.mockImplementationOnce(async ({ data }: any) => ({
      id: 'user-1',
      email: data.email,
      passwordHash: data.passwordHash,
      fullName: data.fullName,
      timezone: data.timezone,
      emailVerified: false,
      role: { code: RoleCode.AGENCIA },
      ownedAgency: { id: 'agency-1' },
      clientProfile: null,
    }));

    const result = await authService.register({
      email: 'Test@Agencia.com',
      password: 'StrongPassword2026!',
      fullName: 'Agencia Demo',
    });

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.email).toBe('test@agencia.com');
    expect(result.user.role).toBe(RoleCode.AGENCIA);
    expect(mockPrisma.authSession.create).toHaveBeenCalledTimes(1);
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUTH_REGISTER' }),
    );
  });

  it('should link social account by email without duplicating existing user', async () => {
    mockPrisma.socialAuthAccount.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'existing-user-id',
      email: 'linked@agencia.com',
      fullName: 'Usuario Existente',
      timezone: 'America/Argentina/Buenos_Aires',
      emailVerified: true,
      role: { code: RoleCode.AGENCIA },
      ownedAgency: { id: 'agency-1' },
      clientProfile: null,
    });
    mockPrisma.socialAuthAccount.create.mockResolvedValueOnce({
      id: 'social-link-1',
      userId: 'existing-user-id',
    });

    const res = await authService.socialLogin({
      provider: SocialProvider.GOOGLE,
      idToken: 'valid_google_id_token_123456789',
      email: 'linked@agencia.com',
      providerUserId: 'google-sub-999',
      fullName: 'Usuario Existente',
    });

    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.socialAuthAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'existing-user-id',
          provider: SocialProvider.GOOGLE,
        }),
      }),
    );
    expect(res.user.id).toBe('existing-user-id');
  });

  it('should detect refresh token reuse and revoke entire token family', async () => {
    const fakeToken = await jwtService.signAsync(
      { sub: 'user-1', sessionId: 'session-rotated', tokenFamily: 'family-abc' },
      { secret: 'test_refresh_secret_0123456789abcdef0123456789abcdef' },
    );

    mockPrisma.authSession.findUnique.mockResolvedValueOnce({
      id: 'session-rotated',
      userId: 'user-1',
      tokenFamily: 'family-abc',
      isRevoked: true,
      rotatedAt: new Date(),
    });

    await expect(authService.refreshTokens({ refreshToken: fakeToken })).rejects.toThrow(
      UnauthorizedException,
    );

    expect(mockPrisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { tokenFamily: 'family-abc' },
      data: { isRevoked: true },
    });
  });

  it('should encrypt and decrypt third-party OAuth tokens with AES-256-GCM', () => {
    const rawToken = 'ya29.a0AfH6SMBx_youtube_oauth_secret_token';
    const cipherText = cryptoService.encrypt(rawToken);
    expect(cipherText).not.toContain(rawToken);
    const plainText = cryptoService.decrypt(cipherText);
    expect(plainText).toBe(rawToken);
  });

  it('should enforce RBAC roles in RolesGuard', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([RoleCode.ADMIN_GENERAL]);
    const guard = new RolesGuard(reflector);

    const agencyContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { sub: 'u1', email: 'a@b.com', role: RoleCode.AGENCIA },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(agencyContext)).toThrow(ForbiddenException);

    const adminContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { sub: 'u0', email: 'admin@b.com', role: RoleCode.ADMIN_GENERAL },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(adminContext)).toBe(true);
  });
});

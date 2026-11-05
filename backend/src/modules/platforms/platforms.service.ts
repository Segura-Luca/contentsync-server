import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PlatformConnectionStatus, SocialPlatform } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OAuthStateService } from '../../common/utils/oauth-state.service';
import { AppConfigService } from '../../config/app-config.service';
import { ClientsService } from '../clients/clients.service';
import { InstagramReelsPublisher } from './publishers/instagram-reels.publisher';
import { NonRetryablePublishError, PlatformPublisher } from './publishers/platform-publisher.interface';
import { TikTokVideoPublisher } from './publishers/tiktok-video.publisher';
import { YouTubeShortsPublisher } from './publishers/youtube-shorts.publisher';

export interface ConnectPlatformOAuthInput {
  clientId: string;
  platform: SocialPlatform;
  externalAccountId: string;
  accountHandle: string;
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds?: number;
}

interface ExchangedAccount {
  externalAccountId: string;
  accountHandle: string;
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds: number;
}

@Injectable()
export class PlatformsService {
  private readonly logger = new Logger(PlatformsService.name);
  private readonly publishersMap = new Map<SocialPlatform, PlatformPublisher>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
    private readonly cryptoService: CryptoService,
    private readonly auditService: AuditService,
    private readonly config: AppConfigService,
    private readonly oauthState: OAuthStateService,
    instagramPublisher: InstagramReelsPublisher,
    tiktokPublisher: TikTokVideoPublisher,
    youtubePublisher: YouTubeShortsPublisher,
  ) {
    this.registerPublisher(instagramPublisher);
    this.registerPublisher(tiktokPublisher);
    this.registerPublisher(youtubePublisher);
  }

  getPlatformOAuthConfig() {
    return {
      youtubeOAuthConfigured: Boolean(this.config.youtubeClientId && this.config.get('YOUTUBE_CLIENT_SECRET')),
      instagramOAuthConfigured: Boolean(this.config.instagramAppId && this.config.instagramAppSecret),
      tiktokOAuthConfigured: Boolean(this.config.get('TIKTOK_CLIENT_KEY') && this.config.get('TIKTOK_CLIENT_SECRET')),
    };
  }

  private parsePlatform(value: string): SocialPlatform {
    const platform = value.toUpperCase() as SocialPlatform;
    if (!Object.values(SocialPlatform).includes(platform)) {
      throw new BadRequestException(`Plataforma no soportada: ${value}`);
    }
    return platform;
  }

  private redirectUri(platform: SocialPlatform, requestBase?: string): string {
    return (
      this.config.get(`${platform}_REDIRECT_URI`) ||
      this.config.apiUrl(`platforms/oauth/${platform.toLowerCase()}/callback`, requestBase)
    );
  }

  async getOAuthAuthorizeUrl(params: {
    platform: string;
    clientId: string;
    requestBase?: string;
    user: AuthenticatedUser;
  }): Promise<string> {
    await this.clientsService.assertClientAccess(params.clientId, params.user, true);
    const platform = this.parsePlatform(params.platform);
    const redirectUri = this.redirectUri(platform, params.requestBase);
    // La firma impide alterar el destino de la conexión; el callback vuelve a validar permisos contra MySQL.
    const state = this.oauthState.sign('platform-connect', {
      clientId: params.clientId,
      userId: params.user.sub,
      redirectUri,
    });

    if (platform === SocialPlatform.YOUTUBE) {
      const clientId = this.config.youtubeClientId;
      if (!clientId) throw new BadRequestException('YouTube no está configurado en el servidor.');
      const query = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
        access_type: 'offline',
        prompt: 'consent',
        state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
    }

    if (platform === SocialPlatform.INSTAGRAM) {
      const appId = this.config.instagramAppId;
      if (!appId) throw new BadRequestException('Instagram no está configurado en el servidor.');
      const query = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: this.config.instagramScopes,
        state,
      });
      return `https://www.facebook.com/${this.config.metaGraphVersion}/dialog/oauth?${query.toString()}`;
    }

    const clientKey = this.config.get('TIKTOK_CLIENT_KEY');
    if (!clientKey) {
      throw new BadRequestException(
        'Para usar el botón directo de TikTok se requiere un TIKTOK_CLIENT_KEY aprobado en developers.tiktok.com, o bien pegar el Access Token manualmente en el diálogo de conexión.',
      );
    }
    const query = new URLSearchParams({
      client_key: clientKey,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'user.info.basic,video.publish,video.upload',
      state,
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${query.toString()}`;
  }

  async handleOAuthCallback(params: { platform: string; code: string; state?: string }) {
    const platform = this.parsePlatform(params.platform);
    const state = this.oauthState.verify<{ clientId: string; userId: string; redirectUri: string }>(
      'platform-connect',
      params.state,
    );

    const user = await this.prisma.user.findUnique({
      where: { id: state.userId },
      include: { role: true, ownedAgency: true, clientProfile: true },
    });
    if (!user || !user.isActive || user.deletedAt) {
      throw new BadRequestException('La cuenta que inició la conexión ya no está activa.');
    }
    const actingUser: AuthenticatedUser = {
      sub: user.id,
      email: user.email,
      role: user.role.code,
      agencyId: user.ownedAgency?.id ?? user.clientProfile?.agencyId ?? null,
      clientId: user.clientProfile?.id ?? null,
    };
    await this.clientsService.assertClientAccess(state.clientId, actingUser, true);

    const exchange: Record<SocialPlatform, () => Promise<ExchangedAccount>> = {
      [SocialPlatform.YOUTUBE]: () => this.exchangeYouTubeCode(params.code, state.redirectUri),
      [SocialPlatform.INSTAGRAM]: () => this.exchangeInstagramCode(params.code, state.redirectUri),
      [SocialPlatform.TIKTOK]: () => this.exchangeTikTokCode(params.code, state.redirectUri),
    };
    const account = await exchange[platform]();
    return this.connectPlatformAccount({ clientId: state.clientId, platform, ...account }, actingUser);
  }

  /** El detalle del proveedor queda en el log: la URL de vuelta solo lleva un mensaje comprensible. */
  private async failExchange(platformName: string, res: Response): Promise<never> {
    const detail = await res.text().catch(() => '');
    this.logger.warn(`Canje de código rechazado por ${platformName}: HTTP ${res.status} ${detail.slice(0, 500)}`);
    throw new BadRequestException(`${platformName} rechazó la autorización. Volvé a intentar la conexión.`);
  }

  private async exchangeYouTubeCode(code: string, redirectUri: string): Promise<ExchangedAccount> {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.config.youtubeClientId || '',
        client_secret: this.config.get('YOUTUBE_CLIENT_SECRET') || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!tokenRes.ok) return this.failExchange('YouTube', tokenRes);
    const token = (await tokenRes.json()) as { access_token: string; refresh_token?: string; expires_in?: number };

    const channelRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!channelRes.ok) return this.failExchange('YouTube', channelRes);
    const channels = (await channelRes.json()) as {
      items?: Array<{ id: string; snippet?: { title?: string; customUrl?: string } }>;
    };
    const channel = channels.items?.[0];
    if (!channel) {
      throw new BadRequestException('Esa cuenta de Google todavía no tiene un canal de YouTube.');
    }
    return {
      externalAccountId: channel.id,
      accountHandle: channel.snippet?.customUrl || `@${channel.snippet?.title || channel.id}`,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresInSeconds: token.expires_in || 3600,
    };
  }

  private async exchangeInstagramCode(code: string, redirectUri: string): Promise<ExchangedAccount> {
    const graph = `https://graph.facebook.com/${this.config.metaGraphVersion}`;
    const appId = this.config.instagramAppId || '';
    const appSecret = this.config.instagramAppSecret || '';

    const shortRes = await fetch(
      `${graph}/oauth/access_token?${new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        client_secret: appSecret,
        code,
      }).toString()}`,
    );
    if (!shortRes.ok) return this.failExchange('Instagram', shortRes);
    const shortToken = (await shortRes.json()) as { access_token: string };

    // El token inicial dura horas: se canjea por uno de larga duración, renovable antes de vencer.
    const longRes = await fetch(
      `${graph}/oauth/access_token?${new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortToken.access_token,
      }).toString()}`,
    );
    if (!longRes.ok) return this.failExchange('Instagram', longRes);
    const longToken = (await longRes.json()) as { access_token: string; expires_in?: number };

    const pagesRes = await fetch(
      `${graph}/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(longToken.access_token)}`,
    );
    if (!pagesRes.ok) return this.failExchange('Instagram', pagesRes);
    const pages = (await pagesRes.json()) as {
      data?: Array<{ name?: string; instagram_business_account?: { id: string; username?: string } }>;
    };
    const page = pages.data?.find((candidate) => candidate.instagram_business_account?.id);
    const igAccount = page?.instagram_business_account;
    if (!igAccount) {
      throw new BadRequestException(
        'No encontramos una cuenta profesional de Instagram vinculada a una página de Facebook de este usuario. Sin ella, Meta no permite publicar Reels por API.',
      );
    }
    return {
      externalAccountId: igAccount.id,
      accountHandle: `@${igAccount.username || page?.name || igAccount.id}`,
      accessToken: longToken.access_token,
      refreshToken: longToken.access_token,
      expiresInSeconds: longToken.expires_in || 60 * 60 * 24 * 60,
    };
  }

  private async exchangeTikTokCode(code: string, redirectUri: string): Promise<ExchangedAccount> {
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: this.config.get('TIKTOK_CLIENT_KEY') || '',
        client_secret: this.config.get('TIKTOK_CLIENT_SECRET') || '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(),
    });
    if (!tokenRes.ok) return this.failExchange('TikTok', tokenRes);
    const token = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      open_id?: string;
      expires_in?: number;
      error_description?: string;
    };
    if (!token.access_token || !token.open_id) {
      this.logger.warn(`Canje de código rechazado por TikTok: ${token.error_description || 'sin detalle'}`);
      throw new BadRequestException('TikTok rechazó la autorización. Volvé a intentar la conexión.');
    }

    let handle = `@${token.open_id.slice(0, 12)}`;
    const infoRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }).catch(() => null);
    if (infoRes?.ok) {
      const info = (await infoRes.json()) as { data?: { user?: { display_name?: string } } };
      if (info.data?.user?.display_name) handle = `@${info.data.user.display_name}`;
    }
    return {
      externalAccountId: token.open_id,
      accountHandle: handle,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresInSeconds: token.expires_in || 86400,
    };
  }

  registerPublisher(publisher: PlatformPublisher): void {
    this.publishersMap.set(publisher.platform, publisher);
  }

  getPublisher(platform: SocialPlatform): PlatformPublisher {
    const publisher = this.publishersMap.get(platform);
    if (!publisher) {
      throw new BadRequestException(`No existe un adaptador PlatformPublisher registrado para ${platform}.`);
    }
    return publisher;
  }

  async connectPlatformAccount(input: ConnectPlatformOAuthInput, user: AuthenticatedUser) {
    await this.clientsService.assertClientAccess(input.clientId, user, true);

    const encryptedAccessToken = this.cryptoService.encrypt(input.accessToken);
    const encryptedRefreshToken = input.refreshToken ? this.cryptoService.encrypt(input.refreshToken) : undefined;
    const tokenExpiresAt = new Date(Date.now() + (input.expiresInSeconds ?? 60 * 60 * 24 * 30) * 1000);

    const connection = await this.prisma.platformConnection.upsert({
      where: { clientId_platform: { clientId: input.clientId, platform: input.platform } },
      update: {
        externalAccountId: input.externalAccountId,
        accountHandle: input.accountHandle,
        encryptedAccessToken,
        // Si el proveedor no reenvía refresh token al reconectar, se conserva el que ya teníamos.
        encryptedRefreshToken,
        tokenExpiresAt,
        status: PlatformConnectionStatus.ACTIVE,
      },
      create: {
        clientId: input.clientId,
        platform: input.platform,
        externalAccountId: input.externalAccountId,
        accountHandle: input.accountHandle,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt,
        status: PlatformConnectionStatus.ACTIVE,
      },
    });

    await this.auditService.log({
      userId: user.sub,
      action: `PLATFORM_OAUTH_CONNECTED_${input.platform}`,
      entityType: 'PlatformConnection',
      entityId: connection.id,
      metadata: { clientId: input.clientId, accountHandle: input.accountHandle },
    });

    return {
      id: connection.id,
      clientId: connection.clientId,
      platform: connection.platform,
      accountHandle: connection.accountHandle,
      status: connection.status,
      tokenExpiresAt: connection.tokenExpiresAt,
    };
  }

  async revokePlatformConnection(clientId: string, platform: SocialPlatform, user: AuthenticatedUser) {
    await this.clientsService.assertClientAccess(clientId, user);

    const connection = await this.prisma.platformConnection.findUnique({
      where: { clientId_platform: { clientId, platform } },
    });
    if (!connection) {
      throw new NotFoundException('Conexión de plataforma no encontrada.');
    }

    await this.prisma.platformConnection.update({
      where: { id: connection.id },
      data: { status: PlatformConnectionStatus.REVOKED },
    });

    await this.auditService.log({
      userId: user.sub,
      action: `PLATFORM_OAUTH_REVOKED_${platform}`,
      entityType: 'PlatformConnection',
      entityId: connection.id,
    });

    return { message: `Conexión con ${platform} revocada correctamente.` };
  }

  /** Devuelve el access token descifrado y lo renueva si está por vencer. */
  async getValidDecryptedCredentials(
    clientId: string,
    platform: SocialPlatform,
  ): Promise<{ accessToken: string; externalAccountId: string }> {
    const connection = await this.prisma.platformConnection.findUnique({
      where: { clientId_platform: { clientId, platform } },
    });

    if (!connection || connection.status !== PlatformConnectionStatus.ACTIVE) {
      throw new NonRetryablePublishError(`El cliente no tiene una cuenta activa conectada para ${platform}. Volvé a conectarla.`);
    }

    const accessToken = this.cryptoService.decrypt(connection.encryptedAccessToken);
    const credentials = { accessToken, externalAccountId: connection.externalAccountId };
    if (!connection.tokenExpiresAt) return credentials;

    const publisher = this.getPublisher(platform);
    const now = Date.now();
    const expiresAt = connection.tokenExpiresAt.getTime();
    if (expiresAt - publisher.refreshMarginSeconds * 1000 > now) return credentials;

    const stillValid = expiresAt > now;
    const expire = async (reason: string): Promise<never> => {
      await this.prisma.platformConnection.update({
        where: { id: connection.id },
        data: { status: PlatformConnectionStatus.EXPIRED },
      });
      throw new NonRetryablePublishError(`El acceso a ${platform} expiró y requiere reconexión. ${reason}`.trim());
    };

    if (!connection.encryptedRefreshToken) {
      return stillValid ? credentials : expire('');
    }

    try {
      const refreshed = await publisher.refreshAccessToken(
        this.cryptoService.decrypt(connection.encryptedRefreshToken),
      );
      await this.prisma.platformConnection.update({
        where: { id: connection.id },
        data: {
          encryptedAccessToken: this.cryptoService.encrypt(refreshed.accessToken),
          encryptedRefreshToken: refreshed.refreshToken
            ? this.cryptoService.encrypt(refreshed.refreshToken)
            : undefined,
          tokenExpiresAt: new Date(now + refreshed.expiresInSeconds * 1000),
        },
      });
      return { accessToken: refreshed.accessToken, externalAccountId: connection.externalAccountId };
    } catch (err) {
      const message = (err as Error).message;
      this.logger.warn(`No se pudo renovar el token de ${platform}: ${message}`);
      return stillValid ? credentials : expire(message);
    }
  }
}

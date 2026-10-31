import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformConnectionStatus, SocialPlatform } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ClientsService } from '../clients/clients.service';
import { InstagramReelsPublisher } from './publishers/instagram-reels.publisher';
import { PlatformPublisher } from './publishers/platform-publisher.interface';
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

@Injectable()
export class PlatformsService {
  private readonly publishersMap = new Map<SocialPlatform, PlatformPublisher>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
    private readonly cryptoService: CryptoService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    instagramPublisher: InstagramReelsPublisher,
    tiktokPublisher: TikTokVideoPublisher,
    youtubePublisher: YouTubeShortsPublisher,
  ) {
    this.registerPublisher(instagramPublisher);
    this.registerPublisher(tiktokPublisher);
    this.registerPublisher(youtubePublisher);
  }

  getPlatformOAuthConfig() {
    const ytClientId =
      this.configService.get<string>('YOUTUBE_CLIENT_ID') ||
      this.configService.get<string>('GOOGLE_AUTH_CLIENT_ID') ||
      '';
    const igAppId =
      this.configService.get<string>('INSTAGRAM_APP_ID') ||
      this.configService.get<string>('FACEBOOK_AUTH_APP_ID') ||
      '';
    const ttClientKey = this.configService.get<string>('TIKTOK_CLIENT_KEY') || '';
    return {
      youtubeOAuthConfigured: Boolean(ytClientId && !ytClientId.startsWith('your-')),
      instagramOAuthConfigured: Boolean(igAppId && !igAppId.startsWith('your-')),
      tiktokOAuthConfigured: Boolean(ttClientKey && !ttClientKey.startsWith('your-')),
    };
  }

  async getOAuthAuthorizeUrl(params: {
    platform: string;
    clientId: string;
    originUrl: string;
    user: AuthenticatedUser;
  }): Promise<string> {
    await this.clientsService.assertClientAccess(params.clientId, params.user);
    const plat = params.platform.toUpperCase();
    const statePayload = Buffer.from(
      JSON.stringify({
        clientId: params.clientId,
        userId: params.user.sub,
        role: params.user.role,
        agencyId: params.user.agencyId,
        originUrl: params.originUrl,
      }),
      'utf8',
    ).toString('base64url');

    const redirectUri = `${params.originUrl.replace(/\/+$/, '')}/api/v1/platforms/oauth/${params.platform.toLowerCase()}/callback`;

    if (plat === 'YOUTUBE') {
      const clientId =
        this.configService.get<string>('YOUTUBE_CLIENT_ID') ||
        this.configService.get<string>('GOOGLE_AUTH_CLIENT_ID');
      if (!clientId) {
        throw new BadRequestException('Falta YOUTUBE_CLIENT_ID en el servidor.');
      }
      const q = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope:
          'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
        access_type: 'offline',
        prompt: 'consent',
        state: statePayload,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
    }

    if (plat === 'INSTAGRAM') {
      const appId =
        this.configService.get<string>('INSTAGRAM_APP_ID') ||
        this.configService.get<string>('FACEBOOK_AUTH_APP_ID');
      if (!appId) {
        throw new BadRequestException('Falta INSTAGRAM_APP_ID en el servidor.');
      }
      const q = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'public_profile,email',
        state: statePayload,
      });
      return `https://www.facebook.com/v19.0/dialog/oauth?${q.toString()}`;
    }

    if (plat === 'TIKTOK') {
      const clientKey = this.configService.get<string>('TIKTOK_CLIENT_KEY');
      if (!clientKey || clientKey.startsWith('your-')) {
        throw new BadRequestException(
          'Para usar el botón directo de TikTok OAuth se requiere un TIKTOK_CLIENT_KEY aprobado en developers.tiktok.com, o bien pegar el Access Token de TikTok manualmente en el diálogo de conexión.',
        );
      }
      const q = new URLSearchParams({
        client_key: clientKey,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'user.info.basic,video.publish,video.upload',
        state: statePayload,
      });
      return `https://www.tiktok.com/v2/auth/authorize/?${q.toString()}`;
    }

    throw new BadRequestException(`Plataforma no soportada: ${params.platform}`);
  }

  async handleOAuthCallback(params: {
    platform: string;
    code: string;
    state?: string;
    originUrl: string;
  }) {
    let parsedState: {
      clientId?: string;
      userId?: string;
      role?: any;
      agencyId?: string | null;
      originUrl?: string;
    } = {};
    if (params.state) {
      try {
        parsedState = JSON.parse(
          Buffer.from(params.state, 'base64url').toString('utf8'),
        );
      } catch {
        parsedState = {};
      }
    }

    if (!parsedState.clientId || !parsedState.userId) {
      throw new BadRequestException('Estado OAuth de plataforma inválido o expirado.');
    }

    const baseOrigin = (parsedState.originUrl || params.originUrl).replace(/\/+$/, '');
    const redirectUri = `${baseOrigin}/api/v1/platforms/oauth/${params.platform.toLowerCase()}/callback`;
    const plat = params.platform.toUpperCase();

    const actingUser: AuthenticatedUser = {
      sub: parsedState.userId,
      email: '',
      role: parsedState.role || 'AGENCIA',
      agencyId: parsedState.agencyId || null,
    };

    if (plat === 'YOUTUBE') {
      const clientId =
        this.configService.get<string>('YOUTUBE_CLIENT_ID') ||
        this.configService.get<string>('GOOGLE_AUTH_CLIENT_ID') ||
        '';
      const clientSecret =
        this.configService.get<string>('YOUTUBE_CLIENT_SECRET') || '';

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: params.code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });

      if (!tokenRes.ok) {
        const errTxt = await tokenRes.text();
        throw new BadRequestException(
          `No se pudo obtener el token de YouTube: ${errTxt}`,
        );
      }

      const tokenJson = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };

      // Consultar el canal real de YouTube del usuario autenticado
      let channelId = 'yt_channel_authenticated';
      let channelTitle = '@YouTubeCanalConectado';
      try {
        const chRes = await fetch(
          'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
          {
            headers: { Authorization: `Bearer ${tokenJson.access_token}` },
          },
        );
        if (chRes.ok) {
          const chJson = (await chRes.json()) as {
            items?: Array<{
              id: string;
              snippet?: { title?: string; customUrl?: string };
            }>;
          };
          const first = chJson.items?.[0];
          if (first) {
            channelId = first.id;
            channelTitle =
              first.snippet?.customUrl ||
              (first.snippet?.title ? `@${first.snippet.title}` : `@${first.id}`);
          }
        }
      } catch {
        // Fallback si la cuenta Google aún no creó su canal de YouTube
      }

      return this.connectPlatformAccount(
        {
          clientId: parsedState.clientId,
          platform: SocialPlatform.YOUTUBE,
          externalAccountId: channelId,
          accountHandle: channelTitle,
          accessToken: tokenJson.access_token,
          refreshToken: tokenJson.refresh_token,
          expiresInSeconds: tokenJson.expires_in || 3600,
        },
        actingUser,
      );
    }

    if (plat === 'INSTAGRAM') {
      const appId =
        this.configService.get<string>('INSTAGRAM_APP_ID') ||
        this.configService.get<string>('FACEBOOK_AUTH_APP_ID') ||
        '';
      const appSecret =
        this.configService.get<string>('INSTAGRAM_APP_SECRET') ||
        this.configService.get<string>('FACEBOOK_AUTH_APP_SECRET') ||
        '';

      const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
      tokenUrl.searchParams.set('client_id', appId);
      tokenUrl.searchParams.set('redirect_uri', redirectUri);
      tokenUrl.searchParams.set('client_secret', appSecret);
      tokenUrl.searchParams.set('code', params.code);

      const tokenRes = await fetch(tokenUrl.toString());
      if (!tokenRes.ok) {
        const errTxt = await tokenRes.text();
        throw new BadRequestException(
          `No se pudo obtener el token de Meta/Instagram: ${errTxt}`,
        );
      }

      const tokenJson = (await tokenRes.json()) as {
        access_token: string;
        expires_in?: number;
      };

      // Intentar obtener la cuenta de Instagram Business vinculada a las páginas de Meta
      let igUserId = '';
      let igHandle = '';
      try {
        const pagesRes = await fetch(
          `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(tokenJson.access_token)}`,
        );
        if (pagesRes.ok) {
          const pagesJson = (await pagesRes.json()) as {
            data?: Array<{
              id: string;
              name?: string;
              instagram_business_account?: { id: string; username?: string };
            }>;
          };
          const pageWithIg = pagesJson.data?.find(
            (p) => p.instagram_business_account?.id,
          );
          if (pageWithIg?.instagram_business_account) {
            igUserId = pageWithIg.instagram_business_account.id;
            igHandle = pageWithIg.instagram_business_account.username
              ? `@${pageWithIg.instagram_business_account.username}`
              : `@${pageWithIg.name || igUserId}`;
          }
        }
        if (!igUserId) {
          const meRes = await fetch(
            `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${encodeURIComponent(tokenJson.access_token)}`,
          );
          if (meRes.ok) {
            const meJson = (await meRes.json()) as { id: string; name?: string };
            igUserId = meJson.id;
            igHandle = meJson.name
              ? `@${meJson.name.replace(/\s+/g, '').toLowerCase()}`
              : `@meta_${meJson.id}`;
          }
        }
      } catch {
        // Fallback
      }

      return this.connectPlatformAccount(
        {
          clientId: parsedState.clientId,
          platform: SocialPlatform.INSTAGRAM,
          externalAccountId: igUserId || `ig_${Date.now()}`,
          accountHandle: igHandle || '@instagram_conectado',
          accessToken: tokenJson.access_token,
          expiresInSeconds: tokenJson.expires_in || 5184000,
        },
        actingUser,
      );
    }

    if (plat === 'TIKTOK') {
      const clientKey = this.configService.get<string>('TIKTOK_CLIENT_KEY') || '';
      const clientSecret =
        this.configService.get<string>('TIKTOK_CLIENT_SECRET') || '';

      const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          code: params.code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }).toString(),
      });

      if (!tokenRes.ok) {
        const errTxt = await tokenRes.text();
        throw new BadRequestException(
          `No se pudo obtener el token de TikTok: ${errTxt}`,
        );
      }

      const tokenJson = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        open_id?: string;
        expires_in?: number;
      };

      return this.connectPlatformAccount(
        {
          clientId: parsedState.clientId,
          platform: SocialPlatform.TIKTOK,
          externalAccountId: tokenJson.open_id || `tt_${Date.now()}`,
          accountHandle: `@tiktok_${(tokenJson.open_id || '').slice(0, 8)}`,
          accessToken: tokenJson.access_token,
          refreshToken: tokenJson.refresh_token,
          expiresInSeconds: tokenJson.expires_in || 86400,
        },
        actingUser,
      );
    }

    throw new BadRequestException(`Plataforma no soportada: ${params.platform}`);
  }

  registerPublisher(publisher: PlatformPublisher): void {
    this.publishersMap.set(publisher.platform, publisher);
  }

  getPublisher(platform: SocialPlatform): PlatformPublisher {
    const publisher = this.publishersMap.get(platform);
    if (!publisher) {
      throw new BadRequestException(
        `No existe un adaptador PlatformPublisher registrado para ${platform}.`,
      );
    }
    return publisher;
  }

  async connectPlatformAccount(
    input: ConnectPlatformOAuthInput,
    user: AuthenticatedUser,
  ) {
    await this.clientsService.assertClientAccess(input.clientId, user);

    const encryptedAccessToken = this.cryptoService.encrypt(input.accessToken);
    const encryptedRefreshToken = input.refreshToken
      ? this.cryptoService.encrypt(input.refreshToken)
      : null;

    const expiresAt = input.expiresInSeconds
      ? new Date(Date.now() + input.expiresInSeconds * 1000)
      : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    const connection = await this.prisma.platformConnection.upsert({
      where: {
        clientId_platform: {
          clientId: input.clientId,
          platform: input.platform,
        },
      },
      update: {
        externalAccountId: input.externalAccountId,
        accountHandle: input.accountHandle,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt: expiresAt,
        status: PlatformConnectionStatus.ACTIVE,
      },
      create: {
        clientId: input.clientId,
        platform: input.platform,
        externalAccountId: input.externalAccountId,
        accountHandle: input.accountHandle,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt: expiresAt,
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

  async revokePlatformConnection(
    clientId: string,
    platform: SocialPlatform,
    user: AuthenticatedUser,
  ) {
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

  /**
   * Obtiene el access token descifrado de un cliente para la plataforma dada y
   * lo renueva automáticamente si está vencido.
   */
  async getValidDecryptedCredentials(
    clientId: string,
    platform: SocialPlatform,
  ): Promise<{ accessToken: string; externalAccountId: string }> {
    const connection = await this.prisma.platformConnection.findUnique({
      where: { clientId_platform: { clientId, platform } },
    });

    if (!connection || connection.status === PlatformConnectionStatus.REVOKED) {
      throw new BadRequestException(
        `El cliente no tiene una cuenta activa conectada para ${platform}.`,
      );
    }

    let accessToken = this.cryptoService.decrypt(connection.encryptedAccessToken);

    if (connection.tokenExpiresAt && connection.tokenExpiresAt <= new Date()) {
      if (!connection.encryptedRefreshToken) {
        await this.prisma.platformConnection.update({
          where: { id: connection.id },
          data: { status: PlatformConnectionStatus.EXPIRED },
        });
        throw new BadRequestException(
          `El token OAuth de ${platform} expiró y requiere reconexión.`,
        );
      }

      const decryptedRefresh = this.cryptoService.decrypt(
        connection.encryptedRefreshToken,
      );
      const publisher = this.getPublisher(platform);
      const refreshed = await publisher.refreshAccessToken(decryptedRefresh);
      accessToken = refreshed.accessToken;

      await this.prisma.platformConnection.update({
        where: { id: connection.id },
        data: {
          encryptedAccessToken: this.cryptoService.encrypt(refreshed.accessToken),
          encryptedRefreshToken: refreshed.refreshToken
            ? this.cryptoService.encrypt(refreshed.refreshToken)
            : connection.encryptedRefreshToken,
          tokenExpiresAt: new Date(Date.now() + refreshed.expiresInSeconds * 1000),
          status: PlatformConnectionStatus.ACTIVE,
        },
      });
    }

    return {
      accessToken,
      externalAccountId: connection.externalAccountId,
    };
  }
}

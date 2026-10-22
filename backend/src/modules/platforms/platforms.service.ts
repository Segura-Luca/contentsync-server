import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    instagramPublisher: InstagramReelsPublisher,
    tiktokPublisher: TikTokVideoPublisher,
    youtubePublisher: YouTubeShortsPublisher,
  ) {
    this.registerPublisher(instagramPublisher);
    this.registerPublisher(tiktokPublisher);
    this.registerPublisher(youtubePublisher);
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

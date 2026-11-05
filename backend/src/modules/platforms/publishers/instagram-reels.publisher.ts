import { Injectable, Logger } from '@nestjs/common';
import { SocialPlatform } from '@prisma/client';
import * as crypto from 'crypto';
import { AppConfigService } from '../../../config/app-config.service';
import {
  isMockToken,
  NonRetryablePublishError,
  PlatformPublisher,
  PlatformPublishPayload,
  PlatformPublishResult,
  readProviderError,
} from './platform-publisher.interface';

const CONTAINER_POLL_INTERVAL_MS = 5000;
const CONTAINER_POLL_ATTEMPTS = 24;

/**
 * Adaptador para Instagram Graph API (Reels).
 * Documentación oficial: POST /{ig-user-id}/media (media_type=REELS, video_url=publicUrl)
 * seguido de POST /{ig-user-id}/media_publish.
 */
@Injectable()
export class InstagramReelsPublisher implements PlatformPublisher {
  readonly platform = SocialPlatform.INSTAGRAM;
  readonly refreshMarginSeconds = 60 * 60 * 24 * 7;
  private readonly logger = new Logger(InstagramReelsPublisher.name);

  constructor(private readonly config: AppConfigService) {}

  private graph(path: string): string {
    return `https://graph.facebook.com/${this.config.metaGraphVersion}/${path}`;
  }

  private async waitForContainer(containerId: string, accessToken: string): Promise<void> {
    for (let attempt = 0; attempt < CONTAINER_POLL_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, CONTAINER_POLL_INTERVAL_MS));
      const res = await fetch(
        `${this.graph(containerId)}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`,
      );
      if (!res.ok) continue;
      const status = (await res.json()) as { status_code?: string; status?: string };
      if (status.status_code === 'FINISHED') return;
      if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') {
        throw new NonRetryablePublishError(
          `Instagram no pudo procesar el video: ${status.status || status.status_code}`,
        );
      }
    }
    throw new Error('Instagram sigue procesando el video: se superó el tiempo de espera.');
  }

  async publishVideo(payload: PlatformPublishPayload): Promise<PlatformPublishResult> {
    const caption = `${payload.title}\n\n${payload.description}\n${payload.hashtags
      .map((t) => `#${t}`)
      .join(' ')}`.trim();

    if (this.config.mockPlatforms && isMockToken(payload.accessToken)) {
      this.logger.log(`[SIMULADO] Reel para ${payload.externalAccountId}: "${payload.title}"`);
      const fakeId = `ig_reel_${crypto.randomBytes(5).toString('hex')}`;
      return {
        platform: this.platform,
        externalPostId: fakeId,
        externalPostUrl: `https://www.instagram.com/reel/${fakeId}/`,
        publishedAt: new Date(),
      };
    }

    if (!/^https:\/\//i.test(payload.publicVideoUrl)) {
      throw new NonRetryablePublishError(
        'Instagram descarga el video desde una URL pública HTTPS: configurá PUBLIC_APP_URL con una dirección accesible desde internet.',
      );
    }

    const containerRes = await fetch(this.graph(`${payload.externalAccountId}/media`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: payload.publicVideoUrl,
        caption,
        share_to_feed: payload.shareToFeed,
        access_token: payload.accessToken,
      }),
    });
    if (!containerRes.ok) {
      throw new Error(`Instagram rechazó el contenedor: ${await readProviderError(containerRes)}`);
    }
    const container = (await containerRes.json()) as { id: string };

    await this.waitForContainer(container.id, payload.accessToken);

    const publishRes = await fetch(this.graph(`${payload.externalAccountId}/media_publish`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: container.id, access_token: payload.accessToken }),
    });
    if (!publishRes.ok) {
      throw new Error(`Instagram rechazó la publicación: ${await readProviderError(publishRes)}`);
    }
    const published = (await publishRes.json()) as { id: string };

    // El id de la API no sirve para armar la URL pública: el enlace real es `permalink`.
    let permalink = `https://www.instagram.com/${payload.externalAccountId}/`;
    const mediaRes = await fetch(
      `${this.graph(published.id)}?fields=permalink&access_token=${encodeURIComponent(payload.accessToken)}`,
    ).catch(() => null);
    if (mediaRes?.ok) {
      const media = (await mediaRes.json()) as { permalink?: string };
      if (media.permalink) permalink = media.permalink;
    }

    return {
      platform: this.platform,
      externalPostId: published.id,
      externalPostUrl: permalink,
      publishedAt: new Date(),
    };
  }

  /** Meta no emite refresh tokens: un token de larga duración vigente se canjea por otro nuevo. */
  async refreshAccessToken(longLivedToken: string) {
    const appId = this.config.instagramAppId;
    const appSecret = this.config.instagramAppSecret;
    if (!appId || !appSecret) {
      throw new NonRetryablePublishError('Instagram no está configurado en el servidor.');
    }
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: longLivedToken,
    });
    const res = await fetch(`${this.graph('oauth/access_token')}?${params.toString()}`);
    if (!res.ok) {
      throw new NonRetryablePublishError(`Meta rechazó renovar el acceso: ${await readProviderError(res)}`);
    }
    const data = (await res.json()) as { access_token: string; expires_in?: number };
    return {
      accessToken: data.access_token,
      refreshToken: data.access_token,
      expiresInSeconds: data.expires_in || 60 * 60 * 24 * 60,
    };
  }
}

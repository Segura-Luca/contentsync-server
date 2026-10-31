import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialPlatform } from '@prisma/client';
import * as crypto from 'crypto';
import {
  PlatformPublisher,
  PlatformPublishPayload,
  PlatformPublishResult,
} from './platform-publisher.interface';

/**
 * Adaptador para Instagram Graph API (Reels).
 * Documentación oficial: POST /{ig-user-id}/media (media_type=REELS, video_url=publicUrl)
 * seguido de POST /{ig-user-id}/media_publish.
 */
@Injectable()
export class InstagramReelsPublisher implements PlatformPublisher {
  readonly platform = SocialPlatform.INSTAGRAM;
  private readonly logger = new Logger(InstagramReelsPublisher.name);
  private readonly mockMode: boolean;

  constructor(private readonly configService: ConfigService) {
    this.mockMode =
      this.configService.get<string>('MOCK_PLATFORMS', 'true') === 'true';
  }

  async publishVideo(payload: PlatformPublishPayload): Promise<PlatformPublishResult> {
    const caption = `${payload.title}\n\n${payload.description}\n${payload.hashtags
      .map((t) => `#${t}`)
      .join(' ')}`.trim();

    const hasRealToken =
      payload.accessToken &&
      !payload.accessToken.startsWith('live_token_') &&
      !payload.accessToken.startsWith('mock_') &&
      !payload.externalAccountId.startsWith('instagram_');

    if (this.mockMode && !hasRealToken) {
      this.logger.log(
        `[INSTAGRAM GRAPH API - MOCK] Publicando Reel para cuenta ${payload.externalAccountId}: "${payload.title}"`,
      );
      const fakeId = `ig_reel_${crypto.randomBytes(5).toString('hex')}`;
      return {
        platform: this.platform,
        externalPostId: fakeId,
        externalPostUrl: `https://www.instagram.com/reel/${fakeId}/`,
        publishedAt: new Date(),
      };
    }

    // Flujo real contra Instagram Graph API v20.0
    const createContainerUrl = `https://graph.facebook.com/v20.0/${payload.externalAccountId}/media`;
    const containerRes = await fetch(createContainerUrl, {
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
      const errText = await containerRes.text();
      throw new Error(`Instagram Graph API container error: ${errText}`);
    }

    const containerJson = (await containerRes.json()) as { id: string };

    // Esperar hasta que el contenedor de Reel esté en estado FINISHED
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const statusRes = await fetch(
        `https://graph.facebook.com/v20.0/${containerJson.id}?fields=status_code,status&access_token=${encodeURIComponent(payload.accessToken)}`,
      );
      if (statusRes.ok) {
        const statusJson = (await statusRes.json()) as {
          status_code?: string;
          status?: string;
        };
        if (statusJson.status_code === 'FINISHED') break;
        if (statusJson.status_code === 'ERROR') {
          throw new Error(
            `Instagram Graph API media container falló el procesamiento: ${statusJson.status || 'ERROR'}`,
          );
        }
      }
    }

    const publishUrl = `https://graph.facebook.com/v20.0/${payload.externalAccountId}/media_publish`;
    const publishRes = await fetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerJson.id,
        access_token: payload.accessToken,
      }),
    });

    if (!publishRes.ok) {
      const errText = await publishRes.text();
      throw new Error(`Instagram Graph API publish error: ${errText}`);
    }

    const publishJson = (await publishRes.json()) as { id: string };
    return {
      platform: this.platform,
      externalPostId: publishJson.id,
      externalPostUrl: `https://www.instagram.com/reel/${publishJson.id}/`,
      publishedAt: new Date(),
    };
  }

  async refreshAccessToken(refreshToken: string) {
    return {
      accessToken: `ig_refreshed_${crypto.randomBytes(8).toString('hex')}`,
      refreshToken,
      expiresInSeconds: 60 * 60 * 24 * 60,
    };
  }
}

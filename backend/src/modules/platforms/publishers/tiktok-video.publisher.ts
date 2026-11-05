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

const STATUS_POLL_INTERVAL_MS = 5000;
const STATUS_POLL_ATTEMPTS = 24;

interface TikTokEnvelope<T> {
  data?: T;
  error?: { code?: string; message?: string };
}

/**
 * Adaptador para TikTok Content Posting API v2.
 * Endpoint oficial: POST https://open.tiktokapis.com/v2/post/publish/video/init/
 */
@Injectable()
export class TikTokVideoPublisher implements PlatformPublisher {
  readonly platform = SocialPlatform.TIKTOK;
  readonly refreshMarginSeconds = 120;
  private readonly logger = new Logger(TikTokVideoPublisher.name);

  constructor(private readonly config: AppConfigService) {}

  /** PULL_FROM_URL es asíncrono: aceptar el pedido no significa que el video se haya publicado. */
  private async waitForPublication(
    publishId: string,
    accessToken: string,
  ): Promise<string | null> {
    for (let attempt = 0; attempt < STATUS_POLL_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS));
      const res = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({ publish_id: publishId }),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as TikTokEnvelope<{
        status?: string;
        fail_reason?: string;
        publicaly_available_post_id?: Array<string | number>;
      }>;
      const status = json.data?.status;
      if (status === 'PUBLISH_COMPLETE') {
        const postId = json.data?.publicaly_available_post_id?.[0];
        return postId !== undefined ? String(postId) : null;
      }
      if (status === 'FAILED') {
        throw new NonRetryablePublishError(`TikTok no pudo publicar el video: ${json.data?.fail_reason || 'sin detalle'}`);
      }
    }
    throw new Error('TikTok sigue procesando el video: se superó el tiempo de espera.');
  }

  async publishVideo(payload: PlatformPublishPayload): Promise<PlatformPublishResult> {
    const titleWithTags = `${payload.title} ${payload.hashtags.map((t) => `#${t}`).join(' ')}`.trim();

    if (this.config.mockPlatforms && isMockToken(payload.accessToken)) {
      this.logger.log(`[SIMULADO] Video de TikTok para ${payload.externalAccountId}: "${titleWithTags}"`);
      const fakeId = `tt_${crypto.randomBytes(6).toString('hex')}`;
      return {
        platform: this.platform,
        externalPostId: fakeId,
        externalPostUrl: `https://www.tiktok.com/@${payload.externalAccountId}/video/${fakeId}`,
        publishedAt: new Date(),
      };
    }

    if (!/^https:\/\//i.test(payload.publicVideoUrl)) {
      throw new NonRetryablePublishError(
        'TikTok descarga el video desde una URL pública HTTPS de un dominio verificado: configurá PUBLIC_APP_URL.',
      );
    }

    const response = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${payload.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title: titleWithTags.slice(0, 150),
          privacy_level: payload.privacyLevel === 'PUBLIC' ? 'PUBLIC_TO_EVERYONE' : 'SELF_ONLY',
          disable_comment: !payload.allowComments,
          disable_duet: !payload.allowDuetStitch,
          disable_stitch: !payload.allowDuetStitch,
        },
        source_info: { source: 'PULL_FROM_URL', video_url: payload.publicVideoUrl },
      }),
    });
    if (!response.ok) {
      throw new Error(`TikTok rechazó la publicación: ${await readProviderError(response)}`);
    }

    const json = (await response.json()) as TikTokEnvelope<{ publish_id?: string }>;
    const publishId = json.data?.publish_id;
    if (!publishId) {
      throw new Error(`TikTok no aceptó la publicación: ${json.error?.message || json.error?.code || 'sin detalle'}`);
    }

    const postId = await this.waitForPublication(publishId, payload.accessToken);
    return {
      platform: this.platform,
      externalPostId: postId ?? publishId,
      externalPostUrl: postId
        ? `https://www.tiktok.com/@/video/${postId}`
        : 'https://www.tiktok.com/tiktokstudio/content',
      publishedAt: new Date(),
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const clientKey = this.config.get('TIKTOK_CLIENT_KEY');
    const clientSecret = this.config.get('TIKTOK_CLIENT_SECRET');
    if (!clientKey || !clientSecret) {
      throw new NonRetryablePublishError('TikTok no está configurado en el servidor.');
    }
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });
    if (!res.ok) {
      throw new NonRetryablePublishError(`TikTok rechazó renovar el acceso: ${await readProviderError(res)}`);
    }
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error_description?: string;
    };
    if (!data.access_token) {
      throw new NonRetryablePublishError(`TikTok rechazó renovar el acceso: ${data.error_description || 'sin detalle'}`);
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresInSeconds: data.expires_in || 86400,
    };
  }
}

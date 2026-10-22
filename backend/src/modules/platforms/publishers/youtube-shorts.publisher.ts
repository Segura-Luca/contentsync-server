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
 * Adaptador para YouTube Data API v3 (OAuth 2.0, Resumable Upload Protocol).
 * Endpoint oficial: POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status
 */
@Injectable()
export class YouTubeShortsPublisher implements PlatformPublisher {
  readonly platform = SocialPlatform.YOUTUBE;
  private readonly logger = new Logger(YouTubeShortsPublisher.name);
  private readonly mockMode: boolean;

  constructor(private readonly configService: ConfigService) {
    this.mockMode =
      this.configService.get<string>('MOCK_PLATFORMS', 'true') === 'true';
  }

  async publishVideo(payload: PlatformPublishPayload): Promise<PlatformPublishResult> {
    const shortsTitle = payload.title.includes('#Shorts')
      ? payload.title
      : `${payload.title} #Shorts`.slice(0, 100);

    if (this.mockMode) {
      this.logger.log(
        `[YOUTUBE DATA API v3 - MOCK] Subida resumible completada para canal ${payload.externalAccountId}: "${shortsTitle}"`,
      );
      const fakeVideoId = crypto.randomBytes(6).toString('base64url');
      return {
        platform: this.platform,
        externalPostId: fakeVideoId,
        externalPostUrl: `https://youtube.com/shorts/${fakeVideoId}`,
        publishedAt: new Date(),
      };
    }

    // Paso 1: Iniciar sesión de subida resumible en YouTube Data API v3
    const initUrl =
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
    const initRes = await fetch(initUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${payload.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/mp4',
      },
      body: JSON.stringify({
        snippet: {
          title: shortsTitle,
          description: `${payload.description}\n\n${payload.hashtags
            .map((t) => `#${t}`)
            .join(' ')}`,
          tags: payload.hashtags,
          categoryId: '22',
        },
        status: {
          privacyStatus: payload.privacyLevel.toLowerCase(),
          selfDeclaredMadeForKids: payload.madeForKids,
        },
      }),
    });

    if (!initRes.ok) {
      const errText = await initRes.text();
      throw new Error(`YouTube Data API v3 resumable init error: ${errText}`);
    }

    const uploadLocation = initRes.headers.get('location');
    if (!uploadLocation) {
      throw new Error('YouTube Data API v3 no devolvió cabecera Location para subida resumible');
    }

    const videoStreamRes = await fetch(payload.publicVideoUrl);
    const videoBuffer = await videoStreamRes.arrayBuffer();

    const uploadRes = await fetch(uploadLocation, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
      },
      body: videoBuffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`YouTube Data API v3 resumable upload error: ${errText}`);
    }

    const uploadedJson = (await uploadRes.json()) as { id: string };
    return {
      platform: this.platform,
      externalPostId: uploadedJson.id,
      externalPostUrl: `https://youtube.com/shorts/${uploadedJson.id}`,
      publishedAt: new Date(),
    };
  }

  async refreshAccessToken(refreshToken: string) {
    return {
      accessToken: `yt_refreshed_${crypto.randomBytes(8).toString('hex')}`,
      refreshToken,
      expiresInSeconds: 3600,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialPlatform } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { join } from 'path';
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

    const hasRealToken =
      payload.accessToken &&
      !payload.accessToken.startsWith('live_token_') &&
      !payload.accessToken.startsWith('mock_');

    if (this.mockMode && !hasRealToken) {
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

    let videoBuffer: ArrayBuffer | Buffer;
    const uploadsMatch = payload.publicVideoUrl.match(/\/uploads\/videos\/([^/?#]+)$/);
    const localDiskPath = uploadsMatch
      ? join(__dirname, '..', '..', '..', '..', 'public', 'uploads', 'videos', uploadsMatch[1])
      : null;

    if (localDiskPath && fs.existsSync(localDiskPath)) {
      videoBuffer = fs.readFileSync(localDiskPath);
    } else {
      const fetchUrl = payload.publicVideoUrl.startsWith('/')
        ? `http://localhost:${this.configService.get<string>('PORT') || '3000'}${payload.publicVideoUrl}`
        : payload.publicVideoUrl;
      const videoStreamRes = await fetch(fetchUrl);
      videoBuffer = await videoStreamRes.arrayBuffer();
    }

    const uploadRes = await fetch(uploadLocation, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
      },
      body: videoBuffer as any,
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
    const clientId =
      this.configService.get<string>('YOUTUBE_CLIENT_ID') ||
      this.configService.get<string>('GOOGLE_AUTH_CLIENT_ID');
    const clientSecret = this.configService.get<string>('YOUTUBE_CLIENT_SECRET');

    if (clientId && clientSecret && refreshToken && !refreshToken.startsWith('yt_refresh_')) {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          access_token: string;
          expires_in?: number;
        };
        return {
          accessToken: data.access_token,
          refreshToken,
          expiresInSeconds: data.expires_in || 3600,
        };
      }
    }

    return {
      accessToken: `yt_refreshed_${crypto.randomBytes(8).toString('hex')}`,
      refreshToken,
      expiresInSeconds: 3600,
    };
  }
}

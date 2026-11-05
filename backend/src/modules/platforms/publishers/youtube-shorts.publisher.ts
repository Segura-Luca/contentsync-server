import { Injectable, Logger } from '@nestjs/common';
import { SocialPlatform } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { basename, join } from 'path';
import { Readable } from 'stream';
import { AppConfigService } from '../../../config/app-config.service';
import {
  isMockToken,
  NonRetryablePublishError,
  PlatformPublisher,
  PlatformPublishPayload,
  PlatformPublishResult,
  readProviderError,
} from './platform-publisher.interface';

const SHORTS_TAG = ' #Shorts';
const YOUTUBE_TITLE_MAX = 100;

/**
 * Adaptador para YouTube Data API v3 (OAuth 2.0, Resumable Upload Protocol).
 * Endpoint oficial: POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status
 */
@Injectable()
export class YouTubeShortsPublisher implements PlatformPublisher {
  readonly platform = SocialPlatform.YOUTUBE;
  readonly refreshMarginSeconds = 120;
  private readonly logger = new Logger(YouTubeShortsPublisher.name);

  constructor(private readonly config: AppConfigService) {}

  private shortsTitle(title: string): string {
    if (/#shorts/i.test(title)) return title.slice(0, YOUTUBE_TITLE_MAX);
    return `${title.slice(0, YOUTUBE_TITLE_MAX - SHORTS_TAG.length)}${SHORTS_TAG}`;
  }

  /** Abre el video como flujo: cargarlo entero en memoria agotaría la RAM con archivos grandes. */
  private async openVideo(publicVideoUrl: string): Promise<{ body: unknown; size?: number }> {
    const match = /\/uploads\/videos\/([^/?#]+)$/.exec(publicVideoUrl);
    if (match) {
      const localPath = join(this.config.uploadDir, basename(match[1]));
      if (fs.existsSync(localPath)) {
        return { body: Readable.toWeb(fs.createReadStream(localPath)), size: fs.statSync(localPath).size };
      }
    }
    if (!/^https?:\/\//i.test(publicVideoUrl)) {
      throw new NonRetryablePublishError('El archivo de video ya no está disponible en el servidor.');
    }
    const res = await fetch(publicVideoUrl);
    if (!res.ok || !res.body) {
      throw new Error(`No se pudo leer el video (HTTP ${res.status}).`);
    }
    const length = Number(res.headers.get('content-length'));
    return { body: res.body, size: Number.isFinite(length) && length > 0 ? length : undefined };
  }

  async publishVideo(payload: PlatformPublishPayload): Promise<PlatformPublishResult> {
    const title = this.shortsTitle(payload.title);

    if (this.config.mockPlatforms && isMockToken(payload.accessToken)) {
      this.logger.log(`[SIMULADO] Subida a YouTube para ${payload.externalAccountId}: "${title}"`);
      const fakeId = crypto.randomBytes(6).toString('base64url');
      return {
        platform: this.platform,
        externalPostId: fakeId,
        externalPostUrl: `https://youtube.com/shorts/${fakeId}`,
        publishedAt: new Date(),
      };
    }

    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${payload.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'video/*',
        },
        body: JSON.stringify({
          snippet: {
            title,
            description: `${payload.description}\n\n${payload.hashtags.map((t) => `#${t}`).join(' ')}`.trim(),
            tags: payload.hashtags,
            categoryId: '22',
          },
          status: {
            privacyStatus: payload.privacyLevel.toLowerCase(),
            selfDeclaredMadeForKids: payload.madeForKids,
          },
        }),
      },
    );
    if (!initRes.ok) {
      throw new Error(`YouTube rechazó iniciar la subida: ${await readProviderError(initRes)}`);
    }

    const uploadLocation = initRes.headers.get('location');
    if (!uploadLocation) {
      throw new Error('YouTube no devolvió la dirección de subida.');
    }

    const video = await this.openVideo(payload.publicVideoUrl);
    const uploadRes = await fetch(uploadLocation, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/*',
        ...(video.size ? { 'Content-Length': String(video.size) } : {}),
      },
      body: video.body as BodyInit,
      duplex: 'half',
    } as RequestInit);
    if (!uploadRes.ok) {
      throw new Error(`YouTube rechazó la subida: ${await readProviderError(uploadRes)}`);
    }

    const uploaded = (await uploadRes.json()) as { id: string };
    return {
      platform: this.platform,
      externalPostId: uploaded.id,
      externalPostUrl: `https://youtube.com/shorts/${uploaded.id}`,
      publishedAt: new Date(),
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const clientId = this.config.youtubeClientId;
    const clientSecret = this.config.get('YOUTUBE_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new NonRetryablePublishError('YouTube no está configurado en el servidor.');
    }
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
    if (!res.ok) {
      throw new NonRetryablePublishError(`YouTube rechazó renovar el acceso: ${await readProviderError(res)}`);
    }
    const data = (await res.json()) as { access_token: string; expires_in?: number };
    return { accessToken: data.access_token, refreshToken, expiresInSeconds: data.expires_in || 3600 };
  }
}

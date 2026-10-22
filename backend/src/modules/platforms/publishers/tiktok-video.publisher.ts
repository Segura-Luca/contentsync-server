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
 * Adaptador para TikTok Content Posting API v2.
 * Endpoint oficial: POST https://open.tiktokapis.com/v2/post/publish/video/init/
 */
@Injectable()
export class TikTokVideoPublisher implements PlatformPublisher {
  readonly platform = SocialPlatform.TIKTOK;
  private readonly logger = new Logger(TikTokVideoPublisher.name);
  private readonly mockMode: boolean;

  constructor(private readonly configService: ConfigService) {
    this.mockMode =
      this.configService.get<string>('MOCK_PLATFORMS', 'true') === 'true';
  }

  async publishVideo(payload: PlatformPublishPayload): Promise<PlatformPublishResult> {
    const titleWithTags = `${payload.title} ${payload.hashtags
      .map((t) => `#${t}`)
      .join(' ')}`.trim();

    if (this.mockMode) {
      this.logger.log(
        `[TIKTOK CONTENT POSTING API - MOCK] Publicando video para ${payload.externalAccountId}: "${titleWithTags}"`,
      );
      const fakeId = `tt_${crypto.randomBytes(6).toString('hex')}`;
      return {
        platform: this.platform,
        externalPostId: fakeId,
        externalPostUrl: `https://www.tiktok.com/@${payload.externalAccountId}/video/${fakeId}`,
        publishedAt: new Date(),
      };
    }

    const response = await fetch(
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${payload.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          post_info: {
            title: titleWithTags.slice(0, 150),
            privacy_level:
              payload.privacyLevel === 'PUBLIC'
                ? 'PUBLIC_TO_EVERYONE'
                : 'SELF_ONLY',
            disable_comment: !payload.allowComments,
            disable_duet: !payload.allowDuetStitch,
            disable_stitch: !payload.allowDuetStitch,
          },
          source_info: {
            source: 'PULL_FROM_URL',
            video_url: payload.publicVideoUrl,
          },
        }),
      },
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`TikTok Content Posting API error: ${errBody}`);
    }

    const json = (await response.json()) as { data?: { publish_id?: string } };
    const publishId = json.data?.publish_id || `tt_${Date.now()}`;
    return {
      platform: this.platform,
      externalPostId: publishId,
      externalPostUrl: `https://www.tiktok.com/@${payload.externalAccountId}/video/${publishId}`,
      publishedAt: new Date(),
    };
  }

  async refreshAccessToken(refreshToken: string) {
    return {
      accessToken: `tt_refreshed_${crypto.randomBytes(8).toString('hex')}`,
      refreshToken: `tt_refresh_${crypto.randomBytes(8).toString('hex')}`,
      expiresInSeconds: 86400,
    };
  }
}

import { PrivacyLevel, SocialPlatform } from '@prisma/client';

export interface PlatformPublishPayload {
  videoId: string;
  title: string;
  description: string;
  hashtags: string[];
  publicVideoUrl: string;
  thumbnailUrl?: string | null;
  privacyLevel: PrivacyLevel;
  shareToFeed: boolean;
  allowComments: boolean;
  allowDuetStitch: boolean;
  madeForKids: boolean;
  accessToken: string;
  externalAccountId: string;
}

export interface PlatformPublishResult {
  platform: SocialPlatform;
  externalPostId: string;
  externalPostUrl: string;
  publishedAt: Date;
}

/**
 * Patrón Strategy / Adapter: Interfaz común `PlatformPublisher`.
 * Permite agregar nuevas redes sociales (ej. LinkedIn Video, X/Twitter, Pinterest)
 * implementando esta interfaz sin modificar el servicio de publicación ni la cola BullMQ.
 */
export interface PlatformPublisher {
  readonly platform: SocialPlatform;
  publishVideo(payload: PlatformPublishPayload): Promise<PlatformPublishResult>;
  refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresInSeconds: number;
  }>;
}

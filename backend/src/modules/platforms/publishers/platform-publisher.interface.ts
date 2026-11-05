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

export interface RefreshedPlatformToken {
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds: number;
}

/** Error definitivo: reintentar no lo resolvería (cuenta sin conectar, token revocado, video rechazado). */
export class NonRetryablePublishError extends Error {}

/**
 * Patrón Strategy / Adapter: Interfaz común `PlatformPublisher`.
 * Permite agregar nuevas redes sociales implementando esta interfaz
 * sin modificar el servicio de publicación.
 */
export interface PlatformPublisher {
  readonly platform: SocialPlatform;
  /** Cuánto antes del vencimiento conviene renovar. Instagram solo renueva tokens todavía vigentes. */
  readonly refreshMarginSeconds: number;
  publishVideo(payload: PlatformPublishPayload): Promise<PlatformPublishResult>;
  refreshAccessToken(refreshToken: string): Promise<RefreshedPlatformToken>;
}

export function isMockToken(token: string): boolean {
  return ['live_token_', 'mock_', 'demo_access_'].some((prefix) => token.startsWith(prefix));
}

export async function readProviderError(res: Response): Promise<string> {
  const body = await res.text().catch(() => '');
  return `HTTP ${res.status}: ${body.slice(0, 500)}`;
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAbsolute, join, resolve } from 'path';
import { isPlaceholder } from './env.validation';

const DURATION_UNITS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

export function durationToSeconds(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) throw new Error(`Duración inválida: ${value}`);
  return Number(match[1]) * DURATION_UNITS[match[2]];
}

/**
 * Único punto de lectura de la configuración de infraestructura. Los valores de ejemplo
 * ("your-...") cuentan como no configurados, de modo que la UI nunca ofrece un proveedor roto.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  get(key: string): string | undefined {
    const value = this.config.get<string>(key);
    if (value === undefined || value === null) return undefined;
    const text = String(value).trim();
    return isPlaceholder(text) ? undefined : text;
  }

  /** Igual que `get`, sin filtrar valores que parezcan de ejemplo. */
  getRaw(key: string): string | undefined {
    const value = this.config.get<string>(key);
    return value === undefined || value === null ? undefined : String(value).trim();
  }

  private bool(key: string, fallback: boolean): boolean {
    const value = this.getRaw(key)?.toLowerCase();
    return value ? value === 'true' : fallback;
  }

  private int(key: string, fallback: number): number {
    const value = Number(this.getRaw(key));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private list(key: string): string[] {
    return (this.getRaw(key) || '')
      .split(',')
      .map((item) => item.trim().replace(/\/+$/, ''))
      .filter(Boolean);
  }

  get nodeEnv(): string {
    return this.getRaw('NODE_ENV') || 'development';
  }
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
  get port(): number {
    return this.int('PORT', 3000);
  }
  get apiPrefix(): string {
    return (this.getRaw('API_PREFIX') || 'api/v1').replace(/^\/+|\/+$/g, '');
  }
  get swaggerEnabled(): boolean {
    return this.bool('SWAGGER_ENABLED', true);
  }
  get corsOrigins(): string[] {
    return this.list('CORS_ORIGIN');
  }
  get cspExtraConnectSrc(): string[] {
    return this.list('CSP_EXTRA_CONNECT_SRC');
  }
  get rateLimitPerMinute(): number {
    return this.int('RATE_LIMIT_PER_MINUTE', 200);
  }
  get authRateLimitPerMinute(): number {
    return this.int('AUTH_RATE_LIMIT_PER_MINUTE', 10);
  }

  get jwtAccessSecret(): string {
    return this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }
  get jwtRefreshSecret(): string {
    return this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }
  get jwtAccessExpiresIn(): string {
    return this.getRaw('JWT_ACCESS_EXPIRES_IN') || '15m';
  }
  get jwtRefreshExpiresIn(): string {
    return this.getRaw('JWT_REFRESH_EXPIRES_IN') || '7d';
  }

  /** URL pública canónica configurada, sin barra final. */
  get configuredPublicUrl(): string | undefined {
    return (this.get('PUBLIC_APP_URL') || this.get('RENDER_EXTERNAL_URL'))?.replace(/\/+$/, '');
  }

  /**
   * URL base para callbacks y enlaces. El host de la petición solo se usa en desarrollo
   * (emulador, LAN): en producción, confiar en él permitiría envenenar los redirects OAuth.
   */
  publicBaseUrl(fromRequest?: string): string {
    const configured = this.configuredPublicUrl;
    if (configured && (this.isProduction || !fromRequest)) return configured;
    return (fromRequest || configured || `http://localhost:${this.port}`).replace(/\/+$/, '');
  }

  apiUrl(path: string, fromRequest?: string): string {
    return `${this.publicBaseUrl(fromRequest)}/${this.apiPrefix}/${path.replace(/^\/+/, '')}`;
  }

  get mockPlatforms(): boolean {
    return !this.isProduction && this.bool('MOCK_PLATFORMS', false);
  }
  get fcmMockMode(): boolean {
    return this.bool('FCM_MOCK_MODE', true);
  }
  get metaGraphVersion(): string {
    return this.getRaw('META_GRAPH_VERSION') || 'v20.0';
  }
  get youtubeClientId(): string | undefined {
    return this.get('YOUTUBE_CLIENT_ID') || this.get('GOOGLE_AUTH_CLIENT_ID');
  }
  get instagramAppId(): string | undefined {
    return this.get('INSTAGRAM_APP_ID') || this.get('FACEBOOK_AUTH_APP_ID');
  }
  get instagramAppSecret(): string | undefined {
    return this.get('INSTAGRAM_APP_SECRET') || this.get('FACEBOOK_AUTH_APP_SECRET');
  }
  get instagramScopes(): string {
    return (
      this.getRaw('INSTAGRAM_SCOPES') ||
      'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management'
    );
  }

  get publicDir(): string {
    return join(__dirname, '..', '..', 'public');
  }
  get uploadDir(): string {
    const configured = this.getRaw('UPLOAD_DIR');
    if (!configured) return join(this.publicDir, 'uploads', 'videos');
    return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  }
  get uploadMaxBytes(): number {
    return this.int('UPLOAD_MAX_MB', 500) * 1024 * 1024;
  }

  get schedulerEnabled(): boolean {
    return this.bool('PUBLISH_SCHEDULER_ENABLED', true);
  }
  get schedulerIntervalMs(): number {
    return this.int('PUBLISH_SCHEDULER_INTERVAL_MS', 20000);
  }
  get publishStaleMinutes(): number {
    return this.int('PUBLISH_STALE_MINUTES', 15);
  }
  get settingsRefreshSeconds(): number {
    return this.int('SETTINGS_REFRESH_SECONDS', 30);
  }

  /** Dirección que se muestra como remitente en textos y plantillas. */
  get mailSenderAddress(): string | undefined {
    const explicit = this.getRaw('MAIL_SENDER_ADDRESS');
    if (explicit) return explicit;
    const from = this.getRaw('SMTP_FROM') || '';
    const match = /<([^>]+)>/.exec(from) || /([^\s<>"]+@[^\s<>"]+)/.exec(from);
    return match?.[1];
  }
}

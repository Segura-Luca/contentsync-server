/**
 * Acceso centralizado a las variables de entorno, con valores por defecto y conversión de tipos.
 * Las variables se explican en .env.example.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAbsolute, join, resolve } from 'path';
import { isPlaceholder } from './env.validation';

// Segundos que equivalen a cada unidad de duración.
const DURATION_UNITS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/** Convierte una duración como "15m" o "7d" en segundos. */
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

  /** Lee una variable; si está vacía o conserva un valor de ejemplo, devuelve undefined. */
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

  /** Lee una variable como verdadero/falso. */
  private bool(key: string, fallback: boolean): boolean {
    const value = this.getRaw(key)?.toLowerCase();
    return value ? value === 'true' : fallback;
  }

  /** Lee una variable como entero positivo; si no lo es, usa el valor por defecto. */
  private int(key: string, fallback: number): number {
    const value = Number(this.getRaw(key));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  /** Lee una lista separada por comas, quitando espacios y barras finales. */
  private list(key: string): string[] {
    return (this.getRaw(key) || '')
      .split(',')
      .map((item) => item.trim().replace(/\/+$/, ''))
      .filter(Boolean);
  }

  // Servidor: entorno, puerto, prefijo de la API, CORS y límites de peticiones.
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

  // Sesiones: secretos y duración de los tokens. getOrThrow falla si el secreto no existe.
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

  /** Construye la URL completa de una ruta de la API. */
  apiUrl(path: string, fromRequest?: string): string {
    return `${this.publicBaseUrl(fromRequest)}/${this.apiPrefix}/${path.replace(/^\/+/, '')}`;
  }

  /** Notificaciones push simuladas (el envío real por Firebase aún no está implementado). */
  get fcmMockMode(): boolean {
    return this.bool('FCM_MOCK_MODE', true);
  }

  /** Versión de la API de Facebook que se usa en el acceso social. */
  get metaGraphVersion(): string {
    return this.getRaw('META_GRAPH_VERSION') || 'v20.0';
  }

  /** Carpeta `public`, que contiene la web (index.html). */
  get publicDir(): string {
    return join(__dirname, '..', '..', 'public');
  }
  /** Carpeta de archivos subidos: UPLOAD_DIR si está definida o public/uploads/videos. */
  get uploadDir(): string {
    const configured = this.getRaw('UPLOAD_DIR');
    if (!configured) return join(this.publicDir, 'uploads', 'videos');
    return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  }
  /** Tamaño máximo de subida en bytes (UPLOAD_MAX_MB, 500 MB por defecto). */
  get uploadMaxBytes(): number {
    return this.int('UPLOAD_MAX_MB', 500) * 1024 * 1024;
  }

  /** Cada cuántos segundos se vuelven a leer de MySQL los ajustes editables. */
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

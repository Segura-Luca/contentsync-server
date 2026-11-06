import * as crypto from 'crypto';

export function isPlaceholder(value: string | undefined | null): boolean {
  if (!value) return true;
  const v = value.trim();
  return (
    v.length === 0 ||
    /^(your-|tu-|tu_|change_this|changeme|replace_)/i.test(v) ||
    v.includes('your-')
  );
}

type RawEnv = Record<string, unknown>;

function str(env: RawEnv, key: string): string | undefined {
  const value = env[key];
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

/**
 * Valida la configuración al arrancar. En producción un secreto ausente o de ejemplo detiene
 * el proceso: es preferible no levantar el servicio a firmar sesiones con un valor público.
 * Fuera de producción se generan secretos efímeros para que el proyecto arranque sin configurar nada.
 */
export function validateEnv(raw: RawEnv): RawEnv {
  const env: RawEnv = { ...raw };
  const nodeEnv = str(env, 'NODE_ENV') || 'development';
  const isProduction = nodeEnv === 'production';
  const errors: string[] = [];
  const warnings: string[] = [];

  const databaseUrl = str(env, 'DATABASE_URL');
  if (!databaseUrl) {
    if (nodeEnv !== 'test') errors.push('DATABASE_URL es obligatoria.');
  } else if (!/^mysql:\/\//i.test(databaseUrl)) {
    errors.push('DATABASE_URL debe usar el protocolo mysql:// (ContentSync solo soporta MySQL).');
  }

  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    const secret = str(env, key);
    if (secret && !isPlaceholder(secret) && secret.length >= 32) continue;
    if (isProduction) {
      errors.push(`${key} debe ser un secreto propio de 32 caracteres o más.`);
    } else {
      env[key] = crypto.randomBytes(48).toString('hex');
      warnings.push(`${key} ausente o de ejemplo: se generó uno temporal (las sesiones caducan al reiniciar).`);
    }
  }
  if (str(env, 'JWT_ACCESS_SECRET') === str(env, 'JWT_REFRESH_SECRET')) {
    errors.push('JWT_ACCESS_SECRET y JWT_REFRESH_SECRET deben ser distintos.');
  }

  if (isProduction) {
    if (!str(env, 'PUBLIC_APP_URL') && !str(env, 'RENDER_EXTERNAL_URL')) {
      errors.push('PUBLIC_APP_URL es obligatoria en producción (se usa en correos y callbacks OAuth).');
    }
  }

  for (const key of [
    'PORT',
    'UPLOAD_MAX_MB',
    'RATE_LIMIT_PER_MINUTE',
    'AUTH_RATE_LIMIT_PER_MINUTE',
    'SETTINGS_REFRESH_SECONDS',
    'SMTP_PORT',
  ]) {
    const value = str(env, key);
    if (value !== undefined && !/^[1-9]\d*$/.test(value)) {
      errors.push(`${key} debe ser un entero positivo (recibido: "${value}").`);
    }
  }
  for (const key of ['FCM_MOCK_MODE', 'SWAGGER_ENABLED', 'SMTP_SECURE']) {
    const value = str(env, key);
    if (value !== undefined && !['true', 'false'].includes(value.toLowerCase())) {
      errors.push(`${key} debe ser "true" o "false" (recibido: "${value}").`);
    }
  }
  for (const key of ['PUBLIC_APP_URL', 'N8N_WEBHOOK_URL', 'GMAIL_HTTPS_WEBHOOK_URL', 'S3_ENDPOINT']) {
    const value = str(env, key);
    if (value !== undefined && !isPlaceholder(value) && !/^https?:\/\/\S+$/i.test(value)) {
      errors.push(`${key} debe ser una URL http(s) válida.`);
    }
  }
  for (const key of ['JWT_ACCESS_EXPIRES_IN', 'JWT_REFRESH_EXPIRES_IN']) {
    const value = str(env, key);
    if (value !== undefined && !/^\d+(s|m|h|d)$/.test(value)) {
      errors.push(`${key} debe tener el formato 15m, 12h o 7d (recibido: "${value}").`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuración inválida:\n - ${errors.join('\n - ')}`);
  }
  if (nodeEnv !== 'test') {
    warnings.forEach((warning) => console.warn(`[Config] ${warning}`));
  }
  return env;
}

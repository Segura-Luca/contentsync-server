/** Pruebas unitarias de la validación de entorno: qué se rechaza en producción y qué se genera solo en desarrollo. */
import { validateEnv } from './env.validation';

const productionEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'mysql://u:p@db:3306/contentsync',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  PUBLIC_APP_URL: 'https://app.example.com',
};

describe('validateEnv', () => {
  it('acepta una configuración de producción completa', () => {
    expect(() => validateEnv(productionEnv)).not.toThrow();
  });

  it.each([
    ['un secreto JWT ausente', { JWT_ACCESS_SECRET: '' }, 'JWT_ACCESS_SECRET'],
    ['un secreto JWT de ejemplo', { JWT_REFRESH_SECRET: 'change_this_to_a_64_char_random_hex_secret_for_refresh_tokens_2026' }, 'JWT_REFRESH_SECRET'],
    ['secretos iguales', { JWT_REFRESH_SECRET: 'a'.repeat(48) }, 'distintos'],
    ['una base que no es MySQL', { DATABASE_URL: 'postgresql://u:p@db:5432/x' }, 'mysql://'],
    ['la URL pública ausente', { PUBLIC_APP_URL: '' }, 'PUBLIC_APP_URL'],
    ['una duración inválida', { JWT_ACCESS_EXPIRES_IN: '15 minutos' }, 'JWT_ACCESS_EXPIRES_IN'],
  ])('rechaza en producción %s', (_name, overrides, message) => {
    expect(() => validateEnv({ ...productionEnv, ...overrides })).toThrow(message);
  });

  it('genera secretos temporales fuera de producción', () => {
    const env = validateEnv({ NODE_ENV: 'test' });
    expect(String(env.JWT_ACCESS_SECRET)).toHaveLength(96);
    expect(env.JWT_ACCESS_SECRET).not.toBe(env.JWT_REFRESH_SECRET);
  });
});

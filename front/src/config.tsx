/**
 * Configuración de la app: a qué servidor se conecta.
 * Por defecto usa el de Render. Para probar contra otro, definí EXPO_PUBLIC_API_URL
 * (por ejemplo http://10.0.2.2:3000 en el emulador de Android) antes de compilar.
 */
const DEFAULT_SERVER = 'https://contentsync-app.onrender.com';

/** Dirección del servidor, sin barra final. */
export const SERVER_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_SERVER).replace(/\/+$/, '');

/** Prefijo de todas las rutas de la API. */
export const API_BASE = `${SERVER_URL}/api/v1`;

/** Convierte una dirección relativa del servidor (por ejemplo /uploads/...) en una completa. */
export function absoluteUrl(url: string | null | undefined): string {
  if (!url) return '';
  return url.startsWith('/') ? SERVER_URL + url : url;
}

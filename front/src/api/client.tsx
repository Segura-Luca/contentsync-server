/**
 * Cliente HTTP de la API. El access token vive solo en memoria; el refresh token lo guarda
 * el servidor en una cookie httpOnly, que el sistema de red de Android envía solo.
 */
import { API_BASE, SERVER_URL } from '../config';
import { AuthResponse, MediaKind, PublicConfig } from './types';

/** Resultado de una petición. Nunca lanza errores. */
export interface ApiResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
}

let accessToken: string | null = null;
let onSessionRenewed: ((data: AuthResponse) => void) | null = null;
let refreshInFlight: Promise<boolean> | null = null;

/** Guarda el access token en memoria. */
export function setAccessToken(token: string | null) {
  accessToken = token;
}

/** Devuelve el access token actual. */
export function getAccessToken() {
  return accessToken;
}

/** Avisa a la app cuando el servidor renueva la sesión, para actualizar los datos del usuario. */
export function setSessionRenewedHandler(handler: ((data: AuthResponse) => void) | null) {
  onSessionRenewed = handler;
}

/** Renueva la sesión con la cookie. Varias peticiones vencidas comparten una sola renovación. */
export function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!res.ok) return false;
      const data = (await res.json()) as AuthResponse;
      accessToken = data.accessToken;
      onSessionRenewed?.(data);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** Hace una petición con el token. Ante un 401 renueva la sesión y reintenta una vez. */
export async function apiFetch<T = any>(
  path: string,
  options: { method?: string; body?: unknown } = {},
  canRefresh = true,
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    const res = await fetch(API_BASE + path, {
      method: options.method || 'GET',
      headers,
      credentials: 'include',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const isAuthRoute = path.startsWith('/auth/') && path !== '/auth/me';
    if (res.status === 401 && canRefresh && accessToken && !isAuthRoute) {
      if (await refreshSession()) return apiFetch<T>(path, options, false);
    }
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { message: 'No pudimos conectar con el servidor.' } as any };
  }
}

/** Cierra la sesión en el servidor. No depende del access token. */
export async function serverLogout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch {
    // Sin conexión: igual se cierra la sesión en el teléfono.
  }
}

/** Obtiene un mensaje apto para el usuario a partir de una respuesta de error. */
export function friendlyError(body: any, status: number): string {
  const m = body && body.message;
  if (Array.isArray(m)) return String(m[0]);
  if (typeof m === 'string' && m.trim()) return m;
  if (status === 401) return 'Correo o contraseña incorrectos.';
  if (status === 429) return 'Demasiados intentos. Esperá unos segundos.';
  return 'No pudimos completar la acción. Intentá nuevamente.';
}

/** Lee la configuración pública del servidor (nombre de la app, registro habilitado, tamaño máximo). */
export async function fetchPublicConfig(): Promise<PublicConfig> {
  try {
    const res = await fetch(`${SERVER_URL}/app-config.js`);
    const text = await res.text();
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    return JSON.parse(json) as PublicConfig;
  } catch {
    return {};
  }
}

/** Archivo elegido en el teléfono, listo para subir. */
export interface LocalFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

/** Respuesta del servidor al subir un archivo. */
export interface UploadedFile {
  storageKey: string;
  sizeBytes?: number;
  kind?: MediaKind;
}

/** Sube un archivo informando el avance (fetch no informa el progreso; XMLHttpRequest sí). */
export async function uploadFile(
  file: LocalFile,
  clientId: string,
  onProgress: (fraction: number) => void,
): Promise<UploadedFile> {
  // Una subida larga no puede reintentarse sola: el token y el tamaño se comprueban antes de empezar.
  const cfg = await apiFetch<{ maxMb?: number }>('/media/upload-config');
  const maxMb = cfg.data?.maxMb;
  const tooBig = maxMb ? `${file.name} pesa demasiado: el máximo es de ${maxMb} MB.` : `${file.name} pesa demasiado.`;
  if (maxMb && file.size > maxMb * 1024 * 1024) throw new Error(tooBig);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('clientId', clientId);
    form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as any);
    xhr.open('POST', `${API_BASE}/media/upload`);
    if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(ev.loaded / ev.total);
    };
    xhr.onload = () => {
      if (xhr.status === 413) return reject(new Error(tooBig));
      try {
        const parsed = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) resolve(parsed);
        else reject(new Error(friendlyError(parsed, xhr.status)));
      } catch {
        reject(new Error('Respuesta inesperada al subir el archivo.'));
      }
    };
    xhr.onerror = () => reject(new Error('Se cortó la conexión mientras se subía el archivo.'));
    xhr.send(form);
  });
}

/**
 * Escucha el canal de cambios del servidor (Server-Sent Events). React Native no trae EventSource,
 * así que se lee la respuesta a medida que llega. Cada mensaje solo avisa que hubo novedades.
 * Devuelve una función para cerrar la conexión. Si se corta, se reconecta sola.
 */
export function listenLiveChanges(onChange: () => void): () => void {
  let closed = false;
  let xhr: XMLHttpRequest | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;

  const connect = (isReconnect: boolean) => {
    if (closed) return;
    let seen = 0;
    xhr = new XMLHttpRequest();
    xhr.open('GET', `${API_BASE}/live/events`);
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.onprogress = () => {
      const text = xhr?.responseText || '';
      const fresh = text.slice(seen);
      seen = text.length;
      // Los avisos de "sigo conectado" llegan como event: ping y no cuentan como cambios.
      const events = fresh.split('\n\n').filter((e) => e.includes('data:') && !e.includes('event: ping'));
      if (events.length) onChange();
    };
    xhr.onreadystatechange = () => {
      if (xhr?.readyState === 2 && isReconnect) onChange();
      if (xhr?.readyState === 4 && !closed) retry = setTimeout(() => connect(true), 5000);
    };
    xhr.send();
  };

  connect(false);
  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    xhr?.abort();
  };
}

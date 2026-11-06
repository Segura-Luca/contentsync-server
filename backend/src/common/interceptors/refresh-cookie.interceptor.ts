/** Manejo de la cookie del refresh token: la crea, la borra y evita que el token viaje en el cuerpo de la respuesta. */
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Response } from 'express';
import { map, Observable } from 'rxjs';
import { AppConfigService } from '../../config/app-config.service';

/** Nombre de la cookie. Solo se envía a las rutas /auth de la API (ver cookiePath). */
export const REFRESH_COOKIE = 'cs_refresh';
const cookiePath = (config: AppConfigService) => `/${config.apiPrefix}/auth`;

/** Convierte "15m", "7d" o un número de segundos en milisegundos. */
function ttlToMs(value: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!match) return 7 * 24 * 3600 * 1000;
  const unit = { s: 1, m: 60, h: 3600, d: 86400 }[(match[2] || 's') as 's' | 'm' | 'h' | 'd'];
  return Number(match[1]) * unit * 1000;
}

/** Guarda el refresh token en una cookie httpOnly (JavaScript no puede leerla) y sameSite strict. */
export function setRefreshCookie(res: Response, token: string, config: AppConfigService) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.publicBaseUrl().startsWith('https://'),
    maxAge: ttlToMs(config.jwtRefreshExpiresIn),
    path: cookiePath(config),
  });
}

/** Borra la cookie al cerrar sesión o cuando el token deja de ser válido. */
export function clearRefreshCookie(res: Response, config: AppConfigService) {
  res.clearCookie(REFRESH_COOKIE, { path: cookiePath(config) });
}

/** El refresh token nunca llega al JavaScript de la página: un XSS no puede robar una sesión duradera. */
@Injectable()
export class RefreshCookieInterceptor implements NestInterceptor {
  constructor(private readonly config: AppConfigService) {}

  /** Revisa cada respuesta: si trae un refreshToken, lo pasa a la cookie y lo quita del JSON. */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((body: any) => {
        if (typeof body?.refreshToken === 'string') {
          const { refreshToken, ...rest } = body;
          setRefreshCookie(res, refreshToken, this.config);
          return rest;
        }
        // Crear la contraseña desde un código abre la sesión dentro de la respuesta.
        if (typeof body?.session?.refreshToken === 'string') {
          const { refreshToken, ...session } = body.session;
          setRefreshCookie(res, refreshToken, this.config);
          return { ...body, session };
        }
        return body;
      }),
    );
  }
}

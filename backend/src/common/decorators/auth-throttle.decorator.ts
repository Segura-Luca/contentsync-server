/** Decorador @AuthThrottle(): marca una ruta para que use el límite de peticiones estricto (ver app.module.ts). */
import { SetMetadata } from '@nestjs/common';

/** Nombre de la marca que lee el limitador para saber si debe aplicar el límite estricto. */
export const AUTH_THROTTLE_KEY = 'authThrottle';

/** Aplica el límite estricto AUTH_RATE_LIMIT_PER_MINUTE: rutas que validan credenciales o envían correos. */
export const AuthThrottle = () => SetMetadata(AUTH_THROTTLE_KEY, true);

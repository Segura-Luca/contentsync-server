import { SetMetadata } from '@nestjs/common';

export const AUTH_THROTTLE_KEY = 'authThrottle';

/** Aplica el límite estricto AUTH_RATE_LIMIT_PER_MINUTE: rutas que validan credenciales o envían correos. */
export const AuthThrottle = () => SetMetadata(AUTH_THROTTLE_KEY, true);

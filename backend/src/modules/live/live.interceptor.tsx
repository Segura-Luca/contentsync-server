/** Después de cada escritura exitosa, avisa a las pantallas conectadas que hay datos nuevos. */
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { LiveService } from './live.service';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Iniciar sesión o marcar avisos como leídos no cambia lo que ven los demás.
const SILENT_PATHS = /\/(auth|notifications)(\/|$)/;

@Injectable()
export class LiveInterceptor implements NestInterceptor {
  constructor(private readonly live: LiveService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    if (READ_METHODS.has(request.method) || SILENT_PATHS.test(request.path)) {
      return next.handle();
    }
    return next.handle().pipe(tap(() => this.live.notifyChange()));
  }
}

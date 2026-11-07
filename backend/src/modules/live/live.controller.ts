/** Canal de Server-Sent Events para actualizar las pantallas abiertas. */
import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { interval, map, merge, Observable } from 'rxjs';
import { Public } from '../../common/decorators/auth.decorators';
import { LiveService } from './live.service';

// Mantiene abierta la conexión aunque no haya cambios.
const HEARTBEAT_MS = 25000;

@ApiTags('Tiempo real')
@Controller('live')
export class LiveController {
  constructor(private readonly live: LiveService) {}

  /**
   * Es pública porque EventSource no puede enviar el token y el mensaje no trae datos:
   * solo indica que hay novedades, y cada pantalla las pide con su propia sesión.
   */
  @Public()
  @SkipThrottle()
  @Sse('events')
  @ApiOperation({ summary: 'Recibir un aviso cada vez que cambian los datos' })
  events(): Observable<MessageEvent> {
    return merge(
      this.live.changes$.pipe(map((): MessageEvent => ({ data: 'changed' }))),
      interval(HEARTBEAT_MS).pipe(map((): MessageEvent => ({ type: 'ping', data: '' }))),
    );
  }
}

/** Pruebas de LiveInterceptor: qué peticiones avisan a las pantallas conectadas. */
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { LiveInterceptor } from './live.interceptor';
import { LiveService } from './live.service';

describe('LiveInterceptor', () => {
  const run = async (method: string, path: string, handler: CallHandler = { handle: () => of({}) }) => {
    const live = new LiveService();
    const notify = jest.spyOn(live, 'notifyChange');
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ method, path }) }),
    } as unknown as ExecutionContext;
    await firstValueFrom(new LiveInterceptor(live).intercept(context, handler)).catch(() => undefined);
    return notify.mock.calls.length;
  };

  it('avisa después de una escritura exitosa', async () => {
    expect(await run('POST', '/api/v1/schedules/1/blocks')).toBe(1);
    expect(await run('DELETE', '/api/v1/ideas/1')).toBe(1);
  });

  it('no avisa en lecturas, acceso ni avisos leídos', async () => {
    expect(await run('GET', '/api/v1/schedules')).toBe(0);
    expect(await run('POST', '/api/v1/auth/login')).toBe(0);
    expect(await run('PATCH', '/api/v1/notifications/read-all')).toBe(0);
  });

  it('no avisa si la escritura falla', async () => {
    const failing: CallHandler = { handle: () => throwError(() => new Error('falló')) };
    expect(await run('POST', '/api/v1/ideas', failing)).toBe(0);
  });
});

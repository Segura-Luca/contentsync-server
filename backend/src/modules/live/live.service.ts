/** Canal interno que anuncia que algo cambió en la plataforma. */
import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

@Injectable()
export class LiveService {
  private readonly changes = new Subject<void>();

  /** Avisa a todas las pantallas conectadas. */
  notifyChange() {
    this.changes.next();
  }

  /** Flujo de avisos al que se suscribe cada conexión. */
  get changes$(): Observable<void> {
    return this.changes.asObservable();
  }
}

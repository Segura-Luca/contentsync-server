import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { AppConfigService } from '../../config/app-config.service';

export type OAuthStatePurpose = 'social-login' | 'platform-connect';

export const OAUTH_NONCE_COOKIE = 'cs_oauth_nonce';
const STATE_TTL_SECONDS = 600;

/**
 * El parámetro `state` de OAuth vuelve desde el navegador del usuario: sin firma, cualquiera podría
 * alterarlo para atribuirse otro cliente o rol. Se firma con una clave derivada exclusiva para este uso.
 */
@Injectable()
export class OAuthStateService {
  private readonly jwt = new JwtService({});

  constructor(private readonly config: AppConfigService) {}

  private secret(): string {
    return crypto
      .createHash('sha256')
      .update(`${this.config.jwtAccessSecret}|oauth-state`)
      .digest('hex');
  }

  newNonce(): string {
    return crypto.randomBytes(24).toString('base64url');
  }

  get ttlSeconds(): number {
    return STATE_TTL_SECONDS;
  }

  sign(purpose: OAuthStatePurpose, payload: Record<string, unknown>): string {
    return this.jwt.sign({ ...payload, purpose }, { secret: this.secret(), expiresIn: STATE_TTL_SECONDS });
  }

  verify<T extends object>(purpose: OAuthStatePurpose, token?: string): T {
    try {
      const decoded = this.jwt.verify<T & { purpose?: string }>(token || '', { secret: this.secret() });
      if (decoded.purpose !== purpose) throw new Error('purpose');
      return decoded;
    } catch {
      throw new UnauthorizedException('La autorización expiró o no es válida. Volvé a iniciar el proceso.');
    }
  }

  /** Lee una cookie sin depender de cookie-parser. */
  readCookie(cookieHeader: string | undefined, name: string): string | undefined {
    for (const part of (cookieHeader || '').split(';')) {
      const separator = part.indexOf('=');
      if (separator > 0 && part.slice(0, separator).trim() === name) {
        return decodeURIComponent(part.slice(separator + 1).trim());
      }
    }
    return undefined;
  }

  nonceMatches(expected: unknown, actual: string | undefined): boolean {
    if (typeof expected !== 'string' || !actual) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(actual);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}

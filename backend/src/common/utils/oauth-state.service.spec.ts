import { UnauthorizedException } from '@nestjs/common';
import { OAuthStateService } from './oauth-state.service';

describe('OAuthStateService', () => {
  const service = new OAuthStateService({ jwtAccessSecret: 'x'.repeat(48) } as any);

  it('recupera lo firmado', () => {
    const state = service.sign('platform-connect', { clientId: 'c-1', userId: 'u-1' });
    expect(service.verify<{ clientId: string }>('platform-connect', state).clientId).toBe('c-1');
  });

  it('rechaza un state alterado para apuntar a otro cliente', () => {
    const [header, body, signature] = service.sign('platform-connect', { clientId: 'c-1' }).split('.');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    const forged = Buffer.from(JSON.stringify({ ...payload, clientId: 'c-victima' })).toString('base64url');
    expect(() => service.verify('platform-connect', [header, forged, signature].join('.'))).toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza un state JSON sin firma, como los que aceptaba antes', () => {
    const legacy = Buffer.from(JSON.stringify({ clientId: 'c-1', role: 'ADMIN_GENERAL' })).toString('base64url');
    expect(() => service.verify('platform-connect', legacy)).toThrow(UnauthorizedException);
  });

  it('no acepta un state emitido para otro propósito', () => {
    const state = service.sign('social-login', { nonce: 'n' });
    expect(() => service.verify('platform-connect', state)).toThrow(UnauthorizedException);
  });

  it('lee cookies y compara el nonce', () => {
    expect(service.readCookie('a=1; cs_oauth_nonce=abc; b=2', 'cs_oauth_nonce')).toBe('abc');
    expect(service.nonceMatches('abc', 'abc')).toBe(true);
    expect(service.nonceMatches('abc', 'abd')).toBe(false);
    expect(service.nonceMatches('abc', undefined)).toBe(false);
  });
});

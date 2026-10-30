import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialProvider } from '@prisma/client';

export interface VerifiedSocialIdentity {
  providerUserId: string;
  email: string;
  fullName: string;
}

/**
 * Verifica criptográficamente ante el proveedor (Google / Meta) que el token
 * recibido es real, fue emitido para ESTA aplicación y pertenece a una cuenta
 * con correo verificado. La identidad (email, id, nombre) se toma SIEMPRE del
 * proveedor, nunca de lo que envía el cliente.
 */
@Injectable()
export class SocialTokenVerifierService {
  constructor(private readonly config: ConfigService) {}

  async verify(provider: SocialProvider, token: string): Promise<VerifiedSocialIdentity> {
    switch (provider) {
      case SocialProvider.GOOGLE:
        return this.verifyGoogle(token);
      case SocialProvider.FACEBOOK:
        return this.verifyFacebook(token);
      default:
        throw new UnauthorizedException('Este proveedor de acceso no está disponible.');
    }
  }

  private async getJson(url: string): Promise<Record<string, any>> {
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    } catch {
      throw new ServiceUnavailableException(
        'No pudimos contactar al proveedor de acceso. Intentá de nuevo en unos instantes.',
      );
    }
    const body = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) {
      throw new UnauthorizedException('No pudimos validar tu cuenta. Volvé a intentar.');
    }
    return body;
  }

  private async verifyGoogle(idToken: string): Promise<VerifiedSocialIdentity> {
    const clientId = this.config.get<string>('GOOGLE_AUTH_CLIENT_ID');
    if (!clientId) {
      throw new ServiceUnavailableException('El acceso con Google no está configurado.');
    }
    const info = await this.getJson(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    const emailVerified = info.email_verified === true || info.email_verified === 'true';
    if (info.aud !== clientId || !info.sub || !info.email || !emailVerified) {
      throw new UnauthorizedException('No pudimos validar tu cuenta de Google.');
    }
    const expMs = Number(info.exp) * 1000;
    if (!Number.isFinite(expMs) || expMs < Date.now()) {
      throw new UnauthorizedException('La sesión de Google expiró. Volvé a intentar.');
    }
    return {
      providerUserId: String(info.sub),
      email: String(info.email),
      fullName: String(info.name || String(info.email).split('@')[0]),
    };
  }

  private async verifyFacebook(accessToken: string): Promise<VerifiedSocialIdentity> {
    const appId = this.config.get<string>('FACEBOOK_AUTH_APP_ID');
    const appSecret = this.config.get<string>('FACEBOOK_AUTH_APP_SECRET');
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException('El acceso con Facebook no está configurado.');
    }
    const debug = await this.getJson(
      `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}` +
        `&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`,
    );
    const data = debug.data || {};
    if (!data.is_valid || String(data.app_id) !== String(appId) || !data.user_id) {
      throw new UnauthorizedException('No pudimos validar tu cuenta de Facebook.');
    }
    const me = await this.getJson(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!me.email) {
      throw new UnauthorizedException(
        'Tu cuenta de Facebook no comparte un correo electrónico. Usá otra forma de acceso.',
      );
    }
    return {
      providerUserId: String(data.user_id),
      email: String(me.email),
      fullName: String(me.name || String(me.email).split('@')[0]),
    };
  }
}

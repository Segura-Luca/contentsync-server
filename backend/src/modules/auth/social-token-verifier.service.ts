import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { SocialProvider } from '@prisma/client';

export interface VerifiedSocialIdentity {
  providerUserId: string;
  email: string;
  fullName: string;
  /** El proveedor garantiza que esta persona controla el correo. Sin esto no se vincula a cuentas existentes. */
  emailVerified: boolean;
}

/**
 * Verifica criptográficamente ante el proveedor (Google / Meta / GitHub) que el token
 * o código OAuth recibido es real y fue emitido para esta aplicación.
 */
@Injectable()
export class SocialTokenVerifierService {
  constructor(private readonly config: AppConfigService) {}

  private graphVersion(): string {
    return this.config.metaGraphVersion;
  }

  async verify(provider: SocialProvider, token: string): Promise<VerifiedSocialIdentity> {
    switch (provider) {
      case SocialProvider.GOOGLE:
        return this.verifyGoogle(token);
      case SocialProvider.FACEBOOK:
        return this.verifyFacebook(token);
      case SocialProvider.GITHUB:
        return this.verifyGithub(token);
      default:
        throw new UnauthorizedException('Este proveedor de acceso no está disponible.');
    }
  }

  private async getJson(url: string, headers?: Record<string, string>): Promise<Record<string, any>> {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: headers || {},
        signal: AbortSignal.timeout(10000),
      });
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
    const clientId = this.config.get('GOOGLE_AUTH_CLIENT_ID');
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
      emailVerified: true,
    };
  }

  async verifyFacebook(accessToken: string): Promise<VerifiedSocialIdentity> {
    const appId = this.config.get('FACEBOOK_AUTH_APP_ID');
    const appSecret = this.config.get('FACEBOOK_AUTH_APP_SECRET');
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
      `https://graph.facebook.com/${this.graphVersion()}/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`,
    );
    const resolvedEmail = me.email
      ? String(me.email).trim().toLowerCase()
      : `fb_${String(data.user_id)}@facebook.contentsync.io`;
    return {
      providerUserId: String(data.user_id),
      email: resolvedEmail,
      fullName: String(me.name || resolvedEmail.split('@')[0]),
      // Facebook no informa si el correo fue verificado.
      emailVerified: false,
    };
  }

  async verifyGithub(accessToken: string): Promise<VerifiedSocialIdentity> {
    const ghHeaders = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ContentSync-App',
    };
    const user = await this.getJson('https://api.github.com/user', ghHeaders);
    if (!user.id) {
      throw new UnauthorizedException('No pudimos validar tu cuenta de GitHub.');
    }

    // Solo se aceptan correos que GitHub confirma como verificados: el campo público `email` y el
    // listado completo pueden contener direcciones ajenas que alguien agregó sin comprobarlas.
    let email = '';
    let emailVerified = false;
    try {
      const res = await fetch('https://api.github.com/user/emails', {
        headers: ghHeaders,
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const emails = (await res.json()) as Array<{ email: string; primary?: boolean; verified?: boolean }>;
        if (Array.isArray(emails)) {
          const primary = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified);
          if (primary?.email) {
            email = String(primary.email).trim().toLowerCase();
            emailVerified = true;
          }
        }
      }
    } catch {
      // Sin acceso al listado se usa la dirección noreply de abajo, que nunca se vincula a otra cuenta.
    }

    if (!email) {
      const login = String(user.login || user.id);
      email = `${login}@users.noreply.github.com`.toLowerCase();
    }

    return {
      providerUserId: String(user.id),
      email,
      fullName: String(user.name || user.login || email.split('@')[0]),
      emailVerified,
    };
  }

  async exchangeFacebookCode(code: string, redirectUri: string): Promise<VerifiedSocialIdentity> {
    const appId = this.config.get('FACEBOOK_AUTH_APP_ID');
    const appSecret = this.config.get('FACEBOOK_AUTH_APP_SECRET');
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException('El acceso con Facebook no está configurado.');
    }
    const tokenData = await this.getJson(
      `https://graph.facebook.com/${this.graphVersion()}/oauth/access_token` +
        `?client_id=${encodeURIComponent(appId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&client_secret=${encodeURIComponent(appSecret)}` +
        `&code=${encodeURIComponent(code)}`,
    );
    if (!tokenData.access_token) {
      throw new UnauthorizedException('No se pudo obtener el token de Facebook.');
    }
    return this.verifyFacebook(String(tokenData.access_token));
  }

  async exchangeGithubCode(code: string, redirectUri: string): Promise<VerifiedSocialIdentity> {
    const clientId = this.config.get('GITHUB_AUTH_CLIENT_ID');
    const clientSecret = this.config.get('GITHUB_AUTH_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException('El acceso con GitHub no está configurado.');
    }
    let res: Response;
    try {
      res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'ContentSync-App',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new ServiceUnavailableException('No pudimos conectar con GitHub.');
    }
    const tokenData = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok || !tokenData.access_token) {
      throw new UnauthorizedException('No se pudo autorizar el acceso con GitHub.');
    }
    return this.verifyGithub(String(tokenData.access_token));
  }
}

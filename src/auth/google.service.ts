import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { GoogleProfile } from './auth.service';

@Injectable()
export class GoogleService {
  newState(): string {
    return randomBytes(24).toString('hex');
  }

  buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      redirect_uri: process.env.GOOGLE_CALLBACK_URL ?? '',
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  isConfigured(): boolean {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL);
  }

  /** Intercambia el code por tokens y lee el perfil. Solo acepta correos verificados por Google. */
  async fetchProfile(code: string): Promise<GoogleProfile> {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        redirect_uri: process.env.GOOGLE_CALLBACK_URL ?? '',
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) throw new Error(`Google token endpoint ${tokenRes.status}`);
    const { access_token } = (await tokenRes.json()) as { access_token?: string };
    if (!access_token) throw new Error('Google no devolvio access_token');

    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { authorization: `Bearer ${access_token}` },
    });
    if (!infoRes.ok) throw new Error(`Google userinfo ${infoRes.status}`);
    const info = (await infoRes.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };
    if (!info.sub || !info.email || info.email_verified !== true) throw new Error('Perfil de Google no verificado');
    return { googleId: info.sub, email: info.email, name: info.name ?? info.email, picture: info.picture };
  }
}

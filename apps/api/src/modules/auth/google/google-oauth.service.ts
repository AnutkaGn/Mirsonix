import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { AppConfig } from '../../../config/app-config.module';
import { GoogleOAuthPort, type GoogleProfile } from './google-oauth.port';

@Injectable()
export class GoogleOAuthService extends GoogleOAuthPort {
  private client: OAuth2Client | null = null;

  constructor(private readonly config: AppConfig) {
    super();
  }

  isConfigured(): boolean {
    return Boolean(
      this.config.get('GOOGLE_CLIENT_ID') && this.config.get('GOOGLE_CLIENT_SECRET') && this.config.get('GOOGLE_CALLBACK_URL'),
    );
  }

  getAuthUrl(state: string): string {
    return this.getClient().generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      state,
      prompt: 'select_account',
    });
  }

  async exchangeCode(code: string): Promise<GoogleProfile> {
    const client = this.getClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) throw new UnauthorizedException('Google did not return an identity token');
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: this.config.get('GOOGLE_CLIENT_ID') });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) throw new UnauthorizedException('Google profile is missing an email');
    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: payload.email_verified === true,
      name: payload.name ?? null,
    };
  }

  private getClient(): OAuth2Client {
    if (!this.isConfigured()) throw new ServiceUnavailableException('Google sign-in is not configured');
    this.client ??= new OAuth2Client({
      clientId: this.config.get('GOOGLE_CLIENT_ID'),
      clientSecret: this.config.get('GOOGLE_CLIENT_SECRET'),
      redirectUri: this.config.get('GOOGLE_CALLBACK_URL'),
    });
    return this.client;
  }
}

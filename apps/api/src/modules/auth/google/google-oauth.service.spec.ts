import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../../config/app-config.module';
import { GoogleOAuthService } from './google-oauth.service';

const client = vi.hoisted(() => ({
  generateAuthUrl: vi.fn(),
  getToken: vi.fn(),
  verifyIdToken: vi.fn(),
}));
vi.mock('google-auth-library', () => ({
  // A class, not an arrow function: the service calls `new OAuth2Client(...)`.
  OAuth2Client: class {
    constructor() {
      return client;
    }
  },
}));

const configured = {
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  GOOGLE_CALLBACK_URL: 'http://localhost:4000/auth/google/callback',
};

const makeService = (values: Record<string, string | undefined> = configured) =>
  new GoogleOAuthService({ get: (key: string) => values[key] } as unknown as AppConfig);

const ticketFor = (payload: Record<string, unknown> | undefined) => ({ getPayload: () => payload });

describe('GoogleOAuthService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('isConfigured', () => {
    it('is true only when id, secret and callback are all set', () => {
      expect(makeService().isConfigured()).toBe(true);
      expect(makeService({ ...configured, GOOGLE_CLIENT_SECRET: undefined }).isConfigured()).toBe(false);
      expect(makeService({}).isConfigured()).toBe(false);
    });
  });

  describe('getAuthUrl', () => {
    it('passes the CSRF state and the identity scopes to Google', () => {
      client.generateAuthUrl.mockReturnValue('https://accounts.example/auth');

      expect(makeService().getAuthUrl('state-123')).toBe('https://accounts.example/auth');
      expect(client.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'state-123', scope: ['openid', 'email', 'profile'] }),
      );
    });

    it('is unavailable when Google is not configured', () => {
      expect(() => makeService({}).getAuthUrl('s')).toThrow(ServiceUnavailableException);
    });
  });

  describe('exchangeCode', () => {
    it('maps a verified identity token to a profile with a lower-cased email', async () => {
      client.getToken.mockResolvedValue({ tokens: { id_token: 'jwt' } });
      client.verifyIdToken.mockResolvedValue(
        ticketFor({ sub: 'g-1', email: 'Gina@Example.COM', email_verified: true, name: 'Gina' }),
      );

      await expect(makeService().exchangeCode('code')).resolves.toEqual({
        sub: 'g-1',
        email: 'gina@example.com',
        emailVerified: true,
        name: 'Gina',
      });
      expect(client.verifyIdToken).toHaveBeenCalledWith({ idToken: 'jwt', audience: 'client-id' });
    });

    it('treats a missing email_verified claim as unverified', async () => {
      client.getToken.mockResolvedValue({ tokens: { id_token: 'jwt' } });
      client.verifyIdToken.mockResolvedValue(ticketFor({ sub: 'g-2', email: 'a@b.dev' }));

      await expect(makeService().exchangeCode('code')).resolves.toMatchObject({ emailVerified: false, name: null });
    });

    it('rejects a token response without an id_token', async () => {
      client.getToken.mockResolvedValue({ tokens: {} });

      await expect(makeService().exchangeCode('code')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(client.verifyIdToken).not.toHaveBeenCalled();
    });

    it.each([
      ['no payload', undefined],
      ['no subject', { email: 'a@b.dev' }],
      ['no email', { sub: 'g-3' }],
    ])('rejects an identity token with %s', async (_label, payload) => {
      client.getToken.mockResolvedValue({ tokens: { id_token: 'jwt' } });
      client.verifyIdToken.mockResolvedValue(ticketFor(payload));

      await expect(makeService().exchangeCode('code')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('is unavailable when Google is not configured', async () => {
      await expect(makeService({}).exchangeCode('code')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});

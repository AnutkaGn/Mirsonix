export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

/** Abstraction over Google's OAuth so the auth flow can be tested without the network. */
export abstract class GoogleOAuthPort {
  abstract isConfigured(): boolean;
  abstract getAuthUrl(state: string): string;
  abstract exchangeCode(code: string): Promise<GoogleProfile>;
}

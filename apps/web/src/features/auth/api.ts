import { authSessionSchema, type AuthSession, type LoginInput, type RegisterInput } from '@mirsonix/shared';
import { apiRequest } from '@/lib/api-client';
import { env } from '@/lib/env';
import { useAuthStore } from '@/stores/auth.store';

export const authApi = {
  async login(input: LoginInput): Promise<AuthSession> {
    const session = await apiRequest('/auth/login', { method: 'POST', body: input, schema: authSessionSchema, anonymous: true });
    useAuthStore.getState().setSession(session);
    return session;
  },
  async register(input: RegisterInput): Promise<AuthSession> {
    const session = await apiRequest('/auth/register', { method: 'POST', body: input, schema: authSessionSchema, anonymous: true });
    useAuthStore.getState().setSession(session);
    return session;
  },
  async logout(): Promise<void> {
    try {
      await apiRequest('/auth/logout', { method: 'POST', anonymous: true });
    } finally {
      useAuthStore.getState().clear();
    }
  },
  googleUrl: `${env.VITE_API_URL}/auth/google`,
};

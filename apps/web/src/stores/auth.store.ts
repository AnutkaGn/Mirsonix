import type { AuthSession, AuthUser } from '@mirsonix/shared';
import { create } from 'zustand';

/** `unknown` until the first refresh attempt finishes, so routes can wait instead of flashing the login page. */
type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  /** Memory only, never persisted: the refresh cookie is what survives a reload. */
  accessToken: string | null;
  setSession: (session: AuthSession) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  user: null,
  accessToken: null,
  setSession: ({ user, accessToken }) => set({ status: 'authenticated', user, accessToken }),
  clear: () => set({ status: 'anonymous', user: null, accessToken: null }),
}));

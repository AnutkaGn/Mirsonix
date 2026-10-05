import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from './auth.store';

const session = {
  accessToken: 'token',
  expiresIn: 900,
  user: { id: '00000000-0000-4000-8000-000000000001', email: 'a@b.dev', role: 'USER' as const, displayName: null, locale: 'en' },
};

describe('auth store', () => {
  beforeEach(() => useAuthStore.setState({ status: 'unknown', user: null, accessToken: null }));

  it('starts unknown so routes wait instead of flashing the login page', () => {
    expect(useAuthStore.getState().status).toBe('unknown');
  });

  it('becomes authenticated with the user and token after setSession', () => {
    useAuthStore.getState().setSession(session);

    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', accessToken: 'token', user: session.user });
  });

  it('forgets the user and token after clear', () => {
    useAuthStore.getState().setSession(session);
    useAuthStore.getState().clear();

    expect(useAuthStore.getState()).toMatchObject({ status: 'anonymous', accessToken: null, user: null });
  });
});

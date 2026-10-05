import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth.store';
import { apiRequest } from './api-client';

const session = {
  accessToken: 'new-token',
  expiresIn: 900,
  user: { id: '00000000-0000-4000-8000-000000000001', email: 'a@b.dev', role: 'USER', displayName: null, locale: 'en' },
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('apiRequest', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    useAuthStore.setState({ status: 'authenticated', user: null, accessToken: 'old-token' });
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { statusCode: 401, error: 'Unauthorized', message: 'expired' }))
      .mockResolvedValueOnce(json(200, session)) // /auth/refresh
      .mockResolvedValueOnce(json(200, { ok: true }));

    const result = await apiRequest('/things', { schema: z.object({ ok: z.boolean() }) });

    expect(result).toEqual({ ok: true });
    expect(fetchMock.mock.calls[2]![1].headers.Authorization).toBe('Bearer new-token');
    expect(useAuthStore.getState().accessToken).toBe('new-token');
  });

  it('shares a single refresh between concurrent 401s', async () => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return json(200, session);
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer new-token' ? json(200, { ok: true }) : json(401, { statusCode: 401, error: 'x', message: 'x' });
    });

    await Promise.all([apiRequest('/a'), apiRequest('/b'), apiRequest('/c')]);

    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('logs the user out when the refresh itself fails', async () => {
    fetchMock.mockImplementation(async () => json(401, { statusCode: 401, error: 'x', message: 'x' }));

    await expect(apiRequest('/things')).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState()).toMatchObject({ status: 'anonymous', accessToken: null });
  });

  it('does not try to refresh for anonymous endpoints', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { statusCode: 401, error: 'x', message: 'Invalid email or password' }));

    await expect(apiRequest('/auth/login', { method: 'POST', body: {}, anonymous: true })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

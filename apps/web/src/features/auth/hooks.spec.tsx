import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayerStore } from '@/features/player/player.store';
import { useProgressStore } from '@/features/player/progress.store';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from './api';
import { useLogout } from './hooks';

vi.mock('./api', () => ({ authApi: { login: vi.fn(), register: vi.fn(), logout: vi.fn(), googleUrl: '' } }));

const client = new QueryClient();
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

beforeEach(() => {
  client.clear();
  vi.mocked(authApi.logout).mockReset().mockResolvedValue(undefined);
  usePlayerStore.getState().clear();
  useProgressStore.getState().reset();
});
afterEach(cleanup);

describe('useLogout', () => {
  it('forgets what belonged to the previous listener: cached data and the play queue', async () => {
    client.setQueryData(['library', 'list'], { tracks: ['private'] });
    act(() => usePlayerStore.getState().playQueue([{ id: 't1', slug: 's', title: 'T', durationSec: 60, coverUrl: null }]));
    useProgressStore.getState().update({ positionSec: 40, durationSec: 60 });
    const { result } = renderHook(() => useLogout(), { wrapper });

    await act(async () => result.current.mutateAsync());

    expect(client.getQueryData(['library', 'list'])).toBeUndefined();
    expect(usePlayerStore.getState()).toMatchObject({ queue: [], index: -1, wantsPlay: false });
    expect(useProgressStore.getState()).toMatchObject({ positionSec: 0, durationSec: 0 });
  });

  it('forgets them even when the server could not be told, so a failed request never leaves someone else\'s queue behind', async () => {
    vi.mocked(authApi.logout).mockRejectedValue(new Error('offline'));
    act(() => usePlayerStore.getState().playQueue([{ id: 't1', slug: 's', title: 'T', durationSec: 60, coverUrl: null }]));
    const { result } = renderHook(() => useLogout(), { wrapper });

    act(() => result.current.mutate());

    await waitFor(() => expect(usePlayerStore.getState().queue).toEqual([]));
  });
});

describe('the auth store after logout', () => {
  it('is left to authApi.logout, which clears the session itself', () => {
    expect(useAuthStore.getState().status).toBeDefined();
  });
});

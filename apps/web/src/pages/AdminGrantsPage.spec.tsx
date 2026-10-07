import type { AccessGrant } from '@mirsonix/shared';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from '@/features/admin/api';
import { page } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { AdminGrantsPage } from './AdminGrantsPage';
import type * as AdminApiModule from '@/features/admin/api';

vi.mock('@/features/admin/api', async (original) => ({
  ...(await original<typeof AdminApiModule>()),
  adminApi: {
    grants: vi.fn(),
    createGrant: vi.fn(),
    revokeGrant: vi.fn(),
    tracks: vi.fn(),
    programs: vi.fn(),
  },
}));

const grant = (overrides: Partial<AccessGrant>): AccessGrant => ({
  id: 'g1',
  userId: '11111111-1111-4111-8111-111111111111',
  userEmail: 'friend@example.com',
  trackId: '22222222-2222-4222-8222-222222222222',
  programId: null,
  source: 'ADMIN',
  expiresAt: null,
  revokedAt: null,
  note: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  vi.mocked(adminApi.tracks)
    .mockReset()
    .mockResolvedValue(page([]) as never);
  vi.mocked(adminApi.programs)
    .mockReset()
    .mockResolvedValue(page([]) as never);
  vi.mocked(adminApi.revokeGrant).mockReset();
  vi.mocked(adminApi.grants)
    .mockReset()
    .mockResolvedValue(
      page([
        grant({ id: 'g1' }),
        grant({ id: 'g2', userEmail: 'old@example.com', revokedAt: '2026-10-02T00:00:00.000Z' }),
        grant({ id: 'g3', userEmail: 'late@example.com', expiresAt: '2020-01-01T00:00:00.000Z' }),
      ]) as never,
    );
});
afterEach(cleanup);

describe('AdminGrantsPage', () => {
  it('shows each grant with its state, and lets only a working one be revoked', async () => {
    renderWithProviders(<AdminGrantsPage />);

    await screen.findByText('friend@example.com');
    expect(screen.getAllByText('Active')).toHaveLength(1);
    expect(screen.getByText('Revoked')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Revoke access for/ })).toHaveLength(1);
  });

  it('revokes the chosen grant', async () => {
    vi.mocked(adminApi.revokeGrant).mockResolvedValue(
      grant({ revokedAt: '2026-10-06T00:00:00.000Z' }),
    );
    renderWithProviders(<AdminGrantsPage />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Revoke access for friend@example.com' }),
    );

    await waitFor(() => expect(vi.mocked(adminApi.revokeGrant).mock.calls[0]?.[0]).toBe('g1'));
  });

  it('says so when nobody has been given access by hand', async () => {
    vi.mocked(adminApi.grants).mockResolvedValue(page([]) as never);
    renderWithProviders(<AdminGrantsPage />);

    expect(await screen.findByText('No access has been granted by hand yet.')).toBeInTheDocument();
  });
});

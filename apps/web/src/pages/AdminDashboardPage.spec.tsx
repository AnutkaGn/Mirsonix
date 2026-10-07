import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as AdminApiModule from '@/features/admin/api';
import { adminApi } from '@/features/admin/api';
import { renderWithProviders } from '@/test/render';
import { AdminDashboardPage } from './AdminDashboardPage';

vi.mock('@/features/admin/api', async (original) => ({
  ...(await original<typeof AdminApiModule>()),
  adminApi: { summary: vi.fn(), revenue: vi.fn(), top: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(adminApi.summary)
    .mockReset()
    .mockResolvedValue({
      periodDays: 30,
      currency: 'usd',
      activeSubscriptions: { total: 0, tracks: 0, programs: 0 },
      revenue: { grossMinor: 0, refundedMinor: 0, netMinor: 0 },
      newSubscriptions: 0,
      listens: 0,
    });
  vi.mocked(adminApi.revenue).mockReset().mockResolvedValue({ items: [] });
  vi.mocked(adminApi.top)
    .mockReset()
    .mockResolvedValue({
      sales: { tracks: [], programs: [] },
      listens: { tracks: [], programs: [] },
    });
});
afterEach(cleanup);

describe('AdminDashboardPage', () => {
  it('starts with the last 30 days', async () => {
    renderWithProviders(<AdminDashboardPage />);

    await waitFor(() =>
      expect(vi.mocked(adminApi.summary).mock.calls[0]?.[0]).toEqual({ days: 30 }),
    );
    expect(screen.getByLabelText('Period')).toHaveValue('30');
  });

  it('reloads the numbers for another period', async () => {
    renderWithProviders(<AdminDashboardPage />);
    await screen.findByText('Active subscriptions');

    fireEvent.change(screen.getByLabelText('Period'), { target: { value: '7' } });

    await waitFor(() =>
      expect(vi.mocked(adminApi.summary).mock.calls.at(-1)?.[0]).toEqual({ days: 7 }),
    );
    expect(vi.mocked(adminApi.top).mock.calls.at(-1)?.[0]).toEqual({ days: 7, limit: 5 });
  });
});

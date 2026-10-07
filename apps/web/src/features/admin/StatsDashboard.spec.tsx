import type { RevenueSeries, StatsSummary, TopStats } from '@mirsonix/shared';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { adminApi } from './api';
import { StatsDashboard } from './StatsDashboard';
import type * as AdminApiModule from './api';

vi.mock('./api', async (original) => ({
  ...(await original<typeof AdminApiModule>()),
  adminApi: { summary: vi.fn(), revenue: vi.fn(), top: vi.fn() },
}));

const summary: StatsSummary = {
  periodDays: 30,
  currency: 'usd',
  activeSubscriptions: { total: 5, tracks: 3, programs: 2 },
  revenue: { grossMinor: 50_000, refundedMinor: 1_200, netMinor: 48_800 },
  newSubscriptions: 7,
  listens: 321,
};
const revenue: RevenueSeries = {
  items: [
    { date: '2026-10-05', netMinor: 0 },
    { date: '2026-10-06', netMinor: 48_800 },
  ],
};
const empty = { tracks: [], programs: [] };
const top: TopStats = {
  sales: { tracks: [{ id: 'a', title: 'Lung opening', count: 4 }], programs: [] },
  listens: empty,
};

beforeEach(() => {
  vi.mocked(adminApi.summary).mockReset().mockResolvedValue(summary);
  vi.mocked(adminApi.revenue).mockReset().mockResolvedValue(revenue);
  vi.mocked(adminApi.top).mockReset().mockResolvedValue(top);
});
afterEach(cleanup);

describe('StatsDashboard', () => {
  it('shows the headline numbers, with revenue net of refunds', async () => {
    renderWithProviders(<StatsDashboard days={30} />);

    expect(await screen.findByText('5')).toBeInTheDocument();
    expect(screen.getByText('3 tracks · 2 programs')).toBeInTheDocument();
    expect(screen.getByText('$488.00')).toBeInTheDocument();
    expect(screen.getByText('$12.00 refunded')).toBeInTheDocument();
    expect(screen.getByText('321')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('lists the top items, and says so when a list is empty', async () => {
    renderWithProviders(<StatsDashboard days={30} />);

    const sales = await screen.findByRole('region', { name: 'Top tracks by sales' });
    expect(within(sales).getByText('Lung opening')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Top programs by listens' })).getByText(
        'No data for this period.',
      ),
    ).toBeInTheDocument();
  });

  it('gives each day of revenue to screen readers', async () => {
    renderWithProviders(<StatsDashboard days={30} />);

    expect(await screen.findByText('Oct 6, 2026: $488.00')).toBeInTheDocument();
    expect(screen.getByText('Oct 5, 2026: $0.00')).toBeInTheDocument();
  });

  it('asks for the chosen period', async () => {
    renderWithProviders(<StatsDashboard days={7} />);

    await waitFor(() =>
      expect(adminApi.summary).toHaveBeenCalledWith({ days: 7 }, expect.anything()),
    );
    expect(adminApi.top).toHaveBeenCalledWith({ days: 7, limit: 5 }, expect.anything());
  });

  it('hides the refund note when nothing was refunded', async () => {
    vi.mocked(adminApi.summary).mockResolvedValue({
      ...summary,
      revenue: { grossMinor: 100, refundedMinor: 0, netMinor: 100 },
    });
    renderWithProviders(<StatsDashboard days={30} />);

    await screen.findByText('$1.00');
    expect(screen.queryByText(/refunded/)).not.toBeInTheDocument();
  });

  it('offers a retry when a request fails', async () => {
    vi.mocked(adminApi.top).mockRejectedValue(new Error('boom'));
    renderWithProviders(<StatsDashboard days={30} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load this');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

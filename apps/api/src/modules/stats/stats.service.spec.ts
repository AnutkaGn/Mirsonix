import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StatsRepository } from './stats.repository';
import { periodStart, StatsService } from './stats.service';

describe('periodStart', () => {
  it('starts at midnight UTC, so a one-day window is exactly today', () => {
    expect(periodStart(new Date('2026-10-06T15:30:00Z'), 1).toISOString()).toBe(
      '2026-10-06T00:00:00.000Z',
    );
  });

  it('counts today as the last day of the window', () => {
    expect(periodStart(new Date('2026-10-06T00:00:01Z'), 30).toISOString()).toBe(
      '2026-09-07T00:00:00.000Z',
    );
  });

  it('crosses a year boundary', () => {
    expect(periodStart(new Date('2026-01-02T12:00:00Z'), 3).toISOString()).toBe(
      '2025-12-31T00:00:00.000Z',
    );
  });
});

describe('StatsService', () => {
  const repository = {
    countActiveSubscriptions: vi.fn(),
    sumRevenue: vi.fn(),
    countNewSubscriptions: vi.fn(),
    countListens: vi.fn(),
    netRevenueByDay: vi.fn(),
    top: vi.fn(),
  };
  const service = new StatsService(repository as unknown as StatsRepository);

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-10-06T15:30:00Z') });
    vi.resetAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  it('builds the summary, with net revenue as paid minus refunded', async () => {
    repository.countActiveSubscriptions.mockResolvedValue({ tracks: 3, programs: 2 });
    repository.sumRevenue.mockResolvedValue({ grossMinor: 5000, refundedMinor: 1200 });
    repository.countNewSubscriptions.mockResolvedValue(4);
    repository.countListens.mockResolvedValue(17);

    const summary = await service.summary({ days: 7 });

    expect(summary).toEqual({
      periodDays: 7,
      currency: 'usd',
      activeSubscriptions: { total: 5, tracks: 3, programs: 2 },
      revenue: { grossMinor: 5000, refundedMinor: 1200, netMinor: 3800 },
      newSubscriptions: 4,
      listens: 17,
    });
    expect(repository.sumRevenue).toHaveBeenCalledWith(new Date('2026-09-30T00:00:00Z'));
  });

  it('asks for the revenue series over the same window', async () => {
    repository.netRevenueByDay.mockResolvedValue([{ date: '2026-10-06', netMinor: 100 }]);

    const series = await service.revenueSeries({ days: 1 });

    expect(series.items).toHaveLength(1);
    expect(repository.netRevenueByDay).toHaveBeenCalledWith(
      new Date('2026-10-06T00:00:00Z'),
      new Date('2026-10-06T15:30:00Z'),
    );
  });

  it('collects the four top lists with the limit', async () => {
    repository.top.mockImplementation(async (metric: string, kind: string) => [
      { id: `${metric}-${kind}`, title: 'x', count: 1 },
    ]);

    const top = await service.top({ days: 30, limit: 3 });

    expect(top.sales.tracks[0]?.id).toBe('sales-tracks');
    expect(top.sales.programs[0]?.id).toBe('sales-programs');
    expect(top.listens.tracks[0]?.id).toBe('listens-tracks');
    expect(top.listens.programs[0]?.id).toBe('listens-programs');
    expect(repository.top).toHaveBeenCalledWith(
      'sales',
      'tracks',
      new Date('2026-09-07T00:00:00Z'),
      3,
    );
  });
});

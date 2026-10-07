import { Injectable } from '@nestjs/common';
import {
  CURRENCY,
  type RevenueSeries,
  type StatsQuery,
  type StatsSummary,
  type TopStats,
  type TopStatsQuery,
} from '@mirsonix/shared';
import { StatsRepository } from './stats.repository';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The window covers `days` UTC calendar days ending today, so it lines up with the daily revenue series. */
export function periodStart(now: Date, days: number): Date {
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(startOfToday - (days - 1) * DAY_MS);
}

@Injectable()
export class StatsService {
  constructor(private readonly repository: StatsRepository) {}

  async summary({ days }: StatsQuery): Promise<StatsSummary> {
    const now = new Date();
    const since = periodStart(now, days);
    const [active, revenue, newSubscriptions, listens] = await Promise.all([
      this.repository.countActiveSubscriptions(now),
      this.repository.sumRevenue(since),
      this.repository.countNewSubscriptions(since),
      this.repository.countListens(since),
    ]);
    return {
      periodDays: days,
      currency: CURRENCY,
      activeSubscriptions: { total: active.tracks + active.programs, ...active },
      revenue: { ...revenue, netMinor: revenue.grossMinor - revenue.refundedMinor },
      newSubscriptions,
      listens,
    };
  }

  async revenueSeries({ days }: StatsQuery): Promise<RevenueSeries> {
    const now = new Date();
    return { items: await this.repository.netRevenueByDay(periodStart(now, days), now) };
  }

  async top({ days, limit }: TopStatsQuery): Promise<TopStats> {
    const since = periodStart(new Date(), days);
    const [salesTracks, salesPrograms, listenTracks, listenPrograms] = await Promise.all([
      this.repository.top('sales', 'tracks', since, limit),
      this.repository.top('sales', 'programs', since, limit),
      this.repository.top('listens', 'tracks', since, limit),
      this.repository.top('listens', 'programs', since, limit),
    ]);
    return {
      sales: { tracks: salesTracks, programs: salesPrograms },
      listens: { tracks: listenTracks, programs: listenPrograms },
    };
  }
}

import { Injectable } from '@nestjs/common';
import {
  ACCESS_GRANTING_STATUSES,
  ACCESS_PERIOD_GRACE_SECONDS,
  type RevenuePoint,
} from '@mirsonix/shared';
import { DataSource } from 'typeorm';

export type TopKind = 'tracks' | 'programs';
export interface TopRow {
  id: string;
  title: string;
  count: number;
}

/** A sale is a subscription that got past checkout; abandoned ones never reached payment. */
const SALE_STATUS_FILTER = `s.status NOT IN ('INCOMPLETE', 'INCOMPLETE_EXPIRED')`;

/** Column and table names come from this closed map, never from input. */
const TOP_SOURCES = {
  sales: {
    tracks: `FROM subscriptions s JOIN tracks x ON x.id = s.track_id WHERE s.created_at >= $1 AND ${SALE_STATUS_FILTER}`,
    programs: `FROM subscriptions s JOIN programs x ON x.id = s.program_id WHERE s.created_at >= $1 AND ${SALE_STATUS_FILTER}`,
  },
  listens: {
    tracks: `FROM playback_sessions ps JOIN tracks x ON x.id = ps.track_id WHERE ps.started_at >= $1 AND ps.counted_as_listen`,
    programs: `FROM playback_sessions ps JOIN programs x ON x.id = ps.program_id WHERE ps.started_at >= $1 AND ps.counted_as_listen`,
  },
} as const;

/** Read-only aggregates. All sums happen in SQL, and every query is bounded by `since`. */
@Injectable()
export class StatsRepository {
  constructor(private readonly dataSource: DataSource) {}

  /** Same validity rule as access: a granting status whose paid period is not long over. */
  async countActiveSubscriptions(now: Date): Promise<{ tracks: number; programs: number }> {
    const cutoff = new Date(now.getTime() - ACCESS_PERIOD_GRACE_SECONDS * 1000);
    const [row] = await this.dataSource.query(
      `SELECT count(*) FILTER (WHERE track_id IS NOT NULL)::int AS tracks,
              count(*) FILTER (WHERE program_id IS NOT NULL)::int AS programs
         FROM subscriptions
        WHERE status = ANY($1::subscription_status[]) AND (current_period_end IS NULL OR current_period_end > $2)`,
      [[...ACCESS_GRANTING_STATUSES], cutoff],
    );
    return row;
  }

  async sumRevenue(since: Date): Promise<{ grossMinor: number; refundedMinor: number }> {
    const [row] = await this.dataSource.query(
      `SELECT coalesce(sum(amount_paid_minor), 0)::float8 AS gross, coalesce(sum(amount_refunded_minor), 0)::float8 AS refunded
         FROM invoices WHERE status = 'PAID' AND paid_at >= $1`,
      [since],
    );
    return { grossMinor: row.gross, refundedMinor: row.refunded };
  }

  async countNewSubscriptions(since: Date): Promise<number> {
    const [row] = await this.dataSource.query(
      `SELECT count(*)::int AS count FROM subscriptions s WHERE s.created_at >= $1 AND ${SALE_STATUS_FILTER}`,
      [since],
    );
    return row.count;
  }

  async countListens(since: Date): Promise<number> {
    const [row] = await this.dataSource.query(
      `SELECT count(*)::int AS count FROM playback_sessions WHERE counted_as_listen AND started_at >= $1`,
      [since],
    );
    return row.count;
  }

  /** One row per UTC day from `since` to `until`, empty days included, so a chart needs no gap filling. */
  async netRevenueByDay(since: Date, until: Date): Promise<RevenuePoint[]> {
    const rows: { date: string; net: number }[] = await this.dataSource.query(
      `SELECT to_char(d, 'YYYY-MM-DD') AS date,
              coalesce(sum(i.amount_paid_minor - i.amount_refunded_minor), 0)::float8 AS net
         FROM generate_series(($1::timestamptz AT TIME ZONE 'UTC')::date, ($2::timestamptz AT TIME ZONE 'UTC')::date, interval '1 day') AS d
         LEFT JOIN invoices i
           ON i.status = 'PAID' AND i.paid_at >= $1 AND (i.paid_at AT TIME ZONE 'UTC')::date = d::date
        GROUP BY d ORDER BY d`,
      [since, until],
    );
    return rows.map((row) => ({ date: row.date, netMinor: row.net }));
  }

  top(
    metric: keyof typeof TOP_SOURCES,
    kind: TopKind,
    since: Date,
    limit: number,
  ): Promise<TopRow[]> {
    return this.dataSource.query(
      `SELECT x.id, x.title, count(*)::int AS count ${TOP_SOURCES[metric][kind]} GROUP BY x.id, x.title ORDER BY count DESC, x.title ASC LIMIT $2`,
      [since, limit],
    );
  }
}

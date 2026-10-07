import { z } from 'zod';
import { uuidSchema } from './common';

export const STATS_PERIOD_DAYS = { default: 30, max: 365 } as const;
export const STATS_TOP_LIMIT = { default: 5, max: 20 } as const;

export const statsQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .min(1)
    .max(STATS_PERIOD_DAYS.max)
    .default(STATS_PERIOD_DAYS.default),
});
export type StatsQuery = z.infer<typeof statsQuerySchema>;

export const topStatsQuerySchema = statsQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(STATS_TOP_LIMIT.max).default(STATS_TOP_LIMIT.default),
});
export type TopStatsQuery = z.infer<typeof topStatsQuerySchema>;

export const statsSummarySchema = z.object({
  periodDays: z.number().int(),
  currency: z.string(),
  /** Subscriptions that grant access right now, split by what they target. */
  activeSubscriptions: z.object({
    total: z.number().int(),
    tracks: z.number().int(),
    programs: z.number().int(),
  }),
  /** Paid invoices in the period, in minor units. Net is paid minus refunded. */
  revenue: z.object({
    grossMinor: z.number().int(),
    refundedMinor: z.number().int(),
    netMinor: z.number().int(),
  }),
  newSubscriptions: z.number().int(),
  listens: z.number().int(),
});
export type StatsSummary = z.infer<typeof statsSummarySchema>;

export const revenuePointSchema = z.object({
  /** UTC calendar day, `YYYY-MM-DD`. Days without revenue are present with 0. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  netMinor: z.number().int(),
});
export const revenueSeriesSchema = z.object({ items: z.array(revenuePointSchema) });
export type RevenueSeries = z.infer<typeof revenueSeriesSchema>;

export const topItemSchema = z.object({
  id: uuidSchema,
  title: z.string(),
  count: z.number().int(),
});
export type TopItem = z.infer<typeof topItemSchema>;

const topListSchema = z.object({
  tracks: z.array(topItemSchema),
  programs: z.array(topItemSchema),
});
/** `sales` counts subscriptions started in the period; `listens` counts sessions that reached the listen threshold. */
export const topStatsSchema = z.object({ sales: topListSchema, listens: topListSchema });
export type TopStats = z.infer<typeof topStatsSchema>;
export type RevenuePoint = z.infer<typeof revenuePointSchema>;

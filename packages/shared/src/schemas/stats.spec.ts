import { describe, expect, it } from 'vitest';
import { STATS_PERIOD_DAYS, STATS_TOP_LIMIT, statsQuerySchema, topStatsQuerySchema } from './stats';

describe('statsQuerySchema', () => {
  it('defaults to the standard period', () => {
    expect(statsQuerySchema.parse({}).days).toBe(STATS_PERIOD_DAYS.default);
  });

  it('coerces a query-string number and accepts both bounds', () => {
    expect(statsQuerySchema.parse({ days: '1' }).days).toBe(1);
    expect(statsQuerySchema.parse({ days: String(STATS_PERIOD_DAYS.max) }).days).toBe(
      STATS_PERIOD_DAYS.max,
    );
  });

  it.each([['0'], [String(STATS_PERIOD_DAYS.max + 1)], ['1.5'], ['abc']])(
    'rejects days=%s',
    (days) => {
      expect(statsQuerySchema.safeParse({ days }).success).toBe(false);
    },
  );
});

describe('topStatsQuerySchema', () => {
  it('defaults the limit and keeps the period rules', () => {
    expect(topStatsQuerySchema.parse({})).toEqual({
      days: STATS_PERIOD_DAYS.default,
      limit: STATS_TOP_LIMIT.default,
    });
  });

  it.each([['0'], [String(STATS_TOP_LIMIT.max + 1)]])('rejects limit=%s', (limit) => {
    expect(topStatsQuerySchema.safeParse({ limit }).success).toBe(false);
  });

  it('accepts the maximum limit', () => {
    expect(topStatsQuerySchema.parse({ limit: String(STATS_TOP_LIMIT.max) }).limit).toBe(
      STATS_TOP_LIMIT.max,
    );
  });
});

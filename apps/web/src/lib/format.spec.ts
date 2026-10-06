import { describe, expect, it } from 'vitest';
import { formatDate, formatDuration, formatPrice, formatTotalDuration } from './format';

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [7, '0:07'],
    [61, '1:01'],
    [599, '9:59'],
    [3599, '59:59'],
    [3600, '1:00:00'],
    [3725, '1:02:05'],
  ])('shows %i seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it('drops fractions instead of rounding up to a second the listener has not reached', () => {
    expect(formatDuration(59.99)).toBe('0:59');
  });

  it('shows nonsense (negative, NaN, infinite) as zero rather than breaking the player', () => {
    expect(formatDuration(-5)).toBe('0:00');
    expect(formatDuration(Number.NaN)).toBe('0:00');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});

describe('formatTotalDuration', () => {
  it.each([
    [1, '1m'],
    [600, '10m'],
    [601, '11m'], // rounds up: a program never claims to be shorter than it is
    [3600, '1h'],
    [3660, '1h 1m'],
    [5400, '1h 30m'],
  ])('shows %i seconds as %s', (seconds, expected) => {
    expect(formatTotalDuration(seconds)).toBe(expected);
  });

  it('never shows less than a minute', () => {
    expect(formatTotalDuration(0)).toBe('1m');
  });
});

describe('formatPrice', () => {
  it('formats minor units as dollars', () => {
    expect(formatPrice({ amountMinor: 999, currency: 'usd' })).toBe('$9.99');
    expect(formatPrice({ amountMinor: 10_000, currency: 'usd' })).toBe('$100.00');
    expect(formatPrice({ amountMinor: 50, currency: 'USD' })).toBe('$0.50');
  });
});

describe('formatDate', () => {
  it('formats an ISO timestamp as a short date', () => {
    expect(formatDate('2026-11-03T12:00:00.000Z')).toBe('Nov 3, 2026');
  });
});

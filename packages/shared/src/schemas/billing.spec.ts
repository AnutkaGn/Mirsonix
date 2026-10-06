import { describe, expect, it } from 'vitest';
import { MAX_PRICE_MINOR, MIN_PRICE_MINOR } from '../constants';
import { checkoutRequestSchema, setPricesSchema } from './billing';

const id = '00000000-0000-4000-8000-000000000001';

describe('setPricesSchema', () => {
  it('accepts amounts inside the bounds, including the bounds themselves', () => {
    expect(setPricesSchema.safeParse({ monthlyAmountMinor: MIN_PRICE_MINOR, yearlyAmountMinor: MAX_PRICE_MINOR }).success).toBe(true);
  });

  it('rejects an amount below Stripe\'s minimum or above the cap', () => {
    expect(setPricesSchema.safeParse({ monthlyAmountMinor: MIN_PRICE_MINOR - 1, yearlyAmountMinor: null }).success).toBe(false);
    expect(setPricesSchema.safeParse({ monthlyAmountMinor: null, yearlyAmountMinor: MAX_PRICE_MINOR + 1 }).success).toBe(false);
  });

  it('rejects fractional cents, and treats null as "off sale"', () => {
    expect(setPricesSchema.safeParse({ monthlyAmountMinor: 999.5, yearlyAmountMinor: null }).success).toBe(false);
    expect(setPricesSchema.safeParse({ monthlyAmountMinor: null, yearlyAmountMinor: null }).success).toBe(true);
  });

  it('makes the caller state both intervals', () => {
    expect(setPricesSchema.safeParse({ monthlyAmountMinor: 999 }).success).toBe(false);
  });
});

describe('checkoutRequestSchema', () => {
  it('accepts a track or a program with an interval', () => {
    expect(checkoutRequestSchema.safeParse({ trackId: id, interval: 'MONTH' }).success).toBe(true);
    expect(checkoutRequestSchema.safeParse({ programId: id, interval: 'YEAR' }).success).toBe(true);
  });

  it('rejects both targets, and neither', () => {
    expect(checkoutRequestSchema.safeParse({ trackId: id, programId: id, interval: 'MONTH' }).success).toBe(false);
    expect(checkoutRequestSchema.safeParse({ interval: 'MONTH' }).success).toBe(false);
  });

  it('rejects an unknown interval and a malformed id', () => {
    expect(checkoutRequestSchema.safeParse({ trackId: id, interval: 'WEEK' }).success).toBe(false);
    expect(checkoutRequestSchema.safeParse({ trackId: 'x', interval: 'MONTH' }).success).toBe(false);
  });
});

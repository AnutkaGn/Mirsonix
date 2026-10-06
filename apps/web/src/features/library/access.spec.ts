import { describe, expect, it } from 'vitest';
import { describeAccess } from './access';

const END = '2026-12-01T00:00:00.000Z';

describe('describeAccess', () => {
  it('says a running subscription renews on its end date', () => {
    expect(describeAccess({ source: 'TRACK_SUBSCRIPTION', validUntil: END, cancelAtPeriodEnd: false })).toEqual({ key: 'renews', date: END });
    expect(describeAccess({ source: 'PROGRAM_SUBSCRIPTION', validUntil: END, cancelAtPeriodEnd: false }).key).toBe('renews');
  });

  it('says a cancelled subscription ends that day, since access runs to the end of the paid period and no further', () => {
    expect(describeAccess({ source: 'TRACK_SUBSCRIPTION', validUntil: END, cancelAtPeriodEnd: true })).toEqual({ key: 'ends', date: END });
  });

  it('does not invent a date for a subscription that has none', () => {
    expect(describeAccess({ source: 'TRACK_SUBSCRIPTION', validUntil: null, cancelAtPeriodEnd: false })).toEqual({ key: 'active', date: null });
  });

  it('describes a gift, with or without an end date', () => {
    expect(describeAccess({ source: 'GRANT', validUntil: null, cancelAtPeriodEnd: false })).toEqual({ key: 'granted', date: null });
    expect(describeAccess({ source: 'GRANT', validUntil: END, cancelAtPeriodEnd: false })).toEqual({ key: 'grantedUntil', date: END });
  });
});

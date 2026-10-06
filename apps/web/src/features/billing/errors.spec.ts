import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '@/lib/api-client';
import { billingErrorKey } from './errors';

const failure = (status: number) => new ApiRequestError(status, { statusCode: status, error: 'x', message: 'x' });

describe('billingErrorKey', () => {
  it.each([
    [409, 'alreadySubscribed'],
    [404, 'unavailable'],
    [422, 'unavailable'],
    [503, 'paymentsDown'],
    [429, 'tooMany'],
    [500, 'generic'],
    [400, 'generic'],
  ] as const)('explains a %i as %s', (status, key) => {
    expect(billingErrorKey(failure(status))).toBe(key);
  });

  it('falls back to a generic message for a failure that is not an API answer, such as being offline', () => {
    expect(billingErrorKey(new TypeError('Failed to fetch'))).toBe('generic');
    expect(billingErrorKey(undefined)).toBe('generic');
  });
});

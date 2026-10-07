import { describe, expect, it } from 'vitest';
import { grantState } from './grants';

const now = new Date('2026-10-06T12:00:00Z');

describe('grantState', () => {
  it('is active without an end date', () => {
    expect(grantState({ revokedAt: null, expiresAt: null }, now)).toBe('active');
  });

  it('is active until the expiry moment, and expired from it', () => {
    expect(grantState({ revokedAt: null, expiresAt: '2026-10-06T12:00:01Z' }, now)).toBe('active');
    expect(grantState({ revokedAt: null, expiresAt: '2026-10-06T12:00:00Z' }, now)).toBe('expired');
  });

  it('a revoked grant stays revoked even if it would also have expired', () => {
    expect(
      grantState({ revokedAt: '2026-10-01T00:00:00Z', expiresAt: '2026-09-01T00:00:00Z' }, now),
    ).toBe('revoked');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearPurchase, readPurchase, rememberPurchase, targetOf } from './pending-purchase';

afterEach(() => {
  clearPurchase();
  vi.restoreAllMocks();
});

describe('targetOf', () => {
  it('names the track or the program of a checkout request', () => {
    expect(targetOf({ trackId: 't1' })).toEqual({ kind: 'TRACK', id: 't1' });
    expect(targetOf({ programId: 'p1' })).toEqual({ kind: 'PROGRAM', id: 'p1' });
  });
});

describe('remembering a purchase', () => {
  it('keeps what was bought until it is cleared', () => {
    rememberPurchase({ kind: 'PROGRAM', id: 'p1' });
    expect(readPurchase()).toEqual({ kind: 'PROGRAM', id: 'p1' });

    clearPurchase();
    expect(readPurchase()).toBeNull();
  });

  it.each(['not json', '{"kind":"ALBUM","id":"x"}', '{"kind":"TRACK"}', '42'])('treats stored garbage (%s) as nothing', (garbage) => {
    sessionStorage.setItem('mirsonix:pending-purchase', garbage);

    expect(readPurchase()).toBeNull();
  });

  it('carries on when storage is unavailable, as in some private windows', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(() => rememberPurchase({ kind: 'TRACK', id: 't1' })).not.toThrow();
    expect(readPurchase()).toBeNull();
    expect(() => clearPurchase()).not.toThrow();
  });
});

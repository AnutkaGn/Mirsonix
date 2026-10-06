import { describe, expect, it } from 'vitest';
import { heartbeatSchema, listenThresholdSec, startSessionSchema } from './playback';

const id = '00000000-0000-4000-8000-000000000001';

describe('listenThresholdSec', () => {
  it('is 30 seconds for an ordinary track', () => {
    expect(listenThresholdSec(600)).toBe(30);
    expect(listenThresholdSec(60)).toBe(30);
  });

  it('is half the track when the track is shorter than a minute', () => {
    expect(listenThresholdSec(40)).toBe(20);
    expect(listenThresholdSec(10)).toBe(5);
  });
});

describe('startSessionSchema', () => {
  it('needs a track and treats the program as optional context', () => {
    expect(startSessionSchema.safeParse({ trackId: id }).success).toBe(true);
    expect(startSessionSchema.safeParse({ trackId: id, programId: id }).success).toBe(true);
    expect(startSessionSchema.safeParse({}).success).toBe(false);
    expect(startSessionSchema.safeParse({ trackId: 'x' }).success).toBe(false);
  });
});

describe('heartbeatSchema', () => {
  it('accepts whole, non-negative seconds', () => {
    expect(heartbeatSchema.safeParse({ listenedSec: 0, positionSec: 0 }).success).toBe(true);
    expect(heartbeatSchema.safeParse({ listenedSec: 90, positionSec: 120 }).success).toBe(true);
  });

  it.each([
    ['a negative time', { listenedSec: -1, positionSec: 0 }],
    ['a fractional time', { listenedSec: 1.5, positionSec: 0 }],
    ['more than a day', { listenedSec: 86_401, positionSec: 0 }],
    ['a missing field', { listenedSec: 5 }],
  ])('rejects %s', (_label, body) => {
    expect(heartbeatSchema.safeParse(body).success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { toBars } from './revenue-chart';

describe('toBars', () => {
  it('scales to the tallest day', () => {
    expect(
      toBars([
        { date: 'a', netMinor: 500 },
        { date: 'b', netMinor: 1000 },
      ]).map((b) => b.heightPercent),
    ).toEqual([50, 100]);
  });

  it('draws nothing when there was no revenue', () => {
    expect(toBars([{ date: 'a', netMinor: 0 }]).map((b) => b.heightPercent)).toEqual([0]);
  });

  it('keeps a tiny day visible, and a refunded-out day flat', () => {
    expect(
      toBars([
        { date: 'a', netMinor: 1 },
        { date: 'b', netMinor: 100_000 },
        { date: 'c', netMinor: -50 },
      ]).map((b) => b.heightPercent),
    ).toEqual([2, 100, 0]);
  });

  it('copes with an empty series', () => {
    expect(toBars([])).toEqual([]);
  });
});

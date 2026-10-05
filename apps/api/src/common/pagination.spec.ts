import { describe, expect, it } from 'vitest';
import { escapeLike, toOffset, toPaginationMeta } from './pagination';

describe('toPaginationMeta', () => {
  it('rounds the page count up', () => {
    expect(toPaginationMeta(1, 20, 41)).toEqual({ page: 1, limit: 20, total: 41, totalPages: 3 });
  });

  it('reports zero pages for an empty result', () => {
    expect(toPaginationMeta(1, 20, 0).totalPages).toBe(0);
  });

  it('does not add a page when the total divides evenly', () => {
    expect(toPaginationMeta(2, 10, 20).totalPages).toBe(2);
  });
});

describe('toOffset', () => {
  it('starts the first page at zero', () => {
    expect(toOffset(1, 20)).toBe(0);
    expect(toOffset(3, 20)).toBe(40);
  });
});

describe('escapeLike', () => {
  it('escapes the characters LIKE treats as wildcards', () => {
    expect(escapeLike('100%_done\\')).toBe('100\\%\\_done\\\\');
  });

  it('leaves ordinary text alone', () => {
    expect(escapeLike('deep sleep')).toBe('deep sleep');
  });
});

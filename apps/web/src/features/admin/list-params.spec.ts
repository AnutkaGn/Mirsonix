import { describe, expect, it } from 'vitest';
import { parseListParams, toListSearchParams } from './list-params';

describe('parseListParams', () => {
  it('defaults to the first page with no filters', () => {
    expect(parseListParams(new URLSearchParams())).toEqual({ page: 1, q: '', status: undefined });
  });

  it('reads valid values', () => {
    expect(parseListParams(new URLSearchParams('page=3&q=lung&status=DRAFT'))).toEqual({
      page: 3,
      q: 'lung',
      status: 'DRAFT',
    });
  });

  it.each([['0'], ['-2'], ['1.5'], ['abc']])('falls back to page 1 for page=%s', (page) => {
    expect(parseListParams(new URLSearchParams({ page })).page).toBe(1);
  });

  it('ignores an unknown status', () => {
    expect(parseListParams(new URLSearchParams('status=DELETED')).status).toBeUndefined();
  });
});

describe('toListSearchParams', () => {
  const current = { page: 4, q: 'old', status: 'DRAFT' as const };

  it('goes back to page 1 when a filter changes', () => {
    expect(toListSearchParams(current, { q: 'new' }).toString()).toBe('q=new&status=DRAFT');
  });

  it('keeps the page when the page itself changes', () => {
    expect(toListSearchParams(current, { page: 5 }).toString()).toBe('q=old&status=DRAFT&page=5');
  });

  it('leaves blank values out of the URL', () => {
    expect(toListSearchParams(current, { q: '  ', status: undefined }).toString()).toBe('');
  });
});

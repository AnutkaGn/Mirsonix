import { describe, expect, it } from 'vitest';
import { toQueryString } from './query-string';

describe('toQueryString', () => {
  it('builds a query from the values that are set', () => {
    expect(toQueryString({ page: 2, q: 'sleep' })).toBe('?page=2&q=sleep');
  });

  it('leaves out unset, null and blank values, so a URL only carries real choices', () => {
    expect(toQueryString({ q: '', wave: undefined, issue: null, page: 1 })).toBe('?page=1');
  });

  it('is empty when nothing is set', () => {
    expect(toQueryString({})).toBe('');
    expect(toQueryString({ q: '' })).toBe('');
  });

  it('keeps zero and false, which are real values', () => {
    expect(toQueryString({ page: 0, flag: false })).toBe('?page=0&flag=false');
  });

  it('encodes characters that would break the URL', () => {
    expect(toQueryString({ q: 'a&b c' })).toBe('?q=a%26b+c');
  });
});

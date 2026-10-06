import { describe, expect, it } from 'vitest';
import { hasActiveFilters, parseTab, parseTrackFilters, toSearchParams } from './filters';

const params = (query: string) => new URLSearchParams(query);

describe('parseTrackFilters', () => {
  it('reads every filter and the page from the address', () => {
    expect(parseTrackFilters(params('q=sleep&wave=BINAURAL&issue=back-pain&meridian=LU&element=METAL&page=3'))).toEqual({
      q: 'sleep',
      wave: 'BINAURAL',
      issue: 'back-pain',
      meridian: 'LU',
      element: 'METAL',
      page: 3,
    });
  });

  it('starts on page one with no filters', () => {
    expect(parseTrackFilters(params(''))).toEqual({ page: 1 });
  });

  it('drops a value that is not allowed and keeps the rest, instead of showing an error for a hand-edited link', () => {
    expect(parseTrackFilters(params('wave=SQUARE&q=sleep&page=2'))).toEqual({ q: 'sleep', page: 2 });
    expect(parseTrackFilters(params('element=AIR&issue=sleep'))).toEqual({ issue: 'sleep', page: 1 });
  });

  it.each(['page=0', 'page=-2', 'page=abc', 'page=1.5'])('falls back to page one for %s', (query) => {
    expect(parseTrackFilters(params(query)).page).toBe(1);
  });

  it('ignores parameters it does not know, such as the tab', () => {
    expect(parseTrackFilters(params('tab=programs&utm_source=x'))).toEqual({ page: 1 });
  });
});

describe('hasActiveFilters', () => {
  it('is true for any chosen filter, and false for paging alone', () => {
    expect(hasActiveFilters({ page: 4 })).toBe(false);
    expect(hasActiveFilters({ page: 1, q: 'x' })).toBe(true);
    expect(hasActiveFilters({ page: 1, wave: 'SINE' })).toBe(true);
  });
});

describe('toSearchParams', () => {
  it('is empty for the default view', () => {
    expect(toSearchParams('tracks', { page: 1 }).toString()).toBe('');
  });

  it('carries only the filters that are set, and the page from the second on', () => {
    expect(toSearchParams('tracks', { q: 'sleep', wave: 'SINE', page: 2 }).toString()).toBe('q=sleep&wave=SINE&page=2');
  });

  it('marks the programs tab, which has no filters of its own', () => {
    expect(toSearchParams('programs', { q: 'sleep', page: 3 }).toString()).toBe('tab=programs&page=3');
  });

  it('round-trips with parsing', () => {
    const filters = { q: 'a b', meridian: 'GB', page: 2 };

    expect(parseTrackFilters(toSearchParams('tracks', filters))).toEqual(filters);
  });
});

describe('parseTab', () => {
  it('is tracks unless programs is asked for', () => {
    expect(parseTab('programs')).toBe('programs');
    expect(parseTab('tracks')).toBe('tracks');
    expect(parseTab(null)).toBe('tracks');
    expect(parseTab('whatever')).toBe('tracks');
  });
});

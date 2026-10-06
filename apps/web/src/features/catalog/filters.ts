import { trackListQuerySchema, type TrackListQuery } from '@mirsonix/shared';

export const CATALOG_PAGE_SIZE = 12;

export type CatalogTab = 'tracks' | 'programs';
export const parseTab = (value: string | null): CatalogTab => (value === 'programs' ? 'programs' : 'tracks');

/** What the URL chose. Anything invalid is dropped, so a hand-edited link shows the default view, not an error. */
export type TrackFilters = Omit<TrackListQuery, 'limit'>;

const FILTER_KEYS = ['q', 'wave', 'issue', 'meridian', 'element'] as const;

export function parseTrackFilters(params: URLSearchParams): TrackFilters {
  const parsed = trackListQuerySchema.safeParse(Object.fromEntries(params));
  if (parsed.success) {
    const { limit: _limit, ...filters } = parsed.data;
    return filters;
  }
  // One bad value should not discard the good ones: keep each field that is valid on its own.
  const filters: TrackFilters = { page: 1 };
  for (const key of [...FILTER_KEYS, 'page'] as const) {
    const value = params.get(key);
    if (value === null) continue;
    const single = trackListQuerySchema.safeParse({ [key]: value });
    if (single.success && single.data[key] !== undefined) Object.assign(filters, { [key]: single.data[key] });
  }
  return filters;
}

export const hasActiveFilters = (filters: TrackFilters): boolean => FILTER_KEYS.some((key) => filters[key] !== undefined);

/** The query string for the address bar: only what differs from the default view. */
export function toSearchParams(tab: CatalogTab, filters: Partial<TrackFilters>): URLSearchParams {
  const params = new URLSearchParams();
  if (tab === 'programs') params.set('tab', 'programs');
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (tab === 'tracks' && value) params.set(key, value);
  }
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));
  return params;
}

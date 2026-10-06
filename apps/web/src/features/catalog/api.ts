import {
  programDetailSchema,
  programListSchema,
  taxonomySchema,
  trackListSchema,
  trackSummarySchema,
  type ProgramListQuery,
  type TrackListQuery,
} from '@mirsonix/shared';
import { apiRequest } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

export const catalogKeys = {
  all: ['catalog'] as const,
  taxonomy: () => [...catalogKeys.all, 'taxonomy'] as const,
  tracks: (query: Partial<TrackListQuery>) => [...catalogKeys.all, 'tracks', query] as const,
  track: (slug: string) => [...catalogKeys.all, 'track', slug] as const,
  programs: (query: Partial<ProgramListQuery>) => [...catalogKeys.all, 'programs', query] as const,
  program: (slug: string) => [...catalogKeys.all, 'program', slug] as const,
};

export const catalogApi = {
  taxonomy: (signal?: AbortSignal) => apiRequest('/catalog/taxonomy', { schema: taxonomySchema, signal }),
  tracks: (query: Partial<TrackListQuery>, signal?: AbortSignal) =>
    apiRequest(`/catalog/tracks${toQueryString(query)}`, { schema: trackListSchema, signal }),
  track: (slug: string, signal?: AbortSignal) =>
    apiRequest(`/catalog/tracks/${encodeURIComponent(slug)}`, { schema: trackSummarySchema, signal }),
  programs: (query: Partial<ProgramListQuery>, signal?: AbortSignal) =>
    apiRequest(`/catalog/programs${toQueryString(query)}`, { schema: programListSchema, signal }),
  program: (slug: string, signal?: AbortSignal) =>
    apiRequest(`/catalog/programs/${encodeURIComponent(slug)}`, { schema: programDetailSchema, signal }),
};

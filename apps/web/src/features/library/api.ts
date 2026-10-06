import { libraryProgramDetailSchema, librarySchema, type Library } from '@mirsonix/shared';
import { apiRequest } from '@/lib/api-client';

export const libraryKeys = {
  all: ['library'] as const,
  list: () => [...libraryKeys.all, 'list'] as const,
  program: (id: string) => [...libraryKeys.all, 'program', id] as const,
};

export const libraryApi = {
  get: (signal?: AbortSignal) => apiRequest('/library', { schema: librarySchema, signal }),
  program: (id: string, signal?: AbortSignal) => apiRequest(`/library/programs/${id}`, { schema: libraryProgramDetailSchema, signal }),
};

/** What the listener owns outright, for marking cards in the catalog. Tracks inside an owned program are not listed here. */
export interface Ownership {
  trackIds: ReadonlySet<string>;
  programIds: ReadonlySet<string>;
  /** True when something is paid for through Stripe, so a billing portal exists to manage it. */
  hasSubscription: boolean;
}

export function toOwnership(library: Library): Ownership {
  const items = [...library.tracks, ...library.programs];
  return {
    trackIds: new Set(library.tracks.map((track) => track.id)),
    programIds: new Set(library.programs.map((program) => program.id)),
    hasSubscription: items.some((item) => item.access.source !== 'GRANT'),
  };
}

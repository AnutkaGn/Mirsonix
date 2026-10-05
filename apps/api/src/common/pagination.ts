import type { PaginationMeta } from '@mirsonix/shared';

export const toPaginationMeta = (page: number, limit: number, total: number): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

export const toOffset = (page: number, limit: number): number => (page - 1) * limit;

/** Escapes LIKE wildcards so user input is matched literally. */
export const escapeLike = (text: string): string => text.replace(/[\\%_]/g, '\\$&');

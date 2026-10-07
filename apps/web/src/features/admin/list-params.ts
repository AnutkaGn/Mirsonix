import { ContentStatus } from '@mirsonix/shared';

export interface ListParams {
  page: number;
  q: string;
  status: ContentStatus | undefined;
}

/** What an admin list shows, read back from the URL, so a filtered list can be bookmarked and survives a reload. */
export function parseListParams(params: URLSearchParams): ListParams {
  const page = Number(params.get('page'));
  const status = ContentStatus.schema.safeParse(params.get('status'));
  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    q: params.get('q')?.slice(0, 100) ?? '',
    status: status.success ? status.data : undefined,
  };
}

/** A change to the filters goes back to page 1; blank values stay out of the URL. */
export function toListSearchParams(
  current: ListParams,
  patch: Partial<ListParams>,
): URLSearchParams {
  const next = { ...current, page: 1, ...patch };
  const search = new URLSearchParams();
  if (next.q.trim()) search.set('q', next.q);
  if (next.status) search.set('status', next.status);
  if (next.page > 1) search.set('page', String(next.page));
  return search;
}

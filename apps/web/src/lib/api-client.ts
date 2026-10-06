import { apiErrorSchema, authSessionSchema, type ApiError } from '@mirsonix/shared';
import type { z } from 'zod';
import { useAuthStore } from '@/stores/auth.store';
import { env } from './env';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError | null,
  ) {
    super(body?.message ?? `Request failed with status ${status}`);
  }
}

interface RequestOptions<S extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Response is validated against the shared schema, so contract drift fails loudly. */
  schema?: S;
  signal?: AbortSignal;
  /** Public endpoint: no bearer token, and a 401 is a real answer rather than a cue to refresh. */
  anonymous?: boolean;
  /** Lets the request finish even if the page is closing (a last progress report). */
  keepalive?: boolean;
}

async function send(path: string, { method = 'GET', body, signal, anonymous, keepalive }: RequestOptions<z.ZodType>) {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token && !anonymous) headers.Authorization = `Bearer ${token}`;
  return fetch(`${env.VITE_API_URL}${path}`, {
    method,
    signal,
    keepalive,
    credentials: 'include', // refresh token lives in an httpOnly cookie
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function parse<S extends z.ZodType>(res: Response, schema: S | undefined): Promise<z.infer<S>> {
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(json);
    throw new ApiRequestError(res.status, parsed.success ? parsed.data : null);
  }
  return (schema ? schema.parse(json) : json) as z.infer<S>;
}

let inflightRefresh: Promise<boolean> | null = null;

/**
 * Exchanges the refresh cookie for a new access token. Calls made while one is in flight share it:
 * refresh tokens rotate, so two parallel refreshes would make the second look like token theft.
 */
export function refreshSession(): Promise<boolean> {
  inflightRefresh ??= (async () => {
    try {
      const res = await send('/auth/refresh', { method: 'POST', anonymous: true });
      const session = await parse(res, authSessionSchema);
      useAuthStore.getState().setSession(session);
      return true;
    } catch {
      useAuthStore.getState().clear();
      return false;
    } finally {
      inflightRefresh = null;
    }
  })();
  return inflightRefresh;
}

export async function apiRequest<S extends z.ZodType>(path: string, options: RequestOptions<S> = {}): Promise<z.infer<S>> {
  let res = await send(path, options);
  if (res.status === 401 && !options.anonymous && (await refreshSession())) {
    res = await send(path, options); // retry once with the new access token
  }
  return parse(res, options.schema);
}

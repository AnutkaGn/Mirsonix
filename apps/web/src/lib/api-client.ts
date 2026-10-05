import { apiErrorSchema, type ApiError } from '@mirsonix/shared';
import type { z } from 'zod';
import { env } from './env';

export class ApiRequestError extends Error {
  constructor(public readonly status: number, public readonly body: ApiError | null) {
    super(body?.message ?? `Request failed with status ${status}`);
  }
}

interface RequestOptions<S extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Response is validated against the shared schema, so contract drift fails loudly. */
  schema: S;
  signal?: AbortSignal;
}

export async function apiRequest<S extends z.ZodType>(
  path: string,
  { method = 'GET', body, schema, signal }: RequestOptions<S>,
): Promise<z.infer<S>> {
  const res = await fetch(`${env.VITE_API_URL}${path}`, {
    method,
    signal,
    credentials: 'include', // refresh token lives in an httpOnly cookie
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(json);
    throw new ApiRequestError(res.status, parsed.success ? parsed.data : null);
  }
  return schema.parse(json);
}

export interface CallOptions {
  method?: string;
  body?: unknown;
  token?: string;
  cookie?: string;
}

export interface CallResult {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper: shapes are asserted case by case
  json: any;
  location: string | null;
  cookies: string[];
}

/** A tiny fetch wrapper for e2e tests. `baseUrl` is a function because the app's port is only known after listen(). */
export function createHttp(baseUrl: () => string) {
  return async function call(path: string, options: CallOptions = {}): Promise<CallResult> {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    if (options.cookie) headers.cookie = options.cookie;

    const res = await fetch(`${baseUrl()}${path}`, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      redirect: 'manual',
    });
    const text = await res.text();
    return {
      status: res.status,
      json: text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : null,
      location: res.headers.get('location'),
      cookies: res.headers.getSetCookie(),
    };
  };
}

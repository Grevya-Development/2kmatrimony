/**
 * Platform-agnostic API client core (no React Native imports — unit tested).
 * Handles the { data } / { error } envelope, Bearer auth, platform header and a
 * single token refresh + retry on 401.
 */
import type { ApiErrorCode } from '@2k/shared';

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode | 'network_error',
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
  get isNetwork() {
    return this.code === 'network_error';
  }
}

export interface Envelope<T> {
  data: T;
  nextCursor?: string | null;
}

export function parseEnvelope<T>(status: number, json: unknown): Envelope<T> {
  const body = (json && typeof json === 'object' ? json : null) as { data?: T; nextCursor?: string | null; error?: { code?: string; message?: string; details?: unknown } } | null;
  if (status >= 200 && status < 300 && body && !body.error && 'data' in body) {
    return { data: body.data as T, nextCursor: body.nextCursor };
  }
  const e = body?.error;
  const fallback: ApiErrorCode = status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : status === 404 ? 'not_found' : status === 429 ? 'rate_limited' : 'internal_error';
  throw new ApiClientError(status, (e?.code as ApiErrorCode) ?? fallback, e?.message ?? 'Something went wrong. Please try again.', e?.details);
}

export interface ApiClientOptions {
  baseUrl: string;
  platform: 'ios' | 'android' | 'web';
  getAccessToken: () => Promise<string | null>;
  /** Refresh the session; return the new access token or null when signed out. */
  refreshAccessToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
  onNetworkStatus?: (online: boolean) => void;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

export function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
  const base = baseUrl.replace(/\/$/, '');
  const p = path.startsWith('/api/') ? path : `/api/v1${path.startsWith('/') ? path : `/${path}`}`;
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  return `${base}${p}${qs ? `?${qs}` : ''}`;
}

export function createApiClient(opts: ApiClientOptions) {
  const doFetch = opts.fetchImpl ?? fetch;

  async function send(path: string, init: RequestOptions, token: string | null): Promise<Response> {
    const headers: Record<string, string> = { accept: 'application/json', 'x-client-platform': opts.platform };
    if (token) headers.authorization = `Bearer ${token}`;
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    try {
      const res = await doFetch(buildUrl(opts.baseUrl, path, init.query), {
        method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
        headers,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: init.signal,
      });
      opts.onNetworkStatus?.(true);
      return res;
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') throw err;
      opts.onNetworkStatus?.(false);
      throw new ApiClientError(0, 'network_error', 'You appear to be offline. Check your connection and try again.');
    }
  }

  /** Raw response with auth + one refresh-retry. Used for streaming endpoints. */
  async function raw(path: string, init: RequestOptions = {}): Promise<Response> {
    let token = await opts.getAccessToken();
    let res = await send(path, init, token);
    if (res.status === 401 && token) {
      token = await opts.refreshAccessToken();
      if (token) res = await send(path, init, token);
    }
    return res;
  }

  async function request<T>(path: string, init: RequestOptions = {}): Promise<Envelope<T>> {
    const res = await raw(path, init);
    const json = await res.json().catch(() => null);
    return parseEnvelope<T>(res.status, json);
  }

  return {
    raw,
    request,
    get: async <T>(path: string, query?: RequestOptions['query']) => (await request<T>(path, { query })).data,
    post: async <T>(path: string, body?: unknown) => (await request<T>(path, { method: 'POST', body: body ?? {} })).data,
    put: async <T>(path: string, body: unknown) => (await request<T>(path, { method: 'PUT', body })).data,
    patch: async <T>(path: string, body: unknown) => (await request<T>(path, { method: 'PATCH', body })).data,
    del: async <T>(path: string, body?: unknown) => (await request<T>(path, { method: 'DELETE', body })).data,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** User-facing message for any thrown error. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong. Please try again.';
}

'use client';
import type { ApiErrorBody } from '@2k/shared';

export class ApiClientError extends Error {
  constructor(public status: number, public code: ApiErrorBody['code'], message: string, public details?: unknown) {
    super(message);
  }
}

/**
 * Typed fetch for /api/v1 from client components (cookie session).
 * Returns `data`; throws ApiClientError with the server's code/message.
 */
export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await apiRaw<T>(path, init);
  return res.data;
}

export async function apiRaw<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<{ data: T; nextCursor?: string | null }> {
  const res = await fetch(path.startsWith('/api') ? path : `/api/v1${path}`, {
    method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
    headers: init.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
    credentials: 'same-origin',
  });
  const json = (await res.json().catch(() => null)) as { data?: T; nextCursor?: string | null; error?: ApiErrorBody } | null;
  if (!res.ok || !json || json.error) {
    const e = json?.error;
    throw new ApiClientError(res.status, e?.code ?? 'internal_error', e?.message ?? 'Something went wrong. Please try again.', e?.details);
  }
  return { data: json.data as T, nextCursor: json.nextCursor };
}

/** Upload a file to a signed upload URL returned by POST /api/v1/uploads. */
export async function uploadToSignedUrl(signedUrl: string, file: Blob): Promise<void> {
  const res = await fetch(signedUrl, { method: 'PUT', headers: { 'content-type': file.type, 'x-upsert': 'false' }, body: file });
  if (!res.ok) throw new ApiClientError(res.status, 'internal_error', 'Upload failed. Please try again.');
}

export const newClientId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

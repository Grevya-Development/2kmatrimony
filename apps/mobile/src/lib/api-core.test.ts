import { describe, expect, it, vi } from 'vitest';
import { ApiClientError, buildUrl, createApiClient, parseEnvelope } from './api-core';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('parseEnvelope', () => {
  it('returns data and cursor on success', () => {
    expect(parseEnvelope(200, { data: [1], nextCursor: 'c' })).toEqual({ data: [1], nextCursor: 'c' });
  });
  it('maps server errors', () => {
    try {
      parseEnvelope(402, { error: { code: 'entitlement_required', message: 'Upgrade', details: { key: 'x' } } });
      throw new Error('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiClientError);
      const err = e as ApiClientError;
      expect(err.status).toBe(402);
      expect(err.code).toBe('entitlement_required');
      expect(err.details).toEqual({ key: 'x' });
    }
  });
  it('falls back to status-based codes for non-JSON errors', () => {
    expect(() => parseEnvelope(404, null)).toThrowError(ApiClientError);
    try { parseEnvelope(429, 'oops'); } catch (e) { expect((e as ApiClientError).code).toBe('rate_limited'); }
  });
});

describe('buildUrl', () => {
  it('prefixes /api/v1 and encodes query', () => {
    expect(buildUrl('http://x/', '/interests', { direction: 'sent', empty: '', n: null })).toBe('http://x/api/v1/interests?direction=sent');
    expect(buildUrl('http://x', '/api/cron/daily')).toBe('http://x/api/cron/daily');
  });
});

describe('createApiClient', () => {
  it('sends bearer token and platform header', async () => {
    const fetchImpl = vi.fn(async () => json(200, { data: { ok: true } }));
    const api = createApiClient({ baseUrl: 'http://api', platform: 'ios', getAccessToken: async () => 'tok', refreshAccessToken: async () => null, fetchImpl: fetchImpl as unknown as typeof fetch });
    await api.post('/reports', { reason: 'spam' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api/api/v1/reports');
    const h = init.headers as Record<string, string>;
    expect(h.authorization).toBe('Bearer tok');
    expect(h['x-client-platform']).toBe('ios');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ reason: 'spam' }));
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const tokens: string[] = [];
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const t = (init.headers as Record<string, string>).authorization ?? '';
      tokens.push(t);
      return t === 'Bearer new' ? json(200, { data: 'ok' }) : json(401, { error: { code: 'unauthorized', message: 'expired' } });
    });
    const refresh = vi.fn(async () => 'new');
    const api = createApiClient({ baseUrl: 'http://api', platform: 'android', getAccessToken: async () => 'old', refreshAccessToken: refresh, fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(api.get('/me')).resolves.toBe('ok');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(tokens).toEqual(['Bearer old', 'Bearer new']);
  });

  it('does not loop when refresh fails', async () => {
    const fetchImpl = vi.fn(async () => json(401, { error: { code: 'unauthorized', message: 'no' } }));
    const api = createApiClient({ baseUrl: 'http://api', platform: 'ios', getAccessToken: async () => 'old', refreshAccessToken: async () => null, fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(api.get('/me')).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('reports network failures as offline errors', async () => {
    const status: boolean[] = [];
    const api = createApiClient({ baseUrl: 'http://api', platform: 'ios', getAccessToken: async () => null, refreshAccessToken: async () => null, fetchImpl: (async () => { throw new TypeError('Network request failed'); }) as unknown as typeof fetch, onNetworkStatus: (o) => status.push(o) });
    await expect(api.get('/me')).rejects.toMatchObject({ code: 'network_error' });
    expect(status).toEqual([false]);
  });
});

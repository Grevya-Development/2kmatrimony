'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api';

/** Show a friendly toast for API errors. Daily limits are anti-abuse caps (everything is free). */
export function showApiError(err: unknown, fallback = 'Something went wrong. Please try again.') {
  if (err instanceof ApiClientError) {
    if (err.code === 'entitlement_required') {
      toast('You’ve reached today’s limit for this. Please try again tomorrow.');
      return;
    }
    toast.error(err.message);
    return;
  }
  toast.error(fallback);
}

/** Minimal data hook for GET endpoints with loading/error/reload. */
export function useApiData<T>(path: string | null) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(!!path);
  const load = React.useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api<T>(path));
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not load this right now.');
    } finally {
      setLoading(false);
    }
  }, [path]);
  React.useEffect(() => { void load(); }, [load]);
  return { data, setData, error, loading, reload: load };
}

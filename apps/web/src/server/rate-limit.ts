import 'server-only';
import { db } from '@/lib/supabase/admin';
import { ApiError } from './http';

/** Fixed-window rate limiter backed by Postgres. Throws 429 when exceeded. */
export async function rateLimit(bucket: string, limit: number, windowSec: number): Promise<void> {
  const { data, error } = await db().rpc('rate_limit_hit', { p_bucket: bucket, p_window_seconds: windowSec, p_limit: limit });
  if (error) {
    console.error('[rate-limit] failed open', error.message);
    return; // fail open: availability over strictness for a limiter outage
  }
  if (data === false) throw new ApiError(429, 'rate_limited', 'Too many requests. Please slow down and try again shortly.');
}

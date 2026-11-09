import { route } from '@/server/http';
import { db } from '@/lib/supabase/admin';
import { integrationStatus } from '@/lib/env';

/**
 * Liveness + dependency check. Public callers get status only; admins also see
 * DB latency and which optional integrations are configured.
 */
export const GET = route({ auth: 'optional' }, async ({ auth }) => {
  const started = Date.now();
  const { error } = await db().from('feature_flags').select('key', { head: true, count: 'exact' });
  const base = { status: error ? 'degraded' : 'ok', database: error ? 'error' : 'ok', time: new Date().toISOString() };
  if (!auth?.admin) return base;
  return { ...base, dbLatencyMs: Date.now() - started, integrations: integrationStatus() };
});

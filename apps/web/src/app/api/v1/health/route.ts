import { route } from '@/server/http';
import { db } from '@/lib/supabase/admin';
import { integrationStatus } from '@/lib/env';

/** Liveness + dependency check. Integration flags show which optional services are configured. */
export const GET = route({ auth: 'none' }, async () => {
  const started = Date.now();
  const { error } = await db().from('feature_flags').select('key', { head: true, count: 'exact' });
  return { status: error ? 'degraded' : 'ok', database: error ? 'error' : 'ok', dbLatencyMs: Date.now() - started, integrations: integrationStatus(), time: new Date().toISOString() };
});

import 'server-only';
import { db } from '@/lib/supabase/admin';
import { integrations } from '@/lib/env';
import { removeObjects } from '@/server/media';
import { refreshProfileEmbedding } from '@/server/ai/embeddings';
import { retentionCutoffs } from './retention';

export async function cleanupCounters(now = new Date()) {
  const c = retentionCutoffs(now);
  const rl = await db().from('rate_limit_counters').delete({ count: 'exact' }).lt('window_start', c.rateLimitCounters.toISOString());
  const uc = await db().from('usage_counters').delete({ count: 'exact' }).lt('period_start', c.usageCounters.toISOString().slice(0, 10));
  if (rl.error) throw rl.error;
  if (uc.error) throw uc.error;
  return { rateLimitCounters: rl.count ?? 0, usageCounters: uc.count ?? 0 };
}

/** Delete data-export archives older than 7 days and mark their requests expired. */
export async function expireDataExports(now = new Date()) {
  const cutoff = retentionCutoffs(now).dataExports.toISOString();
  const { data, error } = await db().from('data_requests').select('id, result_path, completed_at, created_at').eq('kind', 'export').not('result_path', 'is', null).or(`completed_at.lt.${cutoff},and(completed_at.is.null,created_at.lt.${cutoff})`).limit(1000);
  if (error) throw error;
  const rows = data ?? [];
  await removeObjects('data-exports', rows.map((r) => r.result_path!).filter(Boolean));
  if (rows.length) {
    const { error: upErr } = await db().from('data_requests').update({ status: 'expired', result_path: null, notes: 'Export archive deleted after 7-day retention.' }).in('id', rows.map((r) => r.id));
    if (upErr) throw upErr;
  }
  return { expired: rows.length };
}

/** Delete verification documents 90 days after a final decision. */
export async function purgeVerificationDocuments(now = new Date()) {
  const cutoff = retentionCutoffs(now).verificationDocs.toISOString();
  const { data, error } = await db().from('verifications').select('id, document_paths').in('status', ['approved', 'rejected']).lt('reviewed_at', cutoff).not('document_paths', 'eq', '{}').limit(1000);
  if (error) throw error;
  const rows = (data ?? []).filter((r) => r.document_paths.length > 0);
  await removeObjects('verification-docs', rows.flatMap((r) => r.document_paths));
  if (rows.length) {
    const { error: upErr } = await db().from('verifications').update({ document_paths: [] }).in('id', rows.map((r) => r.id));
    if (upErr) throw upErr;
  }
  return { purged: rows.length };
}

/** Purge AI usage logs and analytics events older than 13 months. */
export async function purgeOldLogs(now = new Date()) {
  const cutoff = retentionCutoffs(now).logs.toISOString();
  const ai = await db().from('ai_usage_logs').delete({ count: 'exact' }).lt('created_at', cutoff);
  const ev = await db().from('analytics_events').delete({ count: 'exact' }).lt('created_at', cutoff);
  if (ai.error) throw ai.error;
  if (ev.error) throw ev.error;
  return { aiUsageLogs: ai.count ?? 0, analyticsEvents: ev.count ?? 0 };
}

/** Best-effort: embed active profiles that have search text but no embedding. */
export async function refreshMissingEmbeddings(limit = 50) {
  if (!integrations.voyage) return { skipped: 'voyage_unconfigured' };
  const { data } = await db().from('profiles').select('id').eq('status', 'active').is('embedding_updated_at', null).not('search_text', 'is', null).limit(limit);
  let refreshed = 0;
  for (const p of data ?? []) if (await refreshProfileEmbedding(p.id)) refreshed++;
  return { refreshed, candidates: data?.length ?? 0 };
}


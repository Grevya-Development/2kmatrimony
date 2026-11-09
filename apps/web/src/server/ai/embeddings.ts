import 'server-only';
import { db } from '@/lib/supabase/admin';
import { integrations, serverEnv } from '@/lib/env';
import { getFeatureConfig, logUsage } from './client';

/**
 * Embeddings via Voyage AI (Anthropic's recommended embeddings provider).
 * Optional: when unconfigured, search uses Postgres full-text only.
 * Model/dimension must match profiles.embedding (vector(1024)).
 */
const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const DIMENSIONS = 1024;

async function embed(texts: string[], inputType: 'query' | 'document', userId: string | null): Promise<number[][] | null> {
  if (!integrations.voyage || texts.length === 0) return null;
  const cfg = await getFeatureConfig('embeddings');
  if (!cfg.enabled || cfg.provider !== 'voyage') return null;
  const started = Date.now();
  try {
    const res = await fetch(VOYAGE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${serverEnv.voyageApiKey}` },
      body: JSON.stringify({ input: texts, model: cfg.model, input_type: inputType, output_dimension: DIMENSIONS }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`voyage ${res.status}`);
    const json = (await res.json()) as { data: { embedding: number[] }[]; usage?: { total_tokens?: number } };
    await logUsage({ userId, feature: 'embeddings', provider: 'voyage', model: cfg.model, usage: { input_tokens: json.usage?.total_tokens ?? 0 }, latencyMs: Date.now() - started, status: 'success' });
    return json.data.map((d) => d.embedding);
  } catch (err) {
    await logUsage({ userId, feature: 'embeddings', provider: 'voyage', model: cfg.model, latencyMs: Date.now() - started, status: 'error', errorCode: err instanceof Error ? err.message.slice(0, 60) : 'unknown' });
    return null;
  }
}

export async function embedQuery(text: string, userId: string | null = null): Promise<number[] | null> {
  return (await embed([text.slice(0, 2000)], 'query', userId))?.[0] ?? null;
}

/** Re-embed a profile's search text. Safe to call after every profile edit. */
export async function refreshProfileEmbedding(profileId: string): Promise<boolean> {
  const { data } = await db().from('profiles').select('search_text').eq('id', profileId).maybeSingle();
  if (!data?.search_text) return false;
  const vec = (await embed([data.search_text], 'document', null))?.[0];
  if (!vec) return false;
  const cfg = await getFeatureConfig('embeddings');
  await db().from('profiles').update({ embedding: JSON.stringify(vec), embedding_model: cfg.model, embedding_updated_at: new Date().toISOString() }).eq('id', profileId);
  return true;
}

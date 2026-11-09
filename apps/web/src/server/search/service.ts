import 'server-only';
import { ADVANCED_FILTER_KEYS, type Entitlements, type ProfileCard, type SearchFilters, type SearchRequest } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { cursor, errors } from '@/server/http';
import { loadBundles, type ProfileBundle } from '@/server/profiles/load';
import { buildViewerContext, compatibilitySummary, toCards } from '@/server/profiles/projection';
import { scoreCandidates } from '@/server/matching/service';
import { embedQuery } from '@/server/ai/embeddings';

const POOL = 200; // rows fetched from SQL per page window before scoring/sorting

/** Reject advanced filters the member's plan does not include. */
export function assertFilterEntitlements(filters: SearchFilters, ent: Entitlements): void {
  if (ent.advanced_filters) return;
  const used = ADVANCED_FILTER_KEYS.filter((k) => {
    const v = filters[k];
    return v !== undefined && v !== null && v !== false && !(Array.isArray(v) && v.length === 0) && v !== '';
  });
  if (used.length) throw errors.entitlement('Advanced filters are available on Plus and above.', { filters: used });
}

export interface SearchResult {
  items: ProfileCard[];
  nextCursor: string | null;
  total: number;
}

/**
 * Filtered + ranked search. SQL applies filters, privacy and blocks; the
 * matching engine adds mutual compatibility; results sort by the requested key.
 */
export async function searchProfiles(viewer: ProfileBundle, req: SearchRequest, opts: { softPreferences?: string[] } = {}): Promise<SearchResult> {
  const offset = cursor.decode<{ o: number }>(req.cursor)?.o ?? 0;
  const text = [req.filters.text, ...(opts.softPreferences ?? [])].filter(Boolean).join(' ').trim() || null;
  const embedding = text ? await embedQuery(text) : null;

  const { data, error } = await db().rpc('search_profile_ids', {
    p_viewer: viewer.profile.id,
    p_filters: req.filters as never,
    p_text: text as unknown as string,
    p_embedding: (embedding ? JSON.stringify(embedding) : null) as unknown as string,
    p_limit: POOL,
    p_offset: 0,
    p_exclude_passed: false,
  });
  if (error) throw error;
  const rows = data ?? [];
  const bundles = await loadBundles(rows.map((r) => r.profile_id));
  const scored = await scoreCandidates(viewer, [...bundles.values()]);

  const rank = new Map(rows.map((r, i) => [r.profile_id, { i, text: r.text_rank, vec: r.vector_similarity, active: r.last_active_at, activated: r.activated_at }]));
  const ids = rows.map((r) => r.profile_id).filter((id) => bundles.has(id));
  const mutual = (id: string) => scored.get(id)?.mutual ?? 0;
  const eligible = (id: string) => scored.get(id)?.eligible !== false;

  const sorted = ids.filter(eligible).sort((a, b) => {
    const ra = rank.get(a)!;
    const rb = rank.get(b)!;
    switch (req.sort) {
      case 'compatibility': return mutual(b) - mutual(a);
      case 'newest': return (rb.activated ?? '').localeCompare(ra.activated ?? '');
      case 'recently_active': return (rb.active ?? '').localeCompare(ra.active ?? '');
      default: {
        // relevance: text/semantic match blended with compatibility
        const sa = (ra.text + ra.vec) * 40 + mutual(a) * 0.6;
        const sb = (rb.text + rb.vec) * 40 + mutual(b) * 0.6;
        return sb - sa;
      }
    }
  });

  const page = sorted.slice(offset, offset + req.limit);
  const ctx = await buildViewerContext(viewer.profile.id, page);
  const extras = new Map(page.map((id) => {
    const p = scored.get(id)!;
    return [id, { compatibility: compatibilitySummary(p.mutual, p.confidence), sharedInterests: p.sharedInterests }];
  }));
  const items = await toCards(page.map((id) => bundles.get(id)!), ctx, extras);
  const nextOffset = offset + req.limit;
  return { items, nextCursor: nextOffset < sorted.length ? cursor.encode({ o: nextOffset }) : null, total: sorted.length };
}

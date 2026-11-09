import 'server-only';
import type { ProfileCard } from '@2k/shared';
import { loadBundle, loadBundles, type ProfileBundle } from '@/server/profiles/load';
import { buildViewerContext, compatibilitySummary, toCards, type CardOptions } from '@/server/profiles/projection';
import { scoreCandidates } from '@/server/matching/service';
import { errors } from '@/server/http';

/** Load the caller's own bundle (needed for compatibility scoring). */
export async function viewerBundle(profileId: string): Promise<ProfileBundle> {
  const b = await loadBundle(profileId);
  if (!b) throw errors.profileIncomplete('Create your profile first.');
  return b;
}

/**
 * Privacy-projected cards for arbitrary profile ids, with mutual compatibility.
 * Returns a map keyed by profile id; profiles the viewer may not see are omitted.
 */
export async function buildCards(viewer: ProfileBundle, ids: string[]): Promise<Map<string, ProfileCard>> {
  const unique = [...new Set(ids)].filter((id) => id && id !== viewer.profile.id);
  const out = new Map<string, ProfileCard>();
  if (unique.length === 0) return out;
  const bundles = await loadBundles(unique);
  const list = [...bundles.values()];
  const [scores, ctx] = await Promise.all([scoreCandidates(viewer, list), buildViewerContext(viewer.profile.id, unique)]);
  const extras = new Map<string, CardOptions>();
  for (const [id, p] of scores) extras.set(id, { compatibility: p.eligible ? compatibilitySummary(p.mutual, p.confidence) : null, sharedInterests: p.sharedInterests });
  for (const card of await toCards(list, ctx, extras)) out.set(card.id, card);
  return out;
}

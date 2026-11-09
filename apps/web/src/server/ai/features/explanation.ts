import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Json, MatchExplanation } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from '@/server/auth';
import { isEnabled } from '@/server/config';
import { getPlanState } from '@/server/entitlements';
import { errors } from '@/server/http';
import { explainPair } from '@/server/matching/service';
import { loadBundle } from '@/server/profiles/load';
import { buildViewerContext, canView, toDetail, type ViewerContext } from '@/server/profiles/projection';
import { aiAvailable, runStructured, untrusted } from '../client';
import { registerPrompt } from '../prompts';
import { cleanList, groundingFrom, hasConsent, safeList, isSafeCopy } from './common';

registerPrompt(
  'match_explanation',
  `You write the explanation a member sees for one suggested match.
You receive:
- <engine_facts>: the deterministic compatibility analysis (scores, aligned areas, differences, shared interests, preference notes). These are the only facts about compatibility you may use.
- <viewer>: the member reading this (their own data).
- <candidate>: the suggested person, limited to what the viewer is allowed to see.

Write:
- headline: one warm, specific sentence (max 25 words) about where they align. No scores, no superlatives about destiny.
- alignments: up to 6 short bullets (max 18 words each), each grounded in a specific engine fact or shared detail.
- differences: up to 4 gentle bullets framed as "worth discussing", never as problems or verdicts.
- conversationStarters: exactly 5 open, respectful questions the viewer could ask, tailored to shared interests/values/future plans. No pick-up lines, nothing about money, appearance, religion, caste or family status.
Address the viewer as "you" and the candidate by their display name. Do not invent facts that are not in the input.`,
);

const AiExplanationSchema = z.object({
  headline: z.string(),
  alignments: z.array(z.string()),
  differences: z.array(z.string()),
  conversationStarters: z.array(z.string()),
});
export type AiExplanationOutput = z.infer<typeof AiExplanationSchema>;

type Tier = 'none' | 'basic' | 'full';

interface CachedContent extends MatchExplanation {
  fingerprint: string;
  tier: Tier;
}

function fingerprintOf(explanation: MatchExplanation, extra: string[]): string {
  const basis = {
    c: explanation.compatibility,
    d: explanation.dimensions.map((d) => [d.key, d.score, d.forViewer, d.forCandidate]),
    a: explanation.alignments,
    x: explanation.differences,
    s: explanation.sharedInterests,
    extra,
  };
  return createHash('sha256').update(JSON.stringify(basis)).digest('hex').slice(0, 32);
}

/** Merge AI output into the engine explanation according to the plan tier. */
export function mergeAiExplanation(engine: MatchExplanation, ai: AiExplanationOutput, tier: Tier): MatchExplanation {
  const starters = safeList(cleanList(ai.conversationStarters, 5, 240));
  const base: MatchExplanation = { ...engine, generator: 'ai', conversationStarters: starters.length ? starters : engine.conversationStarters };
  if (tier !== 'full') return base;
  const alignments = safeList(cleanList(ai.alignments, 6, 200));
  const differences = safeList(cleanList(ai.differences, 4, 220));
  const headline = ai.headline.trim().slice(0, 220);
  return {
    ...base,
    headline: headline && isSafeCopy(headline) ? headline : engine.headline,
    alignments: alignments.length ? alignments : engine.alignments,
    differences: differences.length || engine.differences.length === 0 ? differences : engine.differences,
  };
}

/** Build the exact (privacy-safe) model input. Exported for tests. */
export async function buildExplanationInput(
  engine: MatchExplanation,
  viewerId: string,
  candidateId: string,
  ctx: ViewerContext,
): Promise<string | null> {
  const [viewerBundle, candidateBundle] = await Promise.all([loadBundle(viewerId), loadBundle(candidateId)]);
  if (!viewerBundle || !candidateBundle) return null;
  const selfCtx: ViewerContext = { viewerProfileId: viewerId, relationships: new Map() };
  const [viewerDetail, candidateDetail] = await Promise.all([toDetail(viewerBundle, selfCtx), toDetail(candidateBundle, ctx)]);
  if (!viewerDetail || !candidateDetail) return null;
  const connected = !!ctx.relationships.get(candidateId)?.connectionActive;
  const facts = {
    compatibility: engine.compatibility,
    dimensions: engine.dimensions.map((d) => ({ area: d.label, mutual: d.score, note: d.note })),
    alignments: engine.alignments,
    differences: engine.differences,
    sharedInterests: engine.sharedInterests,
    mutualPreferenceNotes: engine.mutualPreferenceNotes,
  };
  return [
    untrusted('engine_facts', facts),
    untrusted('viewer', groundingFrom(viewerDetail, viewerBundle, true)),
    untrusted('candidate', groundingFrom(candidateDetail, candidateBundle, connected)),
  ].join('\n\n');
}

/**
 * GET /profiles/[id]/explanation — engine explanation, optionally enriched by AI.
 * Throws 404 when the viewer may not see the candidate.
 */
export async function getMatchExplanation(auth: AuthContext, candidateId: string): Promise<MatchExplanation> {
  const viewerId = auth.profile!.id;
  if (candidateId === viewerId) throw errors.notFound();
  const [ctx, candidate] = await Promise.all([buildViewerContext(viewerId, [candidateId]), loadBundle(candidateId)]);
  if (!candidate || !canView(candidate, ctx)) throw errors.notFound('Profile not found.');

  const result = await explainPair(viewerId, candidateId);
  if (!result) throw errors.notFound('Profile not found.');
  const engine = result.explanation;

  const plan = await getPlanState(auth.userId);
  const tier = plan.entitlements.ai_insights as Tier;
  if (tier === 'none') return engine;
  const [flagOn, available, consent] = await Promise.all([
    isEnabled('ai_explanations'),
    aiAvailable('match_explanation'),
    hasConsent(auth.userId, 'ai_processing'),
  ]);
  if (!flagOn || !available || !consent) return engine;

  const fingerprint = fingerprintOf(engine, [result.viewer.profile.updated_at, result.candidate.profile.updated_at, tier]);
  const { data: cached } = await db()
    .from('match_explanations')
    .select('content')
    .eq('viewer_profile_id', viewerId)
    .eq('candidate_profile_id', candidateId)
    .maybeSingle();
  const c = cached?.content as unknown as CachedContent | undefined;
  if (c && c.fingerprint === fingerprint && c.tier === tier) {
    const { fingerprint: _f, tier: _t, ...rest } = c;
    return { ...rest, computedAt: engine.computedAt };
  }

  const input = await buildExplanationInput(engine, viewerId, candidateId, ctx);
  if (!input) return engine;
  try {
    const { output, model, promptVersion } = await runStructured({ feature: 'match_explanation', userId: auth.userId, schema: AiExplanationSchema, input });
    const merged = mergeAiExplanation(engine, output, tier);
    const content: CachedContent = { ...merged, fingerprint, tier };
    await db().from('match_explanations').upsert(
      {
        viewer_profile_id: viewerId,
        candidate_profile_id: candidateId,
        content: content as unknown as NonNullable<Json>,
        generator: 'ai',
        model,
        prompt_version: promptVersion === null ? null : String(promptVersion),
        score_computed_at: new Date().toISOString(),
      },
      { onConflict: 'viewer_profile_id,candidate_profile_id' },
    );
    return merged;
  } catch (err) {
    console.error('[ai] explanation enrichment failed; using engine output', err instanceof Error ? err.message : err);
    return engine;
  }
}

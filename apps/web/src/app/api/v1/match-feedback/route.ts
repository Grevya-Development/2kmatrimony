import { matchFeedbackSchema } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { parseJson, route } from '@/server/http';

/** Thumbs up/down on a suggested match; used to evaluate scoring weights. */
export const POST = route({ profile: 'active', rateLimit: { name: 'match-feedback', limit: 60, windowSec: 3600 } }, async ({ req, auth }) => {
  const body = await parseJson(req, matchFeedbackSchema);
  const me = auth.profile!;
  const [a, b] = me.id < body.candidateProfileId ? [me.id, body.candidateProfileId] : [body.candidateProfileId, me.id];
  const { data: score } = await db().from('match_scores').select('mutual, config_version').eq('profile_a', a).eq('profile_b', b).maybeSingle();
  const { error } = await db().from('match_feedback').upsert(
    {
      profile_id: me.id,
      candidate_profile_id: body.candidateProfileId,
      rating: body.rating,
      reason: body.reason ?? null,
      comment: body.comment,
      mutual_score_at_time: score?.mutual ?? null,
      config_version: score?.config_version ?? null,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id,candidate_profile_id' },
  );
  if (error) throw error;
  return { saved: true };
});

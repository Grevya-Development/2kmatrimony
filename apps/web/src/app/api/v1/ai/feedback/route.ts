import { aiFeedbackSchema } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { parseJson, route } from '@/server/http';

export const POST = route({ rateLimit: { name: 'ai-feedback', limit: 60, windowSec: 3600 } }, async ({ req, auth }) => {
  const body = await parseJson(req, aiFeedbackSchema);
  const { error } = await db().from('ai_feedback').insert({ user_id: auth.userId, feature: body.feature, reference_id: body.referenceId ?? null, rating: body.rating, comment: body.comment });
  if (error) throw error;
  return { recorded: true };
});

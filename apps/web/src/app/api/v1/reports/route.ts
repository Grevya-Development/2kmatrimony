import { reportSchema } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { errors, parseJson, route } from '@/server/http';
import { raiseRiskSignal } from '@/server/safety/service';

const URGENT = new Set(['underage', 'safety_concern']);
const HIGH = new Set(['harassment', 'scam_or_fraud', 'fake_profile']);

/** Report a profile, message or photo. Reviewed by people; never auto-enforced. */
export const POST = route({ rateLimit: { name: 'report', limit: 20, windowSec: 3600 } }, async ({ req, auth }) => {
  const body = await parseJson(req, reportSchema);
  const c = db();
  let targetProfileId = body.targetProfileId ?? null;

  if (body.targetMessageId) {
    const { data: msg } = await c.from('messages').select('id, conversation_id, sender_profile_id').eq('id', body.targetMessageId).maybeSingle();
    if (!msg) throw errors.notFound('Message not found.');
    const { data: part } = await c.from('conversation_participants').select('profile_id').eq('conversation_id', msg.conversation_id).eq('user_id', auth.userId).maybeSingle();
    if (!part) throw errors.notFound('Message not found.');
    if (msg.sender_profile_id === part.profile_id) throw errors.validation('You cannot report your own message.');
    targetProfileId = targetProfileId ?? msg.sender_profile_id;
    await c.from('messages').update({ flagged: true }).eq('id', msg.id);
  }
  if (body.targetPhotoId) {
    const { data: photo } = await c.from('profile_photos').select('id, profile_id').eq('id', body.targetPhotoId).maybeSingle();
    if (!photo) throw errors.notFound('Photo not found.');
    targetProfileId = targetProfileId ?? photo.profile_id;
  }
  if (!targetProfileId) throw errors.validation('A report needs a target.');
  if (targetProfileId === auth.profile?.id) throw errors.validation('You cannot report yourself.');
  const { data: target } = await c.from('profiles').select('id, owner_user_id').eq('id', targetProfileId).maybeSingle();
  if (!target) throw errors.notFound('Profile not found.');

  const { data: report, error } = await c
    .from('reports')
    .insert({
      reporter_user_id: auth.userId,
      reporter_profile_id: auth.profile?.id ?? null,
      target_profile_id: targetProfileId,
      target_message_id: body.targetMessageId ?? null,
      target_photo_id: body.targetPhotoId ?? null,
      reason: body.reason,
      details: body.details,
      priority: URGENT.has(body.reason) ? 'urgent' : HIGH.has(body.reason) ? 'high' : 'normal',
    })
    .select('id')
    .single();
  if (error) throw error;

  const { data: open } = await c.from('reports').select('reporter_user_id').eq('target_profile_id', targetProfileId).in('status', ['open', 'in_review']);
  const reporters = new Set((open ?? []).map((r) => r.reporter_user_id));
  if (reporters.size >= 3) {
    await raiseRiskSignal({ userId: target.owner_user_id, profileId: targetProfileId, kind: 'reported_repeatedly', severity: Math.min(5, reporters.size), details: { openReports: open?.length ?? 0, distinctReporters: reporters.size } });
  }
  return { reportId: report.id, received: true };
});

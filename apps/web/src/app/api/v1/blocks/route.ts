import { blockSchema, displayName, type BlockedItem } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { audit } from '@/server/audit';
import { errors, parseJson, route } from '@/server/http';
import { closeConnectionBetween } from '@/server/safety/service';

export const GET = route({ profile: 'required' }, async ({ auth }): Promise<BlockedItem[]> => {
  const { data: rows } = await db().from('blocks').select('blocked_profile_id, created_at').eq('blocker_profile_id', auth.profile!.id).order('created_at', { ascending: false });
  const ids = (rows ?? []).map((r) => r.blocked_profile_id);
  const { data: profiles } = ids.length ? await db().from('profiles').select('id, first_name, last_name, name_visibility').in('id', ids) : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return (rows ?? []).map((r) => {
    const p = byId.get(r.blocked_profile_id);
    return { profileId: r.blocked_profile_id, displayName: displayName(p?.first_name, p?.last_name, (p?.name_visibility ?? 'initials') as 'full'), blockedAt: r.created_at };
  });
});

/** Block: hides both members from each other everywhere, withdraws interests, closes the connection. */
export const POST = route({ profile: 'required', rateLimit: { name: 'block', limit: 30, windowSec: 3600 } }, async ({ req, auth }) => {
  const body = await parseJson(req, blockSchema);
  const me = auth.profile!;
  if (body.targetProfileId === me.id) throw errors.validation('You cannot block yourself.');
  const { data: target } = await db().from('profiles').select('id').eq('id', body.targetProfileId).maybeSingle();
  if (!target) throw errors.notFound('Profile not found.');
  await db().from('blocks').upsert({ blocker_profile_id: me.id, blocked_profile_id: body.targetProfileId, reason: body.reason }, { onConflict: 'blocker_profile_id,blocked_profile_id', ignoreDuplicates: true });
  const now = new Date().toISOString();
  await db().from('interests').update({ status: 'withdrawn', responded_at: now }).eq('status', 'pending')
    .or(`and(sender_profile_id.eq.${me.id},receiver_profile_id.eq.${body.targetProfileId}),and(sender_profile_id.eq.${body.targetProfileId},receiver_profile_id.eq.${me.id})`);
  await closeConnectionBetween(me.id, body.targetProfileId, me.id, 'blocked');
  await db().from('shortlists').delete().eq('owner_profile_id', me.id).eq('target_profile_id', body.targetProfileId);
  await db().from('recommendations').update({ status: 'passed' }).eq('profile_id', me.id).eq('candidate_profile_id', body.targetProfileId);
  await audit(auth, { action: 'member.block', entityType: 'profile', entityId: body.targetProfileId });
  return { blocked: true };
});

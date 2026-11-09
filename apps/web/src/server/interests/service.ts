import 'server-only';
import { displayName, type InterestItem, type InterestStatus, type SendInterestResult } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from '@/server/auth';
import { getSetting } from '@/server/config';
import { consumeDailyQuota, getPlanState } from '@/server/entitlements';
import { cursor, errors } from '@/server/http';
import { notify } from '@/server/notify';
import { buildCards, viewerBundle } from '@/server/discovery/cards';
import { createConnection, orderedPair } from '@/server/connections/service';
import { isBlockedBetween, raiseRiskSignal } from '@/server/safety/service';

type ProfileLite = { id: string; owner_user_id: string; first_name: string | null; last_name: string | null; name_visibility: string; status: string; visibility: string; gender: string | null };

async function profileLite(id: string): Promise<ProfileLite | null> {
  const { data } = await db().from('profiles').select('id, owner_user_id, first_name, last_name, name_visibility, status, visibility, gender').eq('id', id).maybeSingle();
  return data;
}
const nameOf = (p: ProfileLite) => displayName(p.first_name, p.last_name, p.name_visibility as 'full');

async function markRecommendation(profileId: string, candidateId: string, status: 'interested' | 'shortlisted' | 'passed' | 'viewed') {
  await db().from('recommendations').update({ status }).eq('profile_id', profileId).eq('candidate_profile_id', candidateId);
}

/** Accept a pending interest addressed to `me`. Creates the connection. */
async function acceptInterest(interestId: string, sender: ProfileLite, receiver: ProfileLite): Promise<{ connectionId: string; conversationId: string }> {
  const { data: updated } = await db()
    .from('interests')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', interestId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (!updated) throw errors.conflict('This interest is no longer pending.');
  const conn = await createConnection(sender.id, receiver.id, interestId);
  await notify({
    userId: sender.owner_user_id,
    category: 'connections',
    templateKey: 'interest_accepted',
    vars: { receiverName: nameOf(receiver) },
    data: { href: `/app/connections/${conn.connectionId}`, connectionId: conn.connectionId },
  });
  return conn;
}

export async function sendInterest(auth: AuthContext, receiverId: string, message: string | null): Promise<SendInterestResult> {
  const me = auth.profile!;
  if (receiverId === me.id) throw errors.validation('You cannot send an interest to yourself.');
  const [sender, receiver] = await Promise.all([profileLite(me.id), profileLite(receiverId)]);
  if (!sender || !receiver) throw errors.notFound('Profile not found.');
  if (receiver.status !== 'active' || receiver.visibility !== 'members' || (await isBlockedBetween(me.id, receiverId))) {
    throw errors.notFound('This profile is not available.');
  }
  const { data: owner } = await db().from('app_users').select('status').eq('id', receiver.owner_user_id).maybeSingle();
  if (owner?.status !== 'active') throw errors.notFound('This profile is not available.');

  const { data: rprefs } = await db().from('partner_preferences').select('seeking_genders').eq('profile_id', receiverId).maybeSingle();
  if (rprefs?.seeking_genders?.length && sender.gender && !rprefs.seeking_genders.includes(sender.gender)) {
    throw errors.forbidden('This member’s preferences don’t include profiles like yours, so interests can’t be sent.');
  }

  const [a, b] = orderedPair(me.id, receiverId);
  const { data: conn } = await db().from('connections').select('id, status').eq('profile_a', a).eq('profile_b', b).maybeSingle();
  if (conn?.status === 'active') throw errors.conflict('You are already connected.');

  const { data: pending } = await db()
    .from('interests')
    .select('id, sender_profile_id')
    .eq('status', 'pending')
    .or(`and(sender_profile_id.eq.${me.id},receiver_profile_id.eq.${receiverId}),and(sender_profile_id.eq.${receiverId},receiver_profile_id.eq.${me.id})`);
  if (pending?.some((p) => p.sender_profile_id === me.id)) throw errors.conflict('You have already expressed interest.');
  const theirs = pending?.find((p) => p.sender_profile_id === receiverId);
  if (theirs) {
    // They already expressed interest in me — sending back means mutual interest.
    const c = await acceptInterest(theirs.id, receiver, sender);
    await markRecommendation(me.id, receiverId, 'interested');
    return { interestId: theirs.id, status: 'accepted', connectionId: c.connectionId, conversationId: c.conversationId, autoAccepted: true };
  }

  // Safety: hourly velocity limit with a review signal (not an automated judgement).
  const safety = await getSetting('safety', { max_interests_per_hour: 20 });
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db().from('interests').select('id', { count: 'exact', head: true }).eq('sender_profile_id', me.id).gte('created_at', since);
  if ((count ?? 0) >= safety.max_interests_per_hour) {
    await raiseRiskSignal({ userId: auth.userId, profileId: me.id, kind: 'mass_interests', severity: 2, details: { lastHour: count } });
    throw errors.rateLimited('You have sent many interests in the last hour. Please take a little time before sending more.');
  }

  const plan = await getPlanState(auth.userId);
  await consumeDailyQuota(auth.userId, 'interests', plan.entitlements.interests_per_day, 'Interests');

  const settings = await getSetting('interests', { expiry_days: 30 });
  const { data: created, error } = await db()
    .from('interests')
    .insert({
      sender_profile_id: me.id,
      receiver_profile_id: receiverId,
      message,
      sent_by_user_id: auth.userId,
      expires_at: new Date(Date.now() + settings.expiry_days * 86400_000).toISOString(),
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') throw errors.conflict('You have already expressed interest.');
    throw error;
  }
  await markRecommendation(me.id, receiverId, 'interested');
  await notify({
    userId: receiver.owner_user_id,
    category: 'interests',
    templateKey: 'interest_received',
    vars: { senderName: nameOf(sender) },
    data: { href: '/app/interests', interestId: created.id },
  });
  return { interestId: created.id, status: 'pending', connectionId: null, conversationId: null, autoAccepted: false };
}

export async function respondInterest(auth: AuthContext, interestId: string, action: 'accept' | 'decline' | 'withdraw') {
  const me = auth.profile!;
  const { data: it } = await db().from('interests').select('*').eq('id', interestId).maybeSingle();
  if (!it || (it.sender_profile_id !== me.id && it.receiver_profile_id !== me.id)) throw errors.notFound('Interest not found.');
  if (it.status !== 'pending') throw errors.conflict('This interest is no longer pending.');
  if (new Date(it.expires_at).getTime() < Date.now()) {
    await db().from('interests').update({ status: 'expired' }).eq('id', it.id).eq('status', 'pending');
    throw errors.conflict('This interest has expired.');
  }

  if (action === 'withdraw') {
    if (it.sender_profile_id !== me.id) throw errors.forbidden('Only the sender can withdraw an interest.');
    await db().from('interests').update({ status: 'withdrawn', responded_at: new Date().toISOString() }).eq('id', it.id).eq('status', 'pending');
    return { status: 'withdrawn' as InterestStatus, connectionId: null, conversationId: null };
  }
  if (it.receiver_profile_id !== me.id) throw errors.forbidden('Only the recipient can respond to this interest.');

  if (action === 'decline') {
    await db().from('interests').update({ status: 'declined', responded_at: new Date().toISOString() }).eq('id', it.id).eq('status', 'pending');
    return { status: 'declined' as InterestStatus, connectionId: null, conversationId: null };
  }

  if (await isBlockedBetween(it.sender_profile_id, me.id)) throw errors.notFound('This profile is not available.');
  const [sender, receiver] = await Promise.all([profileLite(it.sender_profile_id), profileLite(me.id)]);
  if (!sender || !receiver || sender.status === 'deleted' || sender.status === 'suspended') throw errors.notFound('This profile is not available.');
  const conn = await acceptInterest(it.id, sender, receiver);
  return { status: 'accepted' as InterestStatus, ...conn };
}

export async function listInterests(auth: AuthContext, q: { direction: 'received' | 'sent' | 'all'; status?: InterestStatus; cursor?: string; limit: number }) {
  const me = auth.profile!;
  let query = db().from('interests').select('*').order('created_at', { ascending: false }).limit(q.limit + 1);
  if (q.direction === 'received') query = query.eq('receiver_profile_id', me.id);
  else if (q.direction === 'sent') query = query.eq('sender_profile_id', me.id);
  else query = query.or(`sender_profile_id.eq.${me.id},receiver_profile_id.eq.${me.id}`);
  if (q.status) query = query.eq('status', q.status);
  const c = cursor.decode<{ t: string }>(q.cursor);
  if (c) query = query.lt('created_at', c.t);
  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  const page = rows.slice(0, q.limit);
  const viewer = await viewerBundle(me.id);
  const cards = await buildCards(viewer, page.map((r) => (r.sender_profile_id === me.id ? r.receiver_profile_id : r.sender_profile_id)));
  const items: InterestItem[] = [];
  for (const r of page) {
    const otherId = r.sender_profile_id === me.id ? r.receiver_profile_id : r.sender_profile_id;
    const card = cards.get(otherId);
    if (!card) continue; // profile no longer viewable (blocked, deleted, hidden)
    items.push({
      id: r.id,
      direction: r.sender_profile_id === me.id ? 'sent' : 'received',
      status: r.status as InterestStatus,
      message: r.message,
      createdAt: r.created_at,
      respondedAt: r.responded_at,
      expiresAt: r.expires_at,
      profile: card,
    });
  }
  const last = page[page.length - 1];
  return { items, nextCursor: rows.length > q.limit && last ? cursor.encode({ t: last.created_at }) : null };
}

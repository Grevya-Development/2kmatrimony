import 'server-only';
import { db } from '@/lib/supabase/admin';
import { errors } from '@/server/http';

export const orderedPair = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);

/**
 * Create (or reopen) the connection for a mutual interest, with its
 * conversation, both participants and a system greeting. Idempotent.
 */
export async function createConnection(p1: string, p2: string, originInterestId: string | null): Promise<{ connectionId: string; conversationId: string }> {
  const c = db();
  const [a, b] = orderedPair(p1, p2);
  const { data: existing } = await c.from('connections').select('id, status').eq('profile_a', a).eq('profile_b', b).maybeSingle();
  let connectionId: string;
  let reopened = false;
  if (existing) {
    connectionId = existing.id;
    if (existing.status !== 'active') {
      reopened = true;
      await c.from('connections').update({ status: 'active', closed_at: null, closed_by_profile_id: null, closed_reason: null, origin_interest_id: originInterestId }).eq('id', connectionId);
    }
  } else {
    const { data, error } = await c.from('connections').insert({ profile_a: a, profile_b: b, origin_interest_id: originInterestId }).select('id').single();
    if (error) {
      if (error.code === '23505') return createConnection(p1, p2, originInterestId); // raced
      throw error;
    }
    connectionId = data.id;
  }

  const { data: conv, error: convErr } = await c
    .from('conversations')
    .upsert({ connection_id: connectionId, is_locked: false }, { onConflict: 'connection_id' })
    .select('id')
    .single();
  if (convErr || !conv) throw convErr ?? new Error('conversation create failed');

  const { data: owners } = await c.from('profiles').select('id, owner_user_id').in('id', [a, b]);
  if (!owners || owners.length !== 2) throw errors.notFound('Profile not found.');
  await c.from('conversation_participants').upsert(
    owners.map((o) => ({ conversation_id: conv.id, profile_id: o.id, user_id: o.owner_user_id })),
    { onConflict: 'conversation_id,profile_id', ignoreDuplicates: true },
  );
  if (!existing || reopened) {
    await c.from('messages').insert({
      conversation_id: conv.id,
      kind: 'system',
      body: reopened ? 'You are connected again.' : 'You are now connected. Say hello whenever you are ready.',
    });
  }
  return { connectionId, conversationId: conv.id };
}

/** Membership check returning the connection and the other profile id. */
export async function getMemberConnection(connectionId: string, myProfileId: string) {
  const { data } = await db().from('connections').select('id, profile_a, profile_b, status, created_at, conversations(id, is_locked, last_message_at, last_message_preview)').eq('id', connectionId).maybeSingle();
  if (!data || (data.profile_a !== myProfileId && data.profile_b !== myProfileId)) throw errors.notFound('Connection not found.');
  return { ...data, otherProfileId: data.profile_a === myProfileId ? data.profile_b : data.profile_a };
}

/** Unread message counts per conversation for a participant. */
export async function unreadCounts(myProfileId: string, conversationIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (conversationIds.length === 0) return out;
  const c = db();
  const { data: parts } = await c.from('conversation_participants').select('conversation_id, last_read_at').eq('profile_id', myProfileId).in('conversation_id', conversationIds);
  await Promise.all(
    (parts ?? []).map(async (p) => {
      let q = c
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', p.conversation_id)
        .is('deleted_at', null)
        .or(`sender_profile_id.is.null,sender_profile_id.neq.${myProfileId}`)
        .neq('kind', 'system');
      if (p.last_read_at) q = q.gt('created_at', p.last_read_at);
      const { count } = await q;
      out.set(p.conversation_id, count ?? 0);
    }),
  );
  return out;
}

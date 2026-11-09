import 'server-only';
import { displayName, type ConversationItem, type MessageItem, type SendMessageInput } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from '@/server/auth';
import { getSetting, isEnabled } from '@/server/config';
import { cursor, errors } from '@/server/http';
import { assertUploaded, signedUrls } from '@/server/media';
import { notify } from '@/server/notify';
import { rateLimit } from '@/server/rate-limit';
import { buildCards, viewerBundle } from '@/server/discovery/cards';
import { unreadCounts } from '@/server/connections/service';
import { raiseRiskSignal } from '@/server/safety/service';
import { assessMessage } from './spam';

type MessageRow = { id: string; conversation_id: string; sender_profile_id: string | null; kind: string; body: string | null; media_path: string | null; client_id: string | null; created_at: string };

export async function requireParticipant(conversationId: string, myProfileId: string) {
  const { data } = await db()
    .from('conversation_participants')
    .select('conversation_id, profile_id, muted, archived, last_read_at, conversations(id, connection_id, is_locked)')
    .eq('conversation_id', conversationId)
    .eq('profile_id', myProfileId)
    .maybeSingle();
  if (!data) throw errors.notFound('Conversation not found.');
  const conv = data.conversations as unknown as { id: string; connection_id: string; is_locked: boolean };
  return { participant: data, conversation: conv };
}

async function toMessageItems(rows: MessageRow[], myProfileId: string): Promise<MessageItem[]> {
  const urls = await signedUrls('chat-media', rows.filter((r) => r.media_path).map((r) => r.media_path!));
  return rows.map((r) => ({
    id: r.id,
    conversationId: r.conversation_id,
    senderProfileId: r.sender_profile_id,
    kind: r.kind as MessageItem['kind'],
    body: r.body,
    mediaUrl: r.media_path ? urls.get(r.media_path) ?? null : null,
    clientId: r.client_id,
    createdAt: r.created_at,
    isMine: r.sender_profile_id === myProfileId,
  }));
}

export async function listConversations(auth: AuthContext, includeArchived: boolean): Promise<ConversationItem[]> {
  const me = auth.profile!;
  let q = db().from('conversation_participants').select('conversation_id, muted, archived, conversations(id, connection_id, is_locked, last_message_at, last_message_preview)').eq('profile_id', me.id);
  if (!includeArchived) q = q.eq('archived', false);
  const { data: mine, error } = await q;
  if (error) throw error;
  const convIds = (mine ?? []).map((m) => m.conversation_id);
  if (convIds.length === 0) return [];
  const { data: others } = await db().from('conversation_participants').select('conversation_id, profile_id').in('conversation_id', convIds).neq('profile_id', me.id);
  const otherBy = new Map((others ?? []).map((o) => [o.conversation_id, o.profile_id]));
  const viewer = await viewerBundle(me.id);
  const [cards, unread] = await Promise.all([buildCards(viewer, [...otherBy.values()]), unreadCounts(me.id, convIds)]);
  const items: ConversationItem[] = [];
  for (const m of mine ?? []) {
    const conv = m.conversations as unknown as { id: string; connection_id: string; is_locked: boolean; last_message_at: string | null; last_message_preview: string | null };
    const other = cards.get(otherBy.get(m.conversation_id) ?? '');
    if (!other) continue;
    items.push({
      id: conv.id,
      connectionId: conv.connection_id,
      isLocked: conv.is_locked,
      other,
      lastMessageAt: conv.last_message_at,
      lastMessagePreview: conv.last_message_preview,
      unreadCount: unread.get(conv.id) ?? 0,
      muted: m.muted,
      archived: m.archived,
    });
  }
  return items.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
}

export async function getConversation(auth: AuthContext, conversationId: string): Promise<ConversationItem> {
  const all = await listConversations(auth, true);
  const found = all.find((c) => c.id === conversationId);
  if (!found) throw errors.notFound('Conversation not found.');
  return found;
}

export async function listMessages(auth: AuthContext, conversationId: string, opts: { cursor?: string; limit: number }) {
  const me = auth.profile!;
  await requireParticipant(conversationId, me.id);
  let q = db()
    .from('messages')
    .select('id, conversation_id, sender_profile_id, kind, body, media_path, client_id, created_at')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(opts.limit + 1);
  const c = cursor.decode<{ t: string }>(opts.cursor);
  if (c) q = q.lt('created_at', c.t);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as MessageRow[];
  const page = rows.slice(0, opts.limit);
  const { data: other } = await db().from('conversation_participants').select('last_read_at').eq('conversation_id', conversationId).neq('profile_id', me.id).maybeSingle();
  const last = page[page.length - 1];
  return {
    items: await toMessageItems(page, me.id),
    otherLastReadAt: other?.last_read_at ?? null,
    nextCursor: rows.length > opts.limit && last ? cursor.encode({ t: last.created_at }) : null,
  };
}

export async function sendMessage(auth: AuthContext, conversationId: string, input: SendMessageInput): Promise<MessageItem> {
  const me = auth.profile!;
  const { conversation } = await requireParticipant(conversationId, me.id);
  const c = db();

  // Idempotency: a retried send returns the original message.
  const { data: dup } = await c.from('messages').select('id, conversation_id, sender_profile_id, kind, body, media_path, client_id, created_at').eq('conversation_id', conversationId).eq('client_id', input.clientId).maybeSingle();
  if (dup) return (await toMessageItems([dup as MessageRow], me.id))[0]!;

  if (conversation.is_locked) throw errors.conflict('This conversation is closed.');
  const { data: conn } = await c.from('connections').select('status').eq('id', conversation.connection_id).maybeSingle();
  if (conn?.status !== 'active') throw errors.conflict('This conversation is closed.');

  const { data: otherPart } = await c.from('conversation_participants').select('profile_id, user_id, muted').eq('conversation_id', conversationId).neq('profile_id', me.id).maybeSingle();
  if (!otherPart) throw errors.notFound('Conversation not found.');
  const { data: otherProfile } = await c.from('profiles').select('messaging_policy').eq('id', otherPart.profile_id).maybeSingle();
  if (otherProfile?.messaging_policy === 'connections_verified' && !me.is_identity_verified) {
    throw errors.forbidden('This member only accepts messages from ID-verified members. Verify your ID to message them.');
  }

  const safety = await getSetting('safety', { max_messages_per_minute: 20 });
  await rateLimit(`msg:${auth.userId}`, safety.max_messages_per_minute, 60);

  let body: string | null = null;
  let mediaPath: string | null = null;
  if (input.kind === 'image') {
    if (!(await isEnabled('chat_images'))) throw errors.featureDisabled('Image sharing is currently unavailable.');
    mediaPath = input.mediaPath!;
    await assertUploaded('chat-media', mediaPath, conversationId);
    body = input.body?.trim() || null;
  } else {
    body = input.body!.trim();
  }

  let flagged = false;
  if (body) {
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const [{ count: senderCount }, { count: identical }] = await Promise.all([
      c.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conversationId).eq('sender_profile_id', me.id),
      c.from('messages').select('id', { count: 'exact', head: true }).eq('sender_profile_id', me.id).eq('body', body).gte('created_at', since),
    ]);
    const verdict = assessMessage(body, { senderMessageCount: senderCount ?? 0, recentIdenticalCount: identical ?? 0 });
    if (verdict.flagged) {
      flagged = true;
      await raiseRiskSignal({ userId: auth.userId, profileId: me.id, kind: 'spam_messaging', severity: verdict.severe ? 4 : 2, details: { reasons: verdict.reasons, conversationId } });
    }
    if (verdict.severe) throw errors.rateLimited('This message looks like a repeated message. Please write something personal.');
  }

  const { data: row, error } = await c
    .from('messages')
    .insert({ conversation_id: conversationId, sender_profile_id: me.id, sender_user_id: auth.userId, kind: input.kind, body, media_path: mediaPath, client_id: input.clientId, flagged })
    .select('id, conversation_id, sender_profile_id, kind, body, media_path, client_id, created_at')
    .single();
  if (error) {
    if (error.code === '23505') return sendMessage(auth, conversationId, input);
    throw error;
  }
  await c.from('conversation_participants').update({ last_read_at: row.created_at }).eq('conversation_id', conversationId).eq('profile_id', me.id);

  if (!otherPart.muted) {
    await notify({
      userId: otherPart.user_id,
      category: 'messages',
      templateKey: 'new_message',
      skipInApp: true,
      vars: { senderName: displayName(me.first_name, me.last_name, me.name_visibility as 'full'), preview: input.kind === 'image' ? '📷 Photo' : (body ?? '').slice(0, 80) },
      data: { href: `/app/messages/${conversationId}`, conversationId },
    });
  }
  return (await toMessageItems([row as MessageRow], me.id))[0]!;
}

export async function markRead(auth: AuthContext, conversationId: string): Promise<{ lastReadAt: string }> {
  await requireParticipant(conversationId, auth.profile!.id);
  const now = new Date().toISOString();
  await db().from('conversation_participants').update({ last_read_at: now }).eq('conversation_id', conversationId).eq('profile_id', auth.profile!.id);
  return { lastReadAt: now };
}

export async function updateParticipant(auth: AuthContext, conversationId: string, patch: { muted?: boolean; archived?: boolean }) {
  await requireParticipant(conversationId, auth.profile!.id);
  await db().from('conversation_participants').update(patch).eq('conversation_id', conversationId).eq('profile_id', auth.profile!.id);
  return { ok: true };
}

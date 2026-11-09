import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { ConversationItem, MessageItem, SendInterestResult } from '@2k/shared';
import { POST as sendInterest } from '@/app/api/v1/interests/route';
import { POST as respond } from '@/app/api/v1/interests/[id]/route';
import { GET as listConversations } from '@/app/api/v1/conversations/route';
import { GET as listMessages, POST as sendMessage } from '@/app/api/v1/conversations/[id]/messages/route';
import { POST as markRead } from '@/app/api/v1/conversations/[id]/read/route';
import { PATCH as updateConv } from '@/app/api/v1/conversations/[id]/route';
import { POST as chatUpload } from '@/app/api/v1/chat-uploads/route';
import { assessMessage } from '@/server/messaging/spam';
import { admin, call, request } from './helpers';
import { deleteUsers, seedMember, type SeededMember } from './discovery.fixtures';

let a: SeededMember, b: SeededMember, outsider: SeededMember, strict: SeededMember;
let conversationId = '';
let strictConversation = '';

async function connect(x: SeededMember, y: SeededMember): Promise<string> {
  const s = await call<SendInterestResult>(sendInterest, request('/api/v1/interests', { token: x.token, body: { receiverProfileId: y.profileId } }));
  const id = s.body.data!.interestId;
  const r = await call<{ conversationId: string }>(respond, request(`/api/v1/interests/${id}`, { token: y.token, body: { action: 'accept' } }), { id });
  return r.body.data!.conversationId;
}

beforeAll(async () => {
  [a, b, outsider, strict] = await Promise.all([
    seedMember({ label: 'msg-a', gender: 'female', seeking: 'male' }),
    seedMember({ label: 'msg-b', gender: 'male', seeking: 'female' }),
    seedMember({ label: 'msg-out', gender: 'male', seeking: 'female' }),
    seedMember({ label: 'msg-strict', gender: 'male', seeking: 'female', messagingPolicy: 'connections_verified' }),
  ]);
  conversationId = await connect(a, b);
  strictConversation = await connect(a, strict);
});
afterAll(() => deleteUsers([a, b, outsider, strict]));

const post = (u: SeededMember, conv: string, body: Record<string, unknown>) =>
  call<MessageItem>(sendMessage, request(`/api/v1/conversations/${conv}/messages`, { token: u.token, body }), { id: conv });

describe('messaging', () => {
  it('sends text and is idempotent by clientId', async () => {
    const r1 = await post(a, conversationId, { clientId: 'client-0001', body: 'Hi! Nice to connect.' });
    expect(r1.status).toBe(201);
    expect(r1.body.data!.isMine).toBe(true);
    const r2 = await post(a, conversationId, { clientId: 'client-0001', body: 'Hi! Nice to connect.' });
    expect(r2.body.data!.id).toBe(r1.body.data!.id);
  });

  it('shows unread counts and clears them on read', async () => {
    const before = await call<ConversationItem[]>(listConversations, request('/api/v1/conversations', { token: b.token }));
    const conv = before.body.data!.find((c) => c.id === conversationId)!;
    expect(conv.unreadCount).toBe(1);
    expect(conv.other.id).toBe(a.profileId);
    await call(markRead, request(`/api/v1/conversations/${conversationId}/read`, { token: b.token, method: 'POST' }), { id: conversationId });
    const after = await call<ConversationItem[]>(listConversations, request('/api/v1/conversations', { token: b.token }));
    expect(after.body.data!.find((c) => c.id === conversationId)!.unreadCount).toBe(0);
  });

  it('lists messages newest first for participants only', async () => {
    const r = await call<{ items: MessageItem[]; otherLastReadAt: string | null }>(listMessages, request(`/api/v1/conversations/${conversationId}/messages`, { token: b.token }), { id: conversationId });
    expect(r.body.data!.items[0]!.body).toBe('Hi! Nice to connect.');
    expect(r.body.data!.items.at(-1)!.kind).toBe('system');
    const denied = await call(listMessages, request(`/api/v1/conversations/${conversationId}/messages`, { token: outsider.token }), { id: conversationId });
    expect(denied.status).toBe(404);
    expect((await post(outsider, conversationId, { clientId: 'client-0002', body: 'hey' })).status).toBe(404);
  });

  it('RLS lets participants (not outsiders) read messages directly for realtime', async () => {
    const as = (token: string) => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
    const { data: mine } = await as(b.token).from('messages').select('id').eq('conversation_id', conversationId);
    expect(mine!.length).toBeGreaterThanOrEqual(2);
    const { data: theirs } = await as(outsider.token).from('messages').select('id').eq('conversation_id', conversationId);
    expect(theirs).toEqual([]);
    const { error } = await as(b.token).from('messages').insert({ conversation_id: conversationId, body: 'direct write', kind: 'text' });
    expect(error).not.toBeNull();
  });

  it('flags contact details in early messages for review but still delivers', async () => {
    const r = await post(b, conversationId, { clientId: 'client-0003', body: 'Call me on +91 98765 43210' });
    expect(r.status).toBe(201);
    const { data: msg } = await admin().from('messages').select('flagged').eq('id', r.body.data!.id).single();
    expect(msg?.flagged).toBe(true);
    const { data: sig } = await admin().from('risk_signals').select('kind').eq('user_id', b.userId).eq('kind', 'spam_messaging');
    expect(sig?.length).toBe(1);
  });

  it('respects "verified members only" messaging policy', async () => {
    const r = await post(a, strictConversation, { clientId: 'client-0004', body: 'Hello' });
    expect(r.status).toBe(403);
  });

  it('mute/archive and image upload tickets', async () => {
    const m = await call(updateConv, request(`/api/v1/conversations/${conversationId}`, { token: b.token, method: 'PATCH', body: { muted: true } }), { id: conversationId });
    expect(m.status).toBe(200);
    const t = await call<{ path: string; signedUrl: string }>(chatUpload, request('/api/v1/chat-uploads', { token: a.token, body: { conversationId, contentType: 'image/jpeg', sizeBytes: 2048 } }));
    expect(t.status).toBe(200);
    expect(t.body.data!.path.startsWith(`${conversationId}/`)).toBe(true);
    const bad = await post(a, conversationId, { clientId: 'client-0005', kind: 'image', mediaPath: `${conversationId}/missing.jpg` });
    expect(bad.status).toBe(422);
  });

  it('rejects messages once the conversation is locked', async () => {
    await admin().from('conversations').update({ is_locked: true }).eq('id', conversationId);
    expect((await post(a, conversationId, { clientId: 'client-0006', body: 'still there?' })).status).toBe(409);
  });
});

describe('spam heuristics (unit)', () => {
  it('flags links early, payment language anytime, and repeated text', () => {
    expect(assessMessage('see www.example.com', { senderMessageCount: 0, recentIdenticalCount: 0 }).flagged).toBe(true);
    expect(assessMessage('see www.example.com', { senderMessageCount: 20, recentIdenticalCount: 0 }).flagged).toBe(false);
    expect(assessMessage('please send money via UPI', { senderMessageCount: 20, recentIdenticalCount: 0 }).reasons).toContain('payment_language');
    expect(assessMessage('hi', { senderMessageCount: 3, recentIdenticalCount: 4 }).severe).toBe(true);
    expect(assessMessage('How was your weekend?', { senderMessageCount: 1, recentIdenticalCount: 0 }).flagged).toBe(false);
  });
});

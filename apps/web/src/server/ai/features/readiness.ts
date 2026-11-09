import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { READINESS_TOPICS, READINESS_TOPIC_LABELS, type ReadinessNote, type ReadinessTopic } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from '@/server/auth';
import { errors } from '@/server/http';
import { aiAvailable, streamChat } from '../client';
import { registerPrompt } from '../prompts';
import { hasConsent } from './common';

registerPrompt(
  'readiness_assistant',
  `You are a thoughtful companion helping a member privately reflect on an important topic before discussing it with a prospective partner (the topic is given at the start of the conversation).
Help them clarify their own views, priorities and flexibility; offer balanced perspectives and respectful ways to raise the topic; suggest a few questions they might ask.
You never decide whether anyone is "ready for marriage", never judge their choices, and never give legal, medical or financial advice beyond general considerations (suggest a professional when appropriate).
Be warm and concise (under 160 words), ask at most one question back, and use the member's language.`,
);

const HISTORY = 16;

export async function readinessState(auth: AuthContext): Promise<{ notes: ReadinessNote[]; aiAvailable: boolean; consentGranted: boolean }> {
  const profileId = auth.profile!.id;
  const [{ data }, ai, consent] = await Promise.all([
    db().from('readiness_notes').select('*').eq('profile_id', profileId),
    aiAvailable('readiness_assistant'),
    hasConsent(auth.userId, 'ai_processing'),
  ]);
  const byTopic = new Map((data ?? []).map((r) => [r.topic, r]));
  const notes = READINESS_TOPICS.map((topic) => {
    const r = byTopic.get(topic);
    return { topic, myView: r?.my_view ?? null, questionsToAsk: r?.questions_to_ask ?? [], exploredAt: r?.explored_at ?? null, updatedAt: r?.updated_at ?? null };
  });
  return { notes, aiAvailable: ai, consentGranted: consent };
}

export async function saveReadinessNote(auth: AuthContext, input: { topic: ReadinessTopic; myView: string | null; questionsToAsk: string[] }): Promise<ReadinessNote> {
  const { data, error } = await db()
    .from('readiness_notes')
    .upsert(
      { profile_id: auth.profile!.id, topic: input.topic, my_view: input.myView, questions_to_ask: input.questionsToAsk, explored_at: new Date().toISOString() },
      { onConflict: 'profile_id,topic' },
    )
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('save failed');
  return { topic: data.topic as ReadinessTopic, myView: data.my_view, questionsToAsk: data.questions_to_ask, exploredAt: data.explored_at, updatedAt: data.updated_at };
}

async function topicThread(auth: AuthContext, topic: ReadinessTopic, create: boolean) {
  const c = db();
  const { data } = await c.from('ai_threads').select('id').eq('user_id', auth.userId).eq('kind', 'readiness').eq('topic', topic).maybeSingle();
  if (data || !create) return data?.id ?? null;
  const { data: created, error } = await c
    .from('ai_threads')
    .insert({ user_id: auth.userId, profile_id: auth.profile!.id, kind: 'readiness', topic, title: READINESS_TOPIC_LABELS[topic] })
    .select('id')
    .single();
  if (error || !created) throw error ?? new Error('thread create failed');
  return created.id;
}

export async function readinessHistory(auth: AuthContext, topic: ReadinessTopic): Promise<{ id: string; role: 'user' | 'assistant'; content: string; createdAt: string }[]> {
  const threadId = await topicThread(auth, topic, false);
  if (!threadId) return [];
  const { data } = await db().from('ai_thread_messages').select('id, role, content, created_at').eq('thread_id', threadId).order('created_at').limit(200);
  return (data ?? []).map((m) => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content, createdAt: m.created_at }));
}

/** Start a streamed readiness discussion turn. Persists both sides of the turn. */
export async function readinessChat(auth: AuthContext, topic: ReadinessTopic, message: string): Promise<ReadableStream<Uint8Array>> {
  if (!(await aiAvailable('readiness_assistant'))) throw errors.unconfigured('The AI readiness assistant');
  if (!(await hasConsent(auth.userId, 'ai_processing'))) throw errors.forbidden('Turn on AI processing in Settings → Privacy to use the assistant.');
  const threadId = (await topicThread(auth, topic, true))!;
  const c = db();
  const { data: history } = await c.from('ai_thread_messages').select('role, content').eq('thread_id', threadId).order('created_at', { ascending: false }).limit(HISTORY);
  const past = (history ?? []).reverse();
  await c.from('ai_thread_messages').insert({ thread_id: threadId, role: 'user', content: message });

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user', content: `Topic: ${READINESS_TOPIC_LABELS[topic]}. I would like to think this through privately.` },
    { role: 'assistant', content: 'Of course. Tell me what is on your mind about this, and we can explore it together.' },
    ...past.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: message },
  ];
  const { textStream, final } = await streamChat({ feature: 'readiness_assistant', userId: auth.userId, messages });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = textStream.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        controller.enqueue(value);
      }
      const { text } = await final;
      if (text.trim()) await c.from('ai_thread_messages').insert({ thread_id: threadId, role: 'assistant', content: text });
      await c.from('ai_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId);
      controller.close();
    },
  });
}

import * as React from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { READINESS_TOPIC_LABELS, READINESS_TOPICS, type ReadinessNote, type ReadinessTopic } from '@2k/shared';
import { api, ApiClientError, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { useQuery } from '@/hooks/queries';
import { colors, radius, space } from '@/theme';
import { Button, Card, Chip, ErrorState, Loading, Notice, Screen, Section, Text, TextField } from '@/components/ui';
import type { ReadinessState } from './index';

interface ChatMsg { id: string; role: 'user' | 'assistant'; content: string; createdAt: string }

export default function ReadinessTopicScreen() {
  const { topic: raw } = useLocalSearchParams<{ topic: string }>();
  const topic = (READINESS_TOPICS as readonly string[]).includes(raw) ? (raw as ReadinessTopic) : null;
  const qc = useQueryClient();
  const state = useQuery({ queryKey: ['readiness'], queryFn: () => api.get<ReadinessState>('/readiness') });
  const history = useQuery({ queryKey: ['readiness-chat', topic], queryFn: () => api.get<ChatMsg[]>('/readiness/chat', { topic: topic! }), enabled: !!topic });
  const note = state.data?.notes.find((n) => n.topic === topic);
  const [view, setView] = React.useState<string | null>(null);
  const [questions, setQuestions] = React.useState<string[] | null>(null);
  const [draftQ, setDraftQ] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [pending, setPending] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<'save' | 'chat' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (!topic) return <Screen edges={[]}><ErrorState message="Unknown topic." /></Screen>;
  const myView = view ?? note?.myView ?? '';
  const qs = questions ?? note?.questionsToAsk ?? [];
  const canChat = !!state.data?.aiAvailable && !!state.data.consentGranted;

  const save = async (nextQs = qs) => {
    setBusy('save'); setError(null);
    try {
      const saved = await api.put<ReadinessNote>('/readiness', { topic, myView: myView.trim() || null, questionsToAsk: nextQs });
      qc.setQueryData<ReadinessState>(['readiness'], (old) => old ? { ...old, notes: [...old.notes.filter((n) => n.topic !== topic), saved] } : old);
      haptic.success();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
  };

  const ask = async () => {
    const message = msg.trim();
    if (!message) return;
    setMsg(''); setPending(message); setBusy('chat'); setError(null);
    try {
      const res = await api.raw('/readiness/chat', { method: 'POST', body: { topic, message } });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
        throw new ApiClientError(res.status, (body?.error?.code as never) ?? 'internal_error', body?.error?.message ?? 'The assistant is unavailable right now.');
      }
      await res.text(); // reply is streamed and persisted server-side; read it fully, then reload history
      await history.refetch();
    } catch (e) { setError(errorMessage(e)); setMsg(message); } finally { setPending(null); setBusy(null); }
  };

  return (
    <Screen edges={[]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: READINESS_TOPIC_LABELS[topic] }} />
      {state.isLoading ? <Loading /> : (
        <>
          <Section title="My view">
            <TextField label="What I think and need" multiline maxLength={2000} value={myView} onChangeText={setView} placeholder="Write freely — only you can see this." />
          </Section>
          <Section title="Questions to ask a partner">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {qs.map((q) => <Chip key={q} label={q} onRemove={() => setQuestions(qs.filter((x) => x !== q))} />)}
            </View>
            <TextField label="Add a question" value={draftQ} onChangeText={setDraftQ} maxLength={300} returnKeyType="done"
              onSubmitEditing={() => { if (draftQ.trim() && qs.length < 15) { setQuestions([...qs, draftQ.trim()]); setDraftQ(''); } }} />
          </Section>
          <Button title="Save notes" onPress={() => save()} loading={busy === 'save'} />
          <Section title="Think it through">
            {!canChat ? <Notice>{state.data?.aiAvailable ? 'Enable AI features in Settings to talk this through.' : 'The discussion assistant is unavailable right now.'}</Notice> : (
              <>
                {history.isLoading ? <Loading /> : (history.data ?? []).map((m) => (
                  <View key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                    <Card padded={false} style={{ padding: space.md, backgroundColor: m.role === 'user' ? colors.emerald600 : colors.surface, borderRadius: radius.lg }}>
                      <Text style={{ color: m.role === 'user' ? colors.white : colors.ink }}>{m.content}</Text>
                    </Card>
                    {m.role === 'assistant' && qs.length < 15 && (
                      <Button title="Save a question from this" size="sm" variant="ghost" onPress={() => { const first = m.content.split('\n').find((l) => l.trim().endsWith('?'))?.replace(/^[-•\d.\s]+/, '').trim(); if (first) { const next = [...qs, first.slice(0, 300)]; setQuestions(next); void save(next); } }} />
                    )}
                  </View>
                ))}
                {pending && <View style={{ alignSelf: 'flex-end', maxWidth: '88%', opacity: 0.6 }}><Card padded={false} style={{ padding: space.md, backgroundColor: colors.emerald600 }}><Text style={{ color: colors.white }}>{pending}</Text></Card><Text variant="small">Thinking…</Text></View>}
                <TextField label="Ask or reflect" multiline maxLength={2000} value={msg} onChangeText={setMsg} placeholder="e.g. How do couples usually split finances?" />
                <Button title="Send" onPress={ask} loading={busy === 'chat'} disabled={!msg.trim()} />
              </>
            )}
          </Section>
          {error && <ErrorState message={error} />}
        </>
      )}
    </Screen>
  );
}

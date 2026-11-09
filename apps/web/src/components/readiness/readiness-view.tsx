'use client';
import * as React from 'react';
import Link from 'next/link';
import { Check, Plus, Send, X } from 'lucide-react';
import { READINESS_TOPIC_LABELS, type ReadinessNote, type ReadinessTopic } from '@2k/shared';
import { AiFeedback } from '@/components/ai/feedback';
import { Button, ErrorState, Field, Input, Notice, Skeleton, Textarea } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { cn } from '@/lib/utils';

type State = { notes: ReadinessNote[]; aiAvailable: boolean; consentGranted: boolean };
type Msg = { id: string; role: 'user' | 'assistant'; content: string };

const PROMPTS: Record<ReadinessTopic, string> = {
  finances: 'How would you like to handle money, savings and family financial responsibilities?',
  career: 'How do you see both careers fitting together over time?',
  children: 'Do you want children, and if so, when and how many?',
  family_involvement: 'What role would you like each family to play in your married life?',
  household: 'How would you like to share chores, cooking and running the home?',
  living_arrangements: 'Where and with whom would you like to live after marriage?',
  relocation: 'Would you move cities or countries — for work, family or adventure?',
  lifestyle: 'What does a good week look like for you — social, quiet, active?',
  independence: 'How much personal time and space do you need?',
  future_ambitions: 'What are you hoping to build over the next ten years?',
  conflict_resolution: 'What helps you work through disagreements respectfully?',
};

function TopicChat({ topic, enabled }: { topic: ReadinessTopic; enabled: boolean }) {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState('');
  const [streaming, setStreaming] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMessages([]);
    if (enabled) api<Msg[]>(`/readiness/chat?topic=${topic}`).then(setMessages).catch(() => setMessages([]));
  }, [topic, enabled]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = input.trim();
    if (!message || streaming !== null) return;
    setInput(''); setError(null);
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: 'user', content: message }]);
    setStreaming('');
    try {
      const res = await fetch('/api/v1/readiness/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topic, message }) });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
        throw new Error(j?.error?.message ?? 'The assistant is unavailable right now.');
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = '';
      for (;;) { const { done, value } = await reader.read(); if (done) break; acc += dec.decode(value, { stream: true }); setStreaming(acc); }
      setMessages((m) => [...m, { id: `local-a-${Date.now()}`, role: 'assistant', content: acc }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally { setStreaming(null); }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <h3 className="font-serif text-xl">Think it through</h3>
      <div className="max-h-96 space-y-3 overflow-y-auto" aria-live="polite">
        {messages.length === 0 && streaming === null && <p className="text-sm text-muted">{PROMPTS[topic]} Share your thoughts — the assistant offers balanced perspectives and questions you might ask. It never decides whether you’re “ready”.</p>}
        {messages.map((m) => <div key={m.id} className={cn('whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed', m.role === 'user' ? 'ml-8 bg-ink text-canvas' : 'mr-8 bg-surface-2 text-ink')}>{m.content}</div>)}
        {streaming !== null && <div className="mr-8 whitespace-pre-wrap rounded-2xl bg-surface-2 px-4 py-3 text-sm">{streaming || '…'}</div>}
      </div>
      {error && <ErrorState message={error} />}
      <form onSubmit={send} className="flex gap-2">
        <label htmlFor="rd-input" className="sr-only">Your thoughts</label>
        <Input id="rd-input" value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} placeholder="What’s on your mind about this?" />
        <Button type="submit" size="icon" aria-label="Send" disabled={!input.trim() || streaming !== null}><Send /></Button>
      </form>
      {messages.some((m) => m.role === 'assistant') && <AiFeedback feature="readiness_assistant" referenceId={topic} />}
    </div>
  );
}

function NotesEditor({ note, onSaved }: { note: ReadinessNote; onSaved: (n: ReadinessNote) => void }) {
  const [view, setView] = React.useState(note.myView ?? '');
  const [questions, setQuestions] = React.useState<string[]>(note.questionsToAsk);
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => { setView(note.myView ?? ''); setQuestions(note.questionsToAsk); setSaved(false); }, [note]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      onSaved(await api<ReadinessNote>('/readiness', { method: 'PUT', body: { topic: note.topic, myView: view.trim() || null, questionsToAsk: questions } }));
      setSaved(true);
    } catch (err) { setError(err instanceof ApiClientError ? err.message : 'Could not save.'); }
    finally { setBusy(false); }
  };
  const addQ = () => { const q = draft.trim(); if (q && questions.length < 15) { setQuestions([...questions, q]); setDraft(''); } };

  return (
    <form onSubmit={save} className="space-y-5 rounded-2xl border border-line bg-surface p-5">
      <h3 className="font-serif text-xl">My private notes</h3>
      <Field label="Where I stand" htmlFor="rd-view" hint="Only you can see this."><Textarea maxLength={2000} value={view} onChange={(e) => setView(e.target.value)} placeholder={PROMPTS[note.topic]} /></Field>
      <div className="space-y-2">
        <p className="text-sm font-medium text-ink-2">Questions I’d like to ask a partner</p>
        <ul className="space-y-1.5">{questions.map((q, i) => (
          <li key={`${q}-${i}`} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
            <span className="flex-1">{q}</span>
            <button type="button" aria-label={`Remove question: ${q}`} onClick={() => setQuestions(questions.filter((_, j) => j !== i))} className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
          </li>
        ))}</ul>
        <div className="flex gap-2">
          <label htmlFor="rd-q" className="sr-only">New question</label>
          <Input id="rd-q" value={draft} maxLength={300} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addQ(); } }} placeholder="Add a question" />
          <Button type="button" variant="secondary" size="icon" aria-label="Add question" onClick={addQ}><Plus /></Button>
        </div>
      </div>
      {error && <ErrorState message={error} />}
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="flex items-center gap-1 text-sm text-success"><Check className="h-4 w-4" />Saved</span>}
        <Button type="submit" loading={busy}>Save notes</Button>
      </div>
    </form>
  );
}

export function ReadinessView() {
  const [state, setState] = React.useState<State | null>(null);
  const [topic, setTopic] = React.useState<ReadinessTopic>('finances');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api<State>('/readiness').then(setState).catch((e) => setError(e instanceof ApiClientError ? e.message : 'Could not load.'));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!state) return <div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  const note = state.notes.find((n) => n.topic === topic)!;
  const explored = state.notes.filter((n) => n.exploredAt).length;
  const aiReady = state.aiAvailable && state.consentGranted;

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted">{explored} of {state.notes.length} topics explored</p>
      <div role="tablist" aria-label="Topics" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {state.notes.map((n) => (
          <button key={n.topic} role="tab" aria-selected={topic === n.topic} type="button" onClick={() => setTopic(n.topic)}
            className={cn('rounded-2xl border p-4 text-left transition-colors', topic === n.topic ? 'border-emerald-600 bg-emerald-50' : 'border-line bg-surface hover:border-line-strong')}>
            <p className="font-medium text-ink">{READINESS_TOPIC_LABELS[n.topic]}</p>
            <p className="mt-1 text-xs text-muted">{n.exploredAt ? 'Explored' : 'Not yet explored'}</p>
          </button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <NotesEditor note={note} onSaved={(n) => setState((s) => s && { ...s, notes: s.notes.map((x) => (x.topic === n.topic ? n : x)) })} />
        {aiReady ? <TopicChat topic={topic} enabled /> : (
          <div className="space-y-3 rounded-2xl border border-dashed border-line-strong p-5">
            <h3 className="font-serif text-xl">Think it through</h3>
            {!state.aiAvailable
              ? <Notice>The AI discussion assistant isn’t available right now. Your private notes work fully — try writing where you stand and the questions you’d ask.</Notice>
              : <Notice tone="warning">To discuss topics with the AI assistant, <Link href="/app/settings" className="underline">turn on AI processing in Settings</Link>. Your notes work without it.</Notice>}
            <p className="text-sm text-muted">{PROMPTS[topic]}</p>
          </div>
        )}
      </div>
    </div>
  );
}

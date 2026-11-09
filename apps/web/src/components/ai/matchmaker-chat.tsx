'use client';
import * as React from 'react';
import Link from 'next/link';
import { Mic, MicOff, Plus, Send, Trash2 } from 'lucide-react';
import type { AppLocale, MatchmakerMessage, MatchmakerStatus, MatchmakerThreadSummary, SearchFilters } from '@2k/shared';
import { ProfileCardView } from '@/components/profile/profile-card';
import { Button, EmptyState, ErrorState, Notice, Skeleton } from '@/components/ui';
import { useMe } from '@/components/shell/me-context';
import { api, ApiClientError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AiFeedback } from './feedback';
import { FilterReview } from './filter-editor';

type ThreadPayload = { id: string; title: string | null; filters: SearchFilters | null; softPreferences: string[]; messages: MatchmakerMessage[] };

const LOCALES: { value: AppLocale; label: string; speech: string }[] = [
  { value: 'en', label: 'English', speech: 'en-IN' },
  { value: 'hi', label: 'हिन्दी', speech: 'hi-IN' },
  { value: 'ta', label: 'தமிழ்', speech: 'ta-IN' },
  { value: 'te', label: 'తెలుగు', speech: 'te-IN' },
  { value: 'kn', label: 'ಕನ್ನಡ', speech: 'kn-IN' },
  { value: 'ml', label: 'മലയാളം', speech: 'ml-IN' },
];

const STARTERS = [
  'I want someone who is ambitious, emotionally mature, independent, values family, enjoys travelling, and believes in growing together.',
  'Someone kind and grounded, vegetarian, between 27 and 32, ideally in Bengaluru.',
  'How does matching work here?',
];

const REFINES = ['Widen the age range a little', 'Anywhere in India is fine', 'Only people with a photo', 'Focus on shared interests'];

type SpeechRec = { lang: string; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

function useSpeech(lang: string, onText: (t: string) => void) {
  const recRef = React.useRef<SpeechRec | null>(null);
  const [listening, setListening] = React.useState(false);
  const [supported, setSupported] = React.useState(false);
  React.useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    setSupported(!!(w.SpeechRecognition ?? w.webkitSpeechRecognition));
  }, []);
  const toggle = () => {
    if (listening) { recRef.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = false;
    rec.onresult = (e) => onText(Array.from(e.results).map((r) => r[0]?.transcript ?? '').join(' '));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };
  return { supported, listening, toggle };
}

export function MatchmakerChat() {
  const { me } = useMe();
  const [status, setStatus] = React.useState<MatchmakerStatus | null>(null);
  const [threads, setThreads] = React.useState<MatchmakerThreadSummary[]>([]);
  const [thread, setThread] = React.useState<ThreadPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [input, setInput] = React.useState('');
  const [pendingUser, setPendingUser] = React.useState<string | null>(null);
  const [streaming, setStreaming] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [locale, setLocale] = React.useState<AppLocale>((me.user.preferredLocale as AppLocale) ?? 'en');
  const [edit, setEdit] = React.useState<{ filters: SearchFilters; soft: string[] } | null>(null);
  const [applying, setApplying] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);
  const speech = useSpeech(LOCALES.find((l) => l.value === locale)?.speech ?? 'en-IN', (t) => setInput((v) => (v ? `${v} ${t}` : t)));

  const refreshList = React.useCallback(async () => {
    const r = await api<{ threads: MatchmakerThreadSummary[]; status: MatchmakerStatus }>('/matchmaker/threads');
    setThreads(r.threads);
    setStatus(r.status);
  }, []);

  const openThread = React.useCallback(async (id: string) => {
    setError(null);
    const t = await api<ThreadPayload>(`/matchmaker/threads/${id}`);
    setThread(t);
    setEdit(t.filters ? { filters: t.filters, soft: t.softPreferences } : null);
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        await refreshList();
      } catch (e) {
        setError(e instanceof ApiClientError ? e.message : 'Could not load the matchmaker.');
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshList]);

  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [thread?.messages.length, streaming, pendingUser]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || streaming !== null) return;
    setError(null);
    setInput('');
    setPendingUser(message);
    setStreaming('');
    try {
      const res = await fetch('/api/v1/matchmaker', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, threadId: thread?.id, locale }),
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
        throw new Error(j?.error?.message ?? 'The matchmaker is unavailable right now.');
      }
      const threadId = res.headers.get('x-thread-id')!;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setStreaming(acc);
      }
      await openThread(threadId);
      await refreshList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setInput(message);
    } finally {
      setPendingUser(null);
      setStreaming(null);
    }
  };

  const apply = async () => {
    if (!thread || !edit) return;
    setApplying(true);
    setError(null);
    try {
      await api<MatchmakerMessage>(`/matchmaker/threads/${thread.id}/apply`, { body: { filters: edit.filters, softPreferences: edit.soft } });
      await openThread(thread.id);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not update the search.');
    } finally {
      setApplying(false);
    }
  };

  const remove = async (id: string) => {
    await api(`/matchmaker/threads/${id}`, { method: 'DELETE' });
    if (thread?.id === id) { setThread(null); setEdit(null); }
    await refreshList();
  };

  if (loading) return <div className="grid gap-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-96 w-full" /></div>;

  const needsConsent = status?.aiAvailable && !status.consentGranted;
  const busy = streaming !== null;
  const messages = thread?.messages ?? [];
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && m.structured);

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
      <aside aria-label="Conversations" className="hidden lg:block">
        <Button variant="secondary" size="sm" className="mb-3 w-full" onClick={() => { setThread(null); setEdit(null); }}><Plus />New conversation</Button>
        <ul className="space-y-1">
          {threads.map((t) => (
            <li key={t.id} className="group flex items-center">
              <button type="button" onClick={() => openThread(t.id)} className={cn('flex-1 truncate rounded-xl px-3 py-2 text-left text-sm', thread?.id === t.id ? 'bg-ink text-canvas' : 'text-ink-2 hover:bg-surface-2')}>{t.title ?? 'Conversation'}</button>
              <button type="button" onClick={() => remove(t.id)} aria-label={`Delete ${t.title ?? 'conversation'}`} className="ml-1 rounded-full p-1.5 text-muted opacity-0 hover:text-danger group-hover:opacity-100 focus:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
          {threads.length === 0 && <li className="px-3 text-sm text-muted">Your conversations will appear here.</li>}
        </ul>
      </aside>

      <section className="flex min-h-[70vh] flex-col rounded-2xl border border-line bg-surface shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div className="text-sm text-muted">
            {status && <span>{status.remainingToday} of {status.dailyLimit} messages left today</span>}
            {status && !status.aiAvailable && <span> · Simple mode</span>}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="sr-only sm:not-sr-only">Reply in</span>
            <select value={locale} onChange={(e) => setLocale(e.target.value as AppLocale)} className="rounded-full border border-line bg-canvas px-3 py-1.5 text-sm text-ink">
              {LOCALES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </label>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6" aria-live="polite">
          {needsConsent && (
            <Notice tone="warning">The matchmaker uses AI to understand your words. <Link className="underline" href="/app/settings">Turn on AI processing in Settings</Link> to continue.</Notice>
          )}
          {status && !status.aiAvailable && (
            <Notice>The AI assistant isn’t switched on yet, so I’ll use simple keyword matching — mention ages, cities, lifestyle or values and I’ll find people for you.</Notice>
          )}
          {messages.length === 0 && !pendingUser && (
            <EmptyState title="Tell me about who you hope to meet" description="Speak naturally. I’ll ask a few questions, turn your words into filters you can review, and show people who fit — explaining why." className="border-none bg-transparent py-6"
              action={<div className="flex flex-col gap-2">{STARTERS.map((s) => <button key={s} type="button" onClick={() => send(s)} disabled={busy || needsConsent} className="rounded-2xl border border-line px-4 py-2.5 text-left text-sm text-ink-2 hover:border-line-strong hover:text-ink disabled:opacity-50">{s}</button>)}</div>} />
          )}
          {messages.map((m, idx) => (
            <div key={m.id} className={cn('flex flex-col gap-3', m.role === 'user' ? 'items-end' : 'items-start')}>
              <div className={cn('max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[0.95rem] leading-relaxed', m.role === 'user' ? 'bg-ink text-canvas' : 'bg-surface-2 text-ink')}>{m.content}</div>
              {m.structured?.notice && <Notice className="max-w-[85%]">{m.structured.notice}</Notice>}
              {m.structured?.clarifyingQuestions.length ? (
                <div className="flex max-w-[85%] flex-wrap gap-2">{m.structured.clarifyingQuestions.map((q) => <span key={q} className="rounded-full bg-gold-50 px-3 py-1 text-xs text-gold-600">{q}</span>)}</div>
              ) : null}
              {m.results.length > 0 && (
                <div className="grid w-full gap-4 sm:grid-cols-2 xl:grid-cols-3">{m.results.map((c) => <ProfileCardView key={c.id} card={c} href={`/app/profile/${c.id}`} />)}</div>
              )}
              {m.role === 'assistant' && idx === messages.length - 1 && <AiFeedback feature="matchmaker_chat" referenceId={m.id} />}
            </div>
          ))}
          {pendingUser && <div className="flex justify-end"><div className="max-w-[85%] rounded-2xl bg-ink px-4 py-3 text-[0.95rem] text-canvas">{pendingUser}</div></div>}
          {streaming !== null && (
            <div className="flex justify-start">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-surface-2 px-4 py-3 text-[0.95rem] text-ink">
                {streaming || <span className="inline-flex gap-1" aria-label="Matchmaker is thinking"><span className="h-2 w-2 animate-bounce rounded-full bg-muted" /><span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:120ms]" /><span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:240ms]" /></span>}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {edit && lastAssistant && (
          <div className="border-t border-line px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Your search</p>
            <FilterReview filters={edit.filters} softPreferences={edit.soft} onChange={(f, s) => setEdit({ filters: f, soft: s })} onApply={apply} applying={applying} applyLabel="Update results" />
          </div>
        )}

        <div className="border-t border-line p-4">
          {error && <div className="mb-3"><ErrorState message={error} /></div>}
          {thread && !busy && (
            <div className="mb-3 flex flex-wrap gap-2">{REFINES.map((r) => <button key={r} type="button" onClick={() => send(r)} className="rounded-full border border-line px-3 py-1 text-xs text-ink-2 hover:border-line-strong hover:text-ink">{r}</button>)}</div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex items-end gap-2">
            <label htmlFor="mm-input" className="sr-only">Message the matchmaker</label>
            <textarea id="mm-input" value={input} onChange={(e) => setInput(e.target.value)} rows={1} maxLength={2000}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }}
              placeholder="Describe who you’d like to meet…" disabled={needsConsent}
              className="max-h-40 min-h-12 flex-1 resize-none rounded-xl border border-line bg-canvas px-4 py-3 text-[0.95rem] placeholder:text-muted/70 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100" />
            {status?.voiceInput && speech.supported && (
              <Button type="button" variant="secondary" size="icon" onClick={speech.toggle} aria-pressed={speech.listening} aria-label={speech.listening ? 'Stop voice input' : 'Speak your message'}>
                {speech.listening ? <MicOff /> : <Mic />}
              </Button>
            )}
            <Button type="submit" size="icon" disabled={!input.trim() || busy || needsConsent || status?.remainingToday === 0} aria-label="Send"><Send /></Button>
          </form>
          {status?.remainingToday === 0 && <p className="mt-2 text-xs text-muted">You’ve used today’s messages. <Link href="/app/billing" className="underline">See plans</Link> for more.</p>}
          <p className="mt-2 text-xs text-muted">The matchmaker never contacts anyone for you and never reads your private messages.</p>
        </div>
      </section>
    </div>
  );
}

import * as React from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import type { MatchmakerMessage, MatchmakerStatus, MatchmakerThreadSummary, ProfileCard, SearchFilters } from '@2k/shared';
import { api, ApiClientError, errorMessage } from '@/lib/api';
import { filterChips, removeFilter, serializeFilters } from '@/lib/filters';
import { haptic } from '@/lib/haptics';
import { colors, fonts, radius, space } from '@/theme';
import { Button, Chip, ErrorState, Icon, Notice, OfflineBanner, Sheet, Text } from '@/components/ui';
import { ProfileCardView } from '@/components/domain/ProfileCardView';
import { handleEntitlementError } from '@/components/domain/ProfileActions';

interface Thread { id: string; title: string | null; filters: SearchFilters | null; softPreferences: string[]; messages: MatchmakerMessage[] }
interface ThreadList { threads: MatchmakerThreadSummary[]; status: MatchmakerStatus }
type Local = MatchmakerMessage & { pending?: boolean };

const SUGGESTIONS = [
  'Someone ambitious and emotionally mature who values family',
  'People open to settling in Bengaluru who love travel',
  'Values independence but wants to grow together',
];

export default function Matchmaker() {
  const [threadId, setThreadId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Local[]>([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<SearchFilters | null>(null);
  const [results, setResults] = React.useState<ProfileCard[] | null>(null);
  const [threadsOpen, setThreadsOpen] = React.useState(false);
  const [threads, setThreads] = React.useState<MatchmakerThreadSummary[]>([]);
  const [status, setStatus] = React.useState<MatchmakerStatus | null>(null);
  const [soft, setSoft] = React.useState<string[]>([]);

  const loadThreads = React.useCallback(async () => {
    const r = await api.get<ThreadList>('/matchmaker/threads');
    setThreads(r.threads);
    setStatus(r.status);
  }, []);
  React.useEffect(() => { loadThreads().catch(() => undefined); }, [loadThreads]);
  const listRef = React.useRef<FlatList<Local>>(null);

  const loadThread = async (id: string) => {
    const t = await api.get<Thread>(`/matchmaker/threads/${id}`);
    setThreadId(t.id);
    setMessages(t.messages);
    setFilters(t.filters ? { ...t.filters } : null);
    setSoft(t.softPreferences ?? []);
    const lastWithResults = [...t.messages].reverse().find((m) => m.results.length);
    setResults(lastWithResults?.results ?? null);
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    haptic.tap();
    setInput(''); setError(null); setBusy(true);
    const now = new Date().toISOString();
    setMessages((m) => [...m, { id: `u-${now}`, role: 'user', content: message, createdAt: now, structured: null, results: [] }, { id: `a-${now}`, role: 'assistant', content: '', createdAt: now, structured: null, results: [], pending: true }]);
    try {
      const res = await api.raw('/matchmaker', { method: 'POST', body: { threadId: threadId ?? undefined, message } });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
        throw new ApiClientError(res.status, (body?.error?.code as never) ?? 'internal_error', body?.error?.message ?? 'The matchmaker is unavailable right now.');
      }
      const id = res.headers.get('x-thread-id') ?? threadId;
      const reply = await res.text(); // RN fetch buffers streamed text; we show a typing indicator meanwhile
      setMessages((m) => m.map((x) => (x.pending ? { ...x, content: reply, pending: false } : x)));
      if (id) await loadThread(id);
      void loadThreads().catch(() => undefined);
    } catch (e) {
      setMessages((m) => m.filter((x) => !x.pending));
      if (!handleEntitlementError(e)) {
        setError(e instanceof ApiClientError && e.code === 'feature_disabled' ? 'The matchmaker is currently turned off. You can still search with filters in Discover.' : errorMessage(e));
      }
    } finally {
      setBusy(false);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  };

  /** Re-run the thread's search with member-edited filters (no AI call). */
  const runSearch = async () => {
    if (!filters || !threadId) return;
    try {
      setBusy(true);
      const msg = await api.post<MatchmakerMessage>(`/matchmaker/threads/${threadId}/apply`, { filters: serializeFilters(filters), softPreferences: soft });
      setMessages((m) => [...m, msg]);
      setResults(msg.results);
    } catch (e) { if (!handleEntitlementError(e)) setError(errorMessage(e)); } finally { setBusy(false); }
  };

  const openThreads = async () => {
    setThreadsOpen(true);
    try { await loadThreads(); } catch (e) { setError(errorMessage(e)); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <OfflineBanner />
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xl }}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="bodyMuted" style={{ flex: 1 }}>Tell me what matters to you. I’ll ask a question or two, then find people who align.</Text>
              <Button title="History" size="sm" variant="ghost" onPress={openThreads} />
            </View>
            {status && !status.aiAvailable && <Notice>AI is unavailable right now, so I’ll use simpler keyword matching.</Notice>}
            {status?.aiAvailable && !status.consentGranted && <Notice tone="warning">Turn on “AI matchmaking features” in Settings to chat with the matchmaker.</Notice>}
            {status && <Text variant="small">{status.remainingToday} of {status.dailyLimit} messages left today</Text>}
            {messages.length === 0 && SUGGESTIONS.map((s) => <Chip key={s} label={s} accessibilityRole="button" onPress={() => send(s)} />)}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', gap: 6 }}>
            <View style={{ backgroundColor: item.role === 'user' ? colors.burgundy600 : colors.surface, borderRadius: radius.lg, padding: space.md, borderWidth: item.role === 'user' ? 0 : 1, borderColor: colors.line }}>
              <Text style={{ color: item.role === 'user' ? colors.white : colors.ink }}>{item.pending ? 'Thinking…' : item.content}</Text>
            </View>
            {item.structured?.clarifyingQuestions?.map((q) => <Chip key={q} label={q} accessibilityRole="button" onPress={() => setInput(q.endsWith('?') ? '' : q)} />)}
            {item.structured?.notice && <Text variant="small">{item.structured.notice}</Text>}
          </View>
        )}
        ListFooterComponent={
          <View style={{ gap: space.md, marginTop: space.md }}>
            {error && <ErrorState message={error} />}
            {filters && Object.keys(serializeFilters(filters)).length > 0 && (
              <View style={{ gap: 8 }}>
                <Text variant="label">Filters I’m using — tap to remove</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {filterChips(filters).map((c) => <Chip key={c.key} label={c.label} onRemove={() => setFilters(removeFilter(filters, c.key))} />)}
                  {soft.map((s) => <Chip key={s} label={`~ ${s}`} onRemove={() => setSoft(soft.filter((x) => x !== s))} />)}
                </View>
                <Button title="Search again with these" size="sm" variant="secondary" onPress={runSearch} loading={busy} disabled={!threadId} />
              </View>
            )}
            {results && (results.length ? results.map((card) => <ProfileCardView key={card.id} card={card} compact />)
              : <Notice>No one matches all of this yet. Try relaxing a filter.</Notice>)}
          </View>
        }
      />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: space.md, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface }}>
        <TextInput
          accessibilityLabel="Message the matchmaker"
          value={input}
          onChangeText={setInput}
          placeholder="Describe who you’re hoping to meet…"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={2000}
          style={{ flex: 1, maxHeight: 120, minHeight: 44, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 10, fontFamily: fonts.body, fontSize: 15, color: colors.ink, backgroundColor: colors.canvas }}
        />
        <Pressable onPress={() => send(input)} disabled={!input.trim() || busy} accessibilityRole="button" accessibilityLabel="Send" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.burgundy600, alignItems: 'center', justifyContent: 'center', opacity: !input.trim() || busy ? 0.5 : 1 }}>
          <Icon name="send" color={colors.white} size={18} />
        </Pressable>
      </View>
      <Sheet visible={threadsOpen} onClose={() => setThreadsOpen(false)} title="Conversations">
        <Button title="Start a new conversation" onPress={() => { setThreadId(null); setMessages([]); setFilters(null); setSoft([]); setResults(null); setThreadsOpen(false); }} />
        {threads.map((t) => (
          <Pressable key={t.id} accessibilityRole="button" onPress={async () => { setThreadsOpen(false); try { await loadThread(t.id); } catch (e) { setError(errorMessage(e)); } }} style={{ paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <Text variant="label">{t.title ?? 'Untitled conversation'}</Text>
            <Text variant="small">{new Date(t.updatedAt).toLocaleDateString('en-IN')}</Text>
          </Pressable>
        ))}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

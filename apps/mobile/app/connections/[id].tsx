import * as React from 'react';
import { Alert, View } from 'react-native';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  JOURNAL_KIND_LABELS, VISION_CATEGORY_LABELS, type BeforeYouMeetBriefing, type ConnectionOverview, type GapAnalysis, type InsightEnvelope,
  type JournalEntry, type JournalKind, type VisionCategory, type VisionItem, type VisionThemes,
} from '@2k/shared';
import { api, ApiClientError, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { keys, useQueryClient } from '@/hooks/queries';
import { colors, space } from '@/theme';
import { Badge, Button, Card, ChipGroup, EmptyState, ErrorState, Loading, Notice, Screen, SegmentedControl, Switch, Text, TextField } from '@/components/ui';
import { ProfileCardView } from '@/components/domain/ProfileCardView';
import { CompatibilityPanel } from '@/components/domain/CompatibilityPanel';
import { handleEntitlementError } from '@/components/domain/ProfileActions';
import { Meetings } from '@/components/domain/Meetings';

type Tab = 'overview' | 'gap' | 'meet' | 'vision' | 'journal' | 'meetings';

export default function ConnectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = React.useState<Tab>('overview');
  const overview = useQuery({ queryKey: keys.connection(id), queryFn: () => api.get<ConnectionOverview>(`/connections/${id}`) });
  const o = overview.data;

  const close = () => Alert.alert('Close this connection?', 'The conversation will be locked. This can’t be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Close connection', style: 'destructive', onPress: async () => { try { await api.post(`/connections/${id}/close`, {}); router.back(); } catch (e) { Alert.alert('Error', errorMessage(e)); } } },
  ]);

  return (
    <Screen edges={[]} keyboardShouldPersistTaps="handled" refreshing={overview.isRefetching} onRefresh={() => overview.refetch()}>
      <Stack.Screen options={{ title: o?.other.displayName ?? 'Connection' }} />
      {overview.isLoading ? <Loading /> : overview.error || !o ? <ErrorState message={errorMessage(overview.error)} onRetry={() => overview.refetch()} /> : (
        <>
          <SegmentedControl label="Connection tools" value={tab} onChange={setTab} options={[
            { value: 'overview', label: 'Overview' },
            ...(o.features.gapAnalysis ? [{ value: 'gap' as Tab, label: 'Gaps' }] : []),
            ...(o.features.beforeYouMeet ? [{ value: 'meet' as Tab, label: 'Meet' }] : []),
            ...(o.features.visionBoard ? [{ value: 'vision' as Tab, label: 'Vision' }] : []),
            ...(o.features.journal ? [{ value: 'journal' as Tab, label: 'Journal' }] : []),
          ]} />
          {o.status === 'active' && tab !== 'meetings' && <Button title="Plan a meeting" size="sm" variant="ghost" onPress={() => setTab('meetings')} />}
          {tab === 'overview' && (
            <View style={{ gap: space.lg }}>
              <ProfileCardView card={o.other} compact />
              {o.conversationId && o.status === 'active' && <Button title="Open conversation" onPress={() => router.push(`/chat/${o.conversationId}` as Href)} full />}
              {o.explanation && <CompatibilityPanel explanation={o.explanation} />}
              {o.status === 'active' ? <Button title="Close connection" variant="ghost" onPress={close} /> : <Notice tone="warning">This connection is closed.</Notice>}
            </View>
          )}
          {tab === 'gap' && <InsightTab<GapAnalysis> id={id} kind="gap_analysis" render={(g) => (
            <View style={{ gap: space.md }}>
              <Card style={{ gap: 6 }}><Text variant="heading">Where you align</Text>{g.alignments.map((a) => <Text key={a.topic}><Text variant="label">{a.topic}: </Text>{a.detail}</Text>)}</Card>
              <Card style={{ gap: 8 }}><Text variant="heading">Differences to explore</Text>{g.differences.map((d) => (
                <View key={d.topic} style={{ gap: 2 }}><Text variant="label">{d.topic}</Text><Text>{d.detail}</Text>{d.possibleCompromises.map((c) => <Text key={c} variant="small">↳ {c}</Text>)}</View>
              ))}</Card>
              {g.unansweredQuestions.length > 0 && <Card style={{ gap: 6 }}><Text variant="heading">Still to discuss</Text>{g.unansweredQuestions.map((q) => <Text key={q}>• {q}</Text>)}</Card>}
              {g.suggestedConversations.length > 0 && <Card style={{ gap: 6 }}><Text variant="heading">Conversation ideas</Text>{g.suggestedConversations.map((q) => <Text key={q}>• {q}</Text>)}</Card>}
              <Text variant="small">{g.note}</Text>
            </View>
          )} />}
          {tab === 'meet' && <InsightTab<BeforeYouMeetBriefing> id={id} kind="before_you_meet" render={(b) => (
            <View style={{ gap: space.md }}>
              <Card style={{ gap: 6 }}><Text variant="heading">Shared ground</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{[...b.sharedInterests, ...b.sharedValues].map((x) => <Badge key={x} label={x} tone="gold" />)}</View>
              </Card>
              <Card style={{ gap: 6 }}><Text variant="heading">Conversation starters</Text>{b.conversationStarters.map((x) => <Text key={x}>• {x}</Text>)}</Card>
              <Card style={{ gap: 6 }}><Text variant="heading">Worth discussing before progressing</Text>{b.questionsToDiscuss.map((x) => <Text key={x}>• {x}</Text>)}</Card>
              {b.potentialDifferences.length > 0 && <Card style={{ gap: 6 }}><Text variant="heading">Possible differences</Text>{b.potentialDifferences.map((x) => <Text key={x.area}><Text variant="label">{x.area}: </Text>{x.detail}</Text>)}</Card>}
              <Card style={{ gap: 6 }}><Text variant="heading">First meeting ideas</Text>{b.firstMeetingIdeas.map((x) => <Text key={x.idea}><Text variant="label">{x.idea}</Text> — {x.why}</Text>)}</Card>
              <Text variant="small">{b.note}</Text>
            </View>
          )} />}
          {tab === 'vision' && <VisionTab id={id} />}
          {tab === 'journal' && <JournalTab id={id} />}
          {tab === 'meetings' && <Meetings connectionId={id} active={o.status === 'active'} canRespond />}
        </>
      )}
    </Screen>
  );
}

function InsightTab<T>({ id, kind, render }: { id: string; kind: 'gap_analysis' | 'before_you_meet'; render: (c: T) => React.ReactNode }) {
  const qc = useQueryClient();
  const key = ['insight', id, kind];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<InsightEnvelope<T> | null>(`/connections/${id}/insights`, { kind }), retry: false });
  const gen = useMutation({
    mutationFn: () => api.request<InsightEnvelope<T>>(`/connections/${id}/insights`, { method: 'POST', query: { kind }, body: {} }).then((r) => r.data),
    onSuccess: (d) => { haptic.success(); qc.setQueryData(key, d); },
    onError: (e) => { handleEntitlementError(e); },
  });
  const title = kind === 'gap_analysis' ? 'Compatibility Gap Analysis' : 'Before You Meet';
  const desc = kind === 'gap_analysis' ? 'A private, balanced look at where you align and what’s worth talking through. Differences aren’t verdicts.' : 'A private briefing: shared ground, conversation starters and thoughtful first-meeting ideas.';
  if (q.isLoading) return <Loading />;
  const data = q.data;
  return (
    <View style={{ gap: space.md }}>
      {data ? (
        <>
          {render(data.content)}
          <Text variant="small">Generated {new Date(data.createdAt).toLocaleDateString('en-IN')}{data.generator === 'ai' ? ' with AI' : ''}. Visible only to the two of you.</Text>
          <Button title="Regenerate" variant="ghost" size="sm" onPress={() => gen.mutate()} loading={gen.isPending} />
        </>
      ) : <EmptyState title={title} description={desc} action={{ label: gen.isPending ? 'Preparing…' : 'Generate', onPress: () => gen.mutate() }} />}
      {gen.error && !(gen.error instanceof ApiClientError && gen.error.code === 'entitlement_required') && <ErrorState message={errorMessage(gen.error)} />}
      {q.error && !(q.error instanceof ApiClientError && q.error.status === 404) && <ErrorState message={errorMessage(q.error)} />}
    </View>
  );
}

const CATS = (Object.keys(VISION_CATEGORY_LABELS) as VisionCategory[]).map((c) => ({ value: c, label: VISION_CATEGORY_LABELS[c] }));

function VisionTab({ id }: { id: string }) {
  const q = useQuery({ queryKey: ['vision', id], queryFn: () => api.get<{ items: VisionItem[]; themes: InsightEnvelope<VisionThemes> | null }>(`/connections/${id}/vision`) });
  const [cat, setCat] = React.useState<VisionCategory[]>(['travel']);
  const [content, setContent] = React.useState('');
  const [shared, setShared] = React.useState(true);
  const [themes, setThemes] = React.useState<VisionThemes | null>(null);
  const add = useMutation({
    mutationFn: () => api.post(`/connections/${id}/vision`, { category: cat[0], content: content.trim(), isShared: shared }),
    onSuccess: () => { setContent(''); haptic.success(); void q.refetch(); },
  });
  const findThemes = useMutation({ mutationFn: () => api.post<InsightEnvelope<VisionThemes>>(`/connections/${id}/vision/themes`, {}), onSuccess: (env) => setThemes(env.content), onError: (e) => { handleEntitlementError(e); } });
  const shownThemes = themes ?? q.data?.themes?.content ?? null;
  const toggleShare = async (v: VisionItem) => { try { await api.patch(`/connections/${id}/vision/${v.id}`, { isShared: !v.isShared }); void q.refetch(); } catch (e) { Alert.alert('Error', errorMessage(e)); } };
  const remove = async (v: VisionItem) => { try { await api.del(`/connections/${id}/vision/${v.id}`); void q.refetch(); } catch (e) { Alert.alert('Error', errorMessage(e)); } };
  return (
    <View style={{ gap: space.md }}>
      <Text variant="bodyMuted">Add hopes and plans. Sharing is always your choice — private items stay visible only to you.</Text>
      <Card style={{ gap: space.md }}>
        <ChipGroup label="Category" options={CATS} value={cat} onChange={setCat} />
        <TextField label="Your idea" multiline maxLength={500} value={content} onChangeText={setContent} placeholder="e.g. A trip to Japan in spring" />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="label">Share with them</Text>
          <Switch accessibilityLabel="Share with them" value={shared} onValueChange={setShared} trackColor={{ true: colors.emerald500, false: colors.lineStrong }} />
        </View>
        {add.error && <ErrorState message={errorMessage(add.error)} />}
        <Button title="Add to vision board" onPress={() => add.mutate()} loading={add.isPending} disabled={!content.trim()} />
      </Card>
      {q.isLoading ? <Loading /> : q.error ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : (q.data?.items ?? []).map((v) => (
        <Card key={v.id} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}><Badge label={VISION_CATEGORY_LABELS[v.category]} tone="gold" />{!v.isShared && <Badge label="Private" />}{!v.isMine && <Badge label="Theirs" tone="info" />}</View>
          <Text>{v.content}</Text>
          {v.isMine && <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title={v.isShared ? 'Make private' : 'Share'} size="sm" variant="ghost" onPress={() => toggleShare(v)} />
            <Button title="Remove" size="sm" variant="ghost" onPress={() => remove(v)} />
          </View>}
        </Card>
      ))}
      <Button title="Find common themes" variant="secondary" onPress={() => findThemes.mutate()} loading={findThemes.isPending} />
      {findThemes.error && !(findThemes.error instanceof ApiClientError && findThemes.error.code === 'entitlement_required') && <ErrorState message={errorMessage(findThemes.error)} />}
      {shownThemes && (
        <Card style={{ gap: 6 }}>
          <Text variant="heading">Common themes</Text>
          {shownThemes.commonThemes.map((t) => <Text key={t}>• {t}</Text>)}
          {shownThemes.unansweredQuestions.length > 0 && <Text variant="label">Open questions</Text>}
          {shownThemes.unansweredQuestions.map((t) => <Text key={t}>• {t}</Text>)}
          <Text variant="small">{shownThemes.note}</Text>
        </Card>
      )}
    </View>
  );
}

const KINDS = (Object.keys(JOURNAL_KIND_LABELS) as JournalKind[]).map((k) => ({ value: k, label: JOURNAL_KIND_LABELS[k] }));

function JournalTab({ id }: { id: string }) {
  const q = useQuery({ queryKey: ['journal', id], queryFn: () => api.get<JournalEntry[]>(`/connections/${id}/journal`) });
  const [kind, setKind] = React.useState<JournalKind[]>(['topic_discussed']);
  const [content, setContent] = React.useState('');
  const add = useMutation({
    mutationFn: () => api.post(`/connections/${id}/journal`, { kind: kind[0], content: content.trim() }),
    onSuccess: () => { setContent(''); haptic.success(); void q.refetch(); },
  });
  const toggle = async (e: JournalEntry) => { try { await api.patch(`/connections/${id}/journal/${e.id}`, { resolved: !e.resolved }); void q.refetch(); } catch (err) { Alert.alert('Error', errorMessage(err)); } };
  return (
    <View style={{ gap: space.md }}>
      <Text variant="bodyMuted">Your private notes on how your understanding is growing. Only you can see this journal, and it never changes your compatibility score.</Text>
      <Card style={{ gap: space.md }}>
        <ChipGroup label="Entry type" options={KINDS} value={kind} onChange={setKind} />
        <TextField label="Note" multiline maxLength={1000} value={content} onChangeText={setContent} />
        {add.error && <ErrorState message={errorMessage(add.error)} />}
        <Button title="Add entry" onPress={() => add.mutate()} loading={add.isPending} disabled={!content.trim()} />
      </Card>
      {q.isLoading ? <Loading /> : (q.data ?? []).map((e) => (
        <Card key={e.id} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Badge label={JOURNAL_KIND_LABELS[e.kind]} tone={e.resolved ? 'success' : 'neutral'} />
            <Text variant="small">{new Date(e.createdAt).toLocaleDateString('en-IN')}</Text>
          </View>
          <Text style={e.resolved ? { color: colors.muted } : undefined}>{e.content}</Text>
          {e.kind === 'question_remaining' && <Button title={e.resolved ? 'Mark as open' : 'Mark as discussed'} size="sm" variant="ghost" onPress={() => toggle(e)} />}
        </Card>
      ))}
    </View>
  );
}


import * as React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { router, Stack, type Href } from 'expo-router';
import { relativeTime } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { CATEGORY_LABELS, STATUS_META, SUPPORT_CATEGORIES, type SupportCategory, type Ticket } from '@/lib/support';
import { useMe, useQuery } from '@/hooks/queries';
import { colors, space } from '@/theme';
import { Badge, Button, ChipGroup, EmptyState, ErrorState, Icon, Loading, Notice, Sheet, Text, TextField } from '@/components/ui';

export default function Support() {
  const me = useMe();
  const q = useQuery({ queryKey: ['support-tickets'], queryFn: () => api.get<Ticket[]>('/support/tickets') });
  const suspended = me.data?.user.status === 'suspended';
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState<SupportCategory[]>([suspended ? 'account' : 'technical']);
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const create = async () => {
    setBusy(true); setError(null);
    try {
      const t = await api.post<Ticket>('/support/tickets', { category: category[0] ?? 'other', subject: subject.trim(), body: body.trim() });
      haptic.success();
      setOpen(false); setSubject(''); setBody('');
      void q.refetch();
      router.push(`/support/${t.id}` as Href);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ title: 'Help & support' }} />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: space.lg, gap: 2, flexGrow: 1 }}
        refreshing={q.isRefetching}
        onRefresh={() => q.refetch()}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.md }}>
            {suspended && <Notice tone="warning">Your account is suspended. You can contact our team here — for example, to ask why or to appeal.</Notice>}
            <Text variant="bodyMuted">Questions about your account, billing, verification or safety? Our team usually replies within a working day{me.data?.plan.entitlements.priority_support ? ' — your plan includes priority support' : ''}.</Text>
            <Notice>If you feel unsafe, choose “Safety concern”. In an emergency, call 112.</Notice>
            <Button title="New request" onPress={() => setOpen(true)} />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/support/${item.id}` as Href)} accessibilityRole="button" accessibilityLabel={`${item.subject}. ${STATUS_META[item.status].label}`} android_ripple={{ color: colors.line }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="label" style={{ color: colors.ink }} numberOfLines={1}>{item.subject}</Text>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Badge label={STATUS_META[item.status].label} tone={STATUS_META[item.status].tone} />
                <Text variant="small">{CATEGORY_LABELS[item.category] ?? item.category} · {relativeTime(item.updated_at)}</Text>
              </View>
            </View>
            <Icon name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
        )}
        ListEmptyComponent={q.isLoading ? <Loading /> : q.error ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : <EmptyState title="No requests yet" description="When you contact us, your conversations with our team appear here." />}
      />
      <Sheet visible={open} onClose={() => setOpen(false)} title="New request">
        <Text variant="label">What’s it about?</Text>
        <ChipGroup label="Category" options={SUPPORT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))} value={category} onChange={setCategory} />
        <TextField label="Subject" value={subject} onChangeText={setSubject} maxLength={200} />
        <TextField label="How can we help?" multiline maxLength={5000} value={body} onChangeText={setBody} hint="Please don’t include passwords, OTPs or full ID numbers." />
        {error && <ErrorState message={error} />}
        <Button title="Send" onPress={create} loading={busy} disabled={subject.trim().length < 3 || !body.trim()} full />
      </Sheet>
    </View>
  );
}

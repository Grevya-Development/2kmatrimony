import * as React from 'react';
import { Alert, Share, View } from 'react-native';
import { router, Stack, type Href } from 'expo-router';
import { FAMILY_PERMISSION_LABELS, FAMILY_PERMISSIONS, FAMILY_RELATIONS, type FamilyMemberItem, type FamilyPermission, type FamilyRelation, type FamilySuggestionItem, type ProfileCard } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { useQuery } from '@/hooks/queries';
import { space } from '@/theme';
import { Badge, Button, Card, ChipGroup, ErrorState, Loading, Notice, Screen, Section, Sheet, Text, TextField } from '@/components/ui';
import { DiscussionThread } from '@/components/domain/DiscussionThread';

interface FamilyOverview { members: FamilyMemberItem[]; suggestions: FamilySuggestionItem[]; discussions: { profile: ProfileCard; lastAt: string; count: number }[] }
const REL = FAMILY_RELATIONS.map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }));
const PERMS = FAMILY_PERMISSIONS.map((p) => ({ value: p, label: FAMILY_PERMISSION_LABELS[p] }));

/** Owner view: invite family with specific permissions; review their suggestions. */
export default function Family() {
  const q = useQuery({ queryKey: ['family'], queryFn: () => api.get<FamilyOverview>('/family') });
  const [contact, setContact] = React.useState('');
  const [relation, setRelation] = React.useState<FamilyRelation[]>(['mother']);
  const [perms, setPerms] = React.useState<FamilyPermission[]>(['view_profiles', 'suggest_matches']);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [thread, setThread] = React.useState<ProfileCard | null>(null);

  const invite = async () => {
    setBusy(true); setError(null);
    try {
      const r = await api.post<{ inviteLink: string; delivered: boolean }>('/family', { contact: contact.trim(), relation: relation[0], permissions: perms });
      haptic.success(); setContact(''); void q.refetch();
      Alert.alert('Invitation created', r.delivered ? 'We sent them the invitation. You can also share the link yourself.' : 'Share the invitation link with them.', [
        { text: 'Done', style: 'cancel' },
        { text: 'Share link', onPress: () => void Share.share({ message: `Join me on 2K Marriage to help with my search: ${r.inviteLink}` }) },
      ]);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const revoke = (m: FamilyMemberItem) => Alert.alert('Remove access?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: async () => { try { await api.del(`/family/${m.id}`); void q.refetch(); } catch (e) { Alert.alert('Error', errorMessage(e)); } } }]);
  const setStatus = async (s: FamilySuggestionItem, status: 'considering' | 'dismissed') => { try { await api.patch(`/family/suggestions/${s.id}`, { status }); void q.refetch(); } catch (e) { Alert.alert('Error', errorMessage(e)); } };

  return (
    <Screen edges={[]} keyboardShouldPersistTaps="handled" refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Stack.Screen options={{ title: 'Family' }} />
      <Notice>You stay in control of interests, connections and conversations. Family only sees what you allow.</Notice>
      {q.isLoading ? <Loading /> : q.error ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : (
        <>
          <Section title="Members">
            {(q.data?.members ?? []).filter((m) => m.status !== 'revoked').length === 0 && <Text variant="bodyMuted">No family members yet.</Text>}
            {(q.data?.members ?? []).filter((m) => m.status !== 'revoked').map((m) => (
              <Card key={m.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="label">{m.displayName ?? m.invitedContact} · {m.relation}</Text>
                  <Badge label={m.status} tone={m.status === 'active' ? 'success' : 'warning'} />
                </View>
                <Text variant="small">{m.permissions.map((p) => FAMILY_PERMISSION_LABELS[p]).join(' · ')}</Text>
                <Button title="Remove access" size="sm" variant="ghost" onPress={() => revoke(m)} />
              </Card>
            ))}
          </Section>
          <Section title="Invite someone">
            <Card style={{ gap: space.md }}>
              <TextField label="Email or mobile number" value={contact} onChangeText={setContact} autoCapitalize="none" keyboardType="email-address" />
              <ChipGroup label="Relation" options={REL} value={relation} onChange={setRelation} />
              <Text variant="label">They can</Text>
              <ChipGroup label="Permissions" multiple options={PERMS} value={perms} onChange={setPerms} />
              {error && <ErrorState message={error} />}
              <Button title="Send invitation" onPress={invite} loading={busy} disabled={contact.trim().length < 5 || !perms.length} />
            </Card>
          </Section>
          {(q.data?.suggestions ?? []).length > 0 && (
            <Section title="Suggestions from family">
              {(q.data?.suggestions ?? []).map((s) => (
                <Card key={s.id} style={{ gap: 6 }}>
                  <Text variant="label">{s.profile?.displayName ?? 'Profile unavailable'} — suggested by {s.suggestedBy.name ?? s.suggestedBy.relation}</Text>
                  {s.note && <Text variant="small">“{s.note}”</Text>}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {s.profile && <Button title="View" size="sm" onPress={() => { void setStatus(s, 'considering'); router.push(`/member/${s.profile!.id}` as Href); }} />}
                    {s.profile && <Button title="Discuss" size="sm" variant="ghost" onPress={() => setThread(s.profile)} />}
                    <Button title="Dismiss" size="sm" variant="ghost" onPress={() => setStatus(s, 'dismissed')} />
                  </View>
                </Card>
              ))}
            </Section>
          )}
          {(q.data?.discussions ?? []).length > 0 && (
            <Section title="Family discussions">
              {(q.data?.discussions ?? []).map((t) => (
                <Card key={t.profile.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="label">{t.profile.displayName}</Text>
                    <Text variant="small">{t.count} message{t.count === 1 ? '' : 's'} · {new Date(t.lastAt).toLocaleDateString('en-IN')}</Text>
                  </View>
                  <Button title="Open" size="sm" variant="secondary" onPress={() => setThread(t.profile)} />
                </Card>
              ))}
            </Section>
          )}
        </>
      )}
      <Sheet visible={!!thread} onClose={() => setThread(null)} title={`About ${thread?.displayName ?? ''}`}>
        {thread && <DiscussionThread targetProfileId={thread.id} />}
      </Sheet>
    </Screen>
  );
}

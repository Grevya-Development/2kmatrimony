import * as React from 'react';
import { Alert, View } from 'react-native';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useAuth } from '@/lib/auth';
import type { FamilyPermission, ProfileCard } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { useMe, useQuery } from '@/hooks/queries';
import { space } from '@/theme';
import { Badge, Button, Card, ErrorState, Loading, Notice, Screen, Section, Sheet, Text, TextField } from '@/components/ui';
import { ProfileCardView } from '@/components/domain/ProfileCardView';
import { DiscussionThread } from '@/components/domain/DiscussionThread';
import { Meetings } from '@/components/domain/Meetings';

interface MemberView {
  owner: { profileId: string; firstName: string; profileCode: string };
  permissions: FamilyPermission[];
  recommendations: ProfileCard[];
  shortlist: { profile: ProfileCard; note: string | null; addedByMe: boolean }[];
  mySuggestions: { id: string; note: string | null; status: string; createdAt: string; profile: ProfileCard | null }[];
  connections: { id: string; profile: ProfileCard }[];
}

/**
 * A family member's view of the person they help (GET /family/of/:profileId).
 * Profiles are projected as the OWNER sees them; the owner stays in control.
 * Cards are not tappable through to /member (that requires the helper's own profile).
 */
export default function FamilyMemberView() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const q = useQuery({ queryKey: ['family-of', profileId], queryFn: () => api.get<MemberView>(`/family/of/${profileId}`) });
  const me = useMe();
  const { signOut } = useAuth();
  const helperOnly = !!me.data && !me.data.profile;
  const [suggesting, setSuggesting] = React.useState<ProfileCard | null>(null);
  const [discussing, setDiscussing] = React.useState<ProfileCard | null>(null);
  const [meetingsFor, setMeetingsFor] = React.useState<{ id: string; profile: ProfileCard } | null>(null);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  if (q.isLoading) return <Screen edges={[]}><Loading /></Screen>;
  if (q.error || !q.data) return <Screen edges={[]}><ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /></Screen>;
  const d = q.data;
  const name = d.owner.firstName;
  const can = (p: FamilyPermission) => d.permissions.includes(p);
  const shortlisted = new Set(d.shortlist.map((s) => s.profile.id));

  const addToShortlist = async (c: ProfileCard) => {
    try { await api.post(`/family/of/${profileId}/shortlist`, { targetProfileId: c.id, note: null }); haptic.success(); Alert.alert('Added', `${c.displayName} is on ${name}’s shortlist.`); void q.refetch(); }
    catch (e) { Alert.alert('Not added', errorMessage(e)); }
  };
  const suggest = async () => {
    if (!suggesting) return;
    setBusy(true);
    try {
      await api.post('/family/suggestions', { profileId, targetProfileId: suggesting.id, note: note.trim() || null });
      haptic.success(); setSuggesting(null); setNote(''); void q.refetch();
      Alert.alert('Suggestion sent', `${name} will see your note and decide.`);
    } catch (e) { Alert.alert('Not sent', errorMessage(e)); } finally { setBusy(false); }
  };

  const actions = (c: ProfileCard) => (
    <>
      {can('suggest_matches') && <Button title="Suggest" size="sm" variant="secondary" onPress={() => setSuggesting(c)} />}
      {can('shortlist') && !shortlisted.has(c.id) && <Button title="Shortlist" size="sm" variant="secondary" onPress={() => addToShortlist(c)} />}
      {can('discuss') && <Button title="Discuss" size="sm" variant="ghost" onPress={() => setDiscussing(c)} />}
    </>
  );

  return (
    <Screen edges={[]} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Stack.Screen options={{ title: `Helping ${name}` }} />
      <Notice>{name} stays in control of interests, connections and conversations. Profiles here are shown as {name} sees them.</Notice>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {d.permissions.map((p) => <Badge key={p} label={p.replace(/_/g, ' ')} tone="gold" />)}
      </View>

      {can('view_profiles') && (
        <Section title={`Suggested for ${name}`}>
          {d.recommendations.length === 0 ? <Text variant="bodyMuted">No recommendations yet.</Text>
            : d.recommendations.map((c) => <ProfileCardView key={c.id} card={c} compact linkable={false} actions={actions(c)} />)}
        </Section>
      )}

      {d.shortlist.length > 0 && (
        <Section title={`${name}’s shortlist`}>
          {d.shortlist.map((s) => (
            <View key={s.profile.id} style={{ gap: 4 }}>
              {s.addedByMe && <Badge label="Added by you" tone="info" />}
              {s.note && <Text variant="small">“{s.note}”</Text>}
              <ProfileCardView card={s.profile} compact linkable={false} actions={actions(s.profile)} />
            </View>
          ))}
        </Section>
      )}

      {d.mySuggestions.length > 0 && (
        <Section title="Your suggestions">
          {d.mySuggestions.map((s) => (
            <Card key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Text variant="label">{s.profile?.displayName ?? 'Profile unavailable'}</Text>
                {s.note && <Text variant="small">“{s.note}”</Text>}
              </View>
              <Badge label={s.status} tone={s.status === 'considering' ? 'success' : s.status === 'dismissed' ? 'neutral' : 'warning'} />
            </Card>
          ))}
        </Section>
      )}

      {can('coordinate_meetings') && (
        <Section title="Help coordinate meetings">
          {d.connections.length === 0 ? <Text variant="bodyMuted">{name} has no active connections yet.</Text> : d.connections.map((c) => (
            <Card key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Text variant="label" style={{ flex: 1 }}>{c.profile.displayName}</Text>
              <Button title="Meetings" size="sm" variant="secondary" onPress={() => setMeetingsFor(c)} />
            </Card>
          ))}
        </Section>
      )}

      {(me.data?.familyOf ?? []).filter((f) => f.profileId !== profileId).map((f) => (
        <Button key={f.profileId} title={`Switch to helping ${f.ownerName}`} variant="secondary" onPress={() => router.replace(`/family/of/${f.profileId}` as Href)} />
      ))}
      {helperOnly && (
        <Card style={{ gap: space.sm }}>
          <Text variant="bodyMuted">Looking for a partner yourself? You can create your own profile any time.</Text>
          <Button title="Create my own profile" variant="secondary" onPress={() => router.push('/onboarding')} />
          <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
        </Card>
      )}
      <Sheet visible={!!suggesting} onClose={() => setSuggesting(null)} title={`Suggest ${suggesting?.displayName ?? ''}`}>
        <Text variant="bodyMuted">{name} will see your note and decide.</Text>
        <TextField label="Why you think they might align" optional multiline maxLength={500} value={note} onChangeText={setNote} />
        <Button title="Send suggestion" onPress={suggest} loading={busy} full />
      </Sheet>
      <Sheet visible={!!discussing} onClose={() => setDiscussing(null)} title={`About ${discussing?.displayName ?? ''}`}>
        {discussing && <DiscussionThread ownerProfileId={profileId} targetProfileId={discussing.id} />}
      </Sheet>
      <Sheet visible={!!meetingsFor} onClose={() => setMeetingsFor(null)} title={`Meetings with ${meetingsFor?.profile.displayName ?? ''}`}>
        {meetingsFor && <Meetings connectionId={meetingsFor.id} active canRespond={false} />}
      </Sheet>
    </Screen>
  );
}

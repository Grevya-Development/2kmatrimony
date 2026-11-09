import * as React from 'react';
import { Alert, Pressable, Share, View } from 'react-native';
import { router, type Href } from 'expo-router';
import type { OwnProfileResponse } from '@2k/shared';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { keys, useMe, useOwnProfile, useQueryClient } from '@/hooks/queries';
import { colors, fonts, space } from '@/theme';
import { Avatar, Badge, Button, Card, ErrorState, Icon, Notice, Screen, Section, Skeleton, Text } from '@/components/ui';
import { PhotoManager } from '@/components/domain/PhotoManager';
import { VideoManager } from '@/components/domain/VideoManager';
import { DnaChart } from '@/components/domain/DnaChart';

const SECTIONS: { key: string; label: string }[] = [
  { key: 'basics', label: 'Basic details' }, { key: 'education', label: 'Education' }, { key: 'career', label: 'Career' },
  { key: 'family', label: 'Family' }, { key: 'lifestyle', label: 'Lifestyle & interests' }, { key: 'values', label: 'Values & future' },
  { key: 'preferences', label: 'Partner preferences' },
];

function LinkRow({ icon, label, href, onPress, detail }: { icon: string; label: string; href?: Href; onPress?: () => void; detail?: string }) {
  return (
    <Pressable onPress={onPress ?? (() => href && router.push(href))} accessibilityRole="link" android_ripple={{ color: colors.line }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Icon name={icon} size={20} />
      <Text variant="body" style={{ flex: 1 }}>{label}</Text>
      {detail && <Text variant="small">{detail}</Text>}
      <Icon name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function MyProfile() {
  const qc = useQueryClient();
  const me = useMe();
  const profile = useOwnProfile();
  const { signOut } = useAuth();
  const p: OwnProfileResponse | undefined = profile.data;

  const refresh = () => { void profile.refetch(); void qc.invalidateQueries({ queryKey: keys.me }); };

  return (
    <Screen edges={[]} refreshing={profile.isRefetching} onRefresh={refresh}>
      {profile.isLoading ? <Skeleton height={200} /> : profile.error || !p ? <ErrorState message={errorMessage(profile.error)} onRetry={refresh} /> : (
        <>
          <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            <Avatar uri={p.photos.find((x) => x.isPrimary)?.url ?? null} name={p.detail?.displayName ?? 'Me'} size={64} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="title">{p.detail?.displayName ?? 'Your profile'}</Text>
              <Text variant="small">{p.profileCode} · {me.data?.plan.name ?? 'Free'} plan</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Badge label={p.status === 'active' ? 'Visible' : p.status} tone={p.status === 'active' ? 'success' : 'warning'} />
                <Badge label={`${p.completion.pct}% complete`} tone="gold" />
              </View>
            </View>
          </Card>
          {p.completion.missing.length > 0 && (
            <Notice>To improve your matches, add: {p.completion.missing.map((m) => m.label).join(', ')}.</Notice>
          )}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Preview as others see it" variant="secondary" size="sm" onPress={() => router.push(`/member/${p.profileId}` as Href)} />
            <Button title="Share" variant="ghost" size="sm" icon={<Icon name="share" size={16} />} onPress={() => Share.share({ message: `My 2K Matrimony profile code is ${p.profileCode}.` })} />
          </View>
          <Section title="Photos">
            <PhotoManager photos={p.photos} max={p.limits.maxPhotos} onChanged={refresh} />
          </Section>
          {me.data?.featureFlags.video_intros !== false && (
            <Section title="Video introduction">
              <VideoManager video={p.video} limits={p.limits} onChanged={refresh} />
            </Section>
          )}
          <Section title="Relationship DNA" action={<Button title="Edit" size="sm" variant="ghost" onPress={() => router.push('/me/dna')} />}>
            {p.form.dna.length ? <DnaChart entries={p.form.dna} size={280} /> : <Button title="Answer DNA questions" variant="secondary" onPress={() => router.push('/me/dna')} />}
          </Section>
          <Section title="Profile details">
            <View>{SECTIONS.map((s) => <LinkRow key={s.key} icon="user" label={s.label} href={`/me/edit/${s.key}` as Href} detail={p.completion.missing.some((m) => m.section === s.key) ? 'Incomplete' : undefined} />)}</View>
          </Section>
          {(me.data?.familyOf ?? []).length > 0 && (
            <Section title="People you help">
              <View>{me.data!.familyOf.map((f) => <LinkRow key={f.profileId} icon="users" label={`Helping ${f.ownerName}`} href={`/family/of/${f.profileId}` as Href} />)}</View>
            </Section>
          )}
          <Section title="More">
            <View>
              <LinkRow icon="users" label="Connections" href="/connections" />
              <LinkRow icon="bookmark" label="Shortlist" href="/shortlist" />
              <LinkRow icon="shield" label="Verification" href="/verification" />
              {me.data?.featureFlags.family_mode !== false && <LinkRow icon="users" label="Family" href="/family" />}
              {me.data?.featureFlags.readiness_assistant !== false && <LinkRow icon="compass" label="Readiness assistant" href="/readiness" />}
              {me.data?.featureFlags.payments === true && <LinkRow icon="gem" label="Plans & billing" href="/billing" detail={me.data?.plan.name} />}
              <LinkRow icon="bell" label="Notifications" href="/notifications" />
              <LinkRow icon="settings" label="Settings & privacy" href="/settings" />
              <LinkRow icon="chat" label="Help & support" href="/support" />
              <LinkRow icon="lock" label="Sign out" onPress={() => Alert.alert('Sign out?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => void signOut() }])} />
            </View>
          </Section>
          <Text variant="small" style={{ textAlign: 'center', fontFamily: fonts.body }}>Profiles stay private to signed-in members. You control who sees photos and sensitive details.</Text>
        </>
      )}
    </Screen>
  );
}

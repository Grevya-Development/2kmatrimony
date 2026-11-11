import * as React from 'react';
import { Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { PROFILE_CHECKLIST } from '@2k/shared';
import { useOwnProfile } from '@/hooks/queries';
import { colors, space } from '@/theme';
import { Button, Card, Icon, Text } from '@/components/ui';

/** Order in which optional sections are suggested after onboarding. */
const ORDER = ['photos', 'about', 'values', 'dna', 'career', 'education', 'family', 'lifestyle'] as const;
const VISIBLE = 3;

const HREF: Record<string, Href> = {
  photos: '/me', about: '/me/edit/basics', basics: '/me/edit/basics', dna: '/me/dna',
  education: '/me/edit/education', career: '/me/edit/career', family: '/me/edit/family',
  lifestyle: '/me/edit/lifestyle', values: '/me/edit/values', preferences: '/me/edit/preferences',
};

/**
 * "Complete your profile": the optional sections still missing after quick onboarding.
 * Hidden when nothing is missing. `onPhotos` overrides the photos row (e.g. on the Me tab,
 * where photos are managed on the same screen).
 */
export function ProfileChecklist({ onPhotos }: { onPhotos?: () => void }) {
  const profile = useOwnProfile();
  const [expanded, setExpanded] = React.useState(false);
  const completion = profile.data?.completion;
  if (!completion) return null;

  const missing = new Set(completion.missing.filter((m) => !m.required).map((m) => m.section));
  const items = ORDER.filter((s) => missing.has(s) && PROFILE_CHECKLIST[s]);
  if (!items.length) return null;
  const shown = expanded ? items : items.slice(0, VISIBLE);
  const pct = Math.max(0, Math.min(100, completion.pct));

  const open = (section: string) => {
    if (section === 'photos' && onPhotos) return onPhotos();
    const href = HREF[section];
    if (href) router.push(href);
  };

  return (
    <Card style={{ gap: space.md }}>
      <View style={{ gap: 6 }}>
        <Text variant="eyebrow">Complete your profile</Text>
        <Text variant="heading" accessibilityRole="header">{pct}% complete</Text>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.line }} accessibilityRole="progressbar" accessibilityLabel="Profile completion" accessibilityValue={{ min: 0, max: 100, now: pct }}>
          <View style={{ height: 4, borderRadius: 2, width: `${pct}%`, backgroundColor: colors.emerald500 }} />
        </View>
        <Text variant="small">A few more details help us suggest better matches. Each takes a minute or two.</Text>
      </View>
      <View>
        {shown.map((s, i) => {
          const c = PROFILE_CHECKLIST[s]!;
          return (
            <Pressable key={s} onPress={() => open(s)} accessibilityRole="button" accessibilityLabel={`${c.title}, about ${c.minutes} minute${c.minutes === 1 ? '' : 's'}`} accessibilityHint={c.why}
              android_ripple={{ color: colors.line }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.line }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label" style={{ color: colors.ink }}>{c.title}</Text>
                <Text variant="small">{c.why}</Text>
              </View>
              <Text variant="small">~{c.minutes} min</Text>
              <Icon name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
          );
        })}
      </View>
      {items.length > VISIBLE && (
        <Button title={expanded ? 'Show fewer' : `Show all (${items.length})`} variant="ghost" size="sm" onPress={() => setExpanded((e) => !e)}
          accessibilityState={{ expanded }} style={{ alignSelf: 'flex-start' }} />
      )}
    </Card>
  );
}

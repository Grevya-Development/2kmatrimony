import * as React from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { CREATED_FOR_OPTIONS, quickStepFor, type CreatedFor, type OwnProfileResponse, type QuickOnboardingStep } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import { keys, useMe } from '@/hooks/queries';
import { colors, space } from '@/theme';
import { Button, ChipGroup, ErrorState, Loading, Notice, Screen, Switch, Text, TextField } from '@/components/ui';
import { EssentialsForm, PartnerBasicsForm } from '@/components/forms';
import { PhotoManager } from '@/components/domain/PhotoManager';

/**
 * Quick onboarding (about two minutes): who it's for → essentials → who they'd like to meet → photo.
 * Everything else is gathered afterwards through the "Complete your profile" checklist.
 */
const STEPS = ['basics', 'preferences', 'photos'] as const;
type Step = Exclude<QuickOnboardingStep, 'done'>;
const TITLES: Record<Step, [string, string]> = {
  start: ['Let’s begin', 'Who is this profile for? It takes about two minutes.'],
  basics: ['The essentials', 'Just a few details. {You} can add the rest later.'],
  preferences: ['Who {you}’d like to meet', 'A starting point. Adjust it anytime.'],
  photos: ['Add a photo', 'Optional, but profiles with a clear photo get far more thoughtful interest.'],
};

export default function Onboarding() {
  const qc = useQueryClient();
  const { signOut } = useAuth();
  const me = useMe();
  const [step, setStep] = React.useState<Step | null>(null);
  const [profile, setProfile] = React.useState<OwnProfileResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [finishing, setFinishing] = React.useState(false);

  const loadProfile = React.useCallback(async () => {
    const p = await api.get<OwnProfileResponse>('/profile');
    setProfile(p);
    return p;
  }, []);

  /** First required section still missing, as a quick-flow step. */
  const firstRequiredStep = (p: OwnProfileResponse | null): Step | null => {
    const req = (p?.completion.missing ?? []).filter((m) => m.required).map((m) => m.section);
    return req.includes('basics') ? 'basics' : req.includes('preferences') ? 'preferences' : null;
  };

  // Resume where the member left off (older long-flow steps map onto the quick flow).
  React.useEffect(() => {
    if (!me.data) return;
    if (!me.data.profile || me.data.consentsRequired.length) { setStep('start'); return; }
    const status = me.data.profile.status;
    loadProfile().then((p) => {
      const next = quickStepFor(p.onboardingStep, true);
      if (next !== 'done') return setStep(next);
      if (status !== 'draft') return void router.replace('/');
      setStep(firstRequiredStep(p) ?? 'photos');
    }).catch((e) => setError(errorMessage(e)));
  }, [me.data, loadProfile]);

  const forSelf = (profile?.createdFor ?? 'self') === 'self';
  const copy = (s: string) => s
    .replace(/\{You\}/g, forSelf ? 'You' : 'They').replace(/\{you\}/g, forSelf ? 'you' : 'they');
  const idx = step ? STEPS.indexOf(step as (typeof STEPS)[number]) : -1;

  // Note: `me` is deliberately not refetched between steps. Once the essentials and partner
  // preferences are saved the profile leaves 'draft', and the root gate would leave onboarding
  // before the photo step.
  const goTo = async (next: Step) => {
    await api.patch('/profile', { onboardingStep: next }).catch(() => undefined);
    await loadProfile().catch(() => null);
    setError(null);
    setStep(next);
  };

  const finish = async () => {
    setFinishing(true); setError(null);
    try {
      await api.patch('/profile', { onboardingStep: 'done' }).catch(() => undefined);
      const p = await loadProfile().catch(() => null);
      await qc.invalidateQueries({ queryKey: keys.profile });
      await qc.invalidateQueries({ queryKey: keys.me });
      const refreshed = await me.refetch();
      if (refreshed.data?.profile?.status === 'draft') {
        const missing = (p?.completion.missing ?? []).filter((m) => m.required).map((m) => m.label).join(', ');
        setError(missing ? `A few details are still missing: ${missing}.` : 'We couldn’t finish setting up your profile. Please try again.');
        const back = firstRequiredStep(p);
        if (back) setStep(back);
        return;
      }
      haptic.success();
      if (refreshed.data?.profile?.status === 'in_review') {
        Alert.alert('Your profile is with our team', 'Every profile is reviewed by a real person before it goes live — usually within 24 hours. We’ll notify you when it’s approved. Meanwhile, you can add more details from your profile.');
      }
      router.replace('/');
    } finally { setFinishing(false); }
  };

  if (!step) return <Screen>{error ? <ErrorState message={error} onRetry={() => me.refetch()} /> : <Loading />}</Screen>;
  const [title, subtitle] = TITLES[step];
  const f = profile?.form;

  return (
    <Screen edges={['top', 'bottom']} keyboardShouldPersistTaps="handled">
      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="eyebrow">{idx >= 0 ? `Step ${idx + 1} of ${STEPS.length}` : 'Welcome'}</Text>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            {idx > 0 && <Pressable onPress={() => { setError(null); setStep(STEPS[idx - 1]!); }} accessibilityRole="button" accessibilityLabel="Back to previous step" hitSlop={8}><Text variant="label">Back</Text></Pressable>}
            <Pressable onPress={() => signOut()} accessibilityRole="button" hitSlop={8}><Text variant="label">Sign out</Text></Pressable>
          </View>
        </View>
        {idx >= 0 && (
          <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.line }} accessibilityRole="progressbar" accessibilityLabel="Onboarding progress" accessibilityValue={{ min: 0, max: STEPS.length, now: idx + 1 }}>
            <View style={{ height: 4, borderRadius: 2, width: `${((idx + 1) / STEPS.length) * 100}%`, backgroundColor: colors.emerald500 }} />
          </View>
        )}
        <Text variant="hero" accessibilityRole="header">{copy(title)}</Text>
        <Text variant="bodyMuted">{copy(subtitle)}</Text>
      </View>
      {error && <ErrorState message={error} />}

      {step === 'start' && <StartStep existing={!!me.data?.profile} onDone={async () => { await me.refetch(); await loadProfile().catch(() => null); setStep('basics'); }} />}
      {step === 'basics' && (
        <EssentialsForm key={profile?.profileId ?? 'new'} forSelf={forSelf} initial={f?.basics ?? {}}
          onSubmit={async (values) => { await api.put('/profile/basics', values); await goTo('preferences'); }} />
      )}
      {step === 'preferences' && (
        <PartnerBasicsForm key={profile?.profileId ?? 'new'} forSelf={forSelf} initial={f?.preferences ?? null} basics={f?.basics ?? {}}
          onSubmit={async (values) => { await api.put('/profile/preferences', values); await goTo('photos'); }} />
      )}
      {step === 'photos' && profile && (
        <View style={{ gap: space.lg }}>
          <PhotoManager photos={profile.photos} max={profile.limits.maxPhotos} onChanged={() => void loadProfile()} />
          <View style={{ gap: space.sm }}>
            <Button title="Finish" size="lg" onPress={finish} loading={finishing} full />
            {!profile.photos.length && <Button title="Skip for now" variant="ghost" onPress={finish} disabled={finishing} />}
          </View>
        </View>
      )}
    </Screen>
  );
}

function StartStep({ existing, onDone }: { existing: boolean; onDone: () => Promise<void> }) {
  const [createdFor, setCreatedFor] = React.useState<CreatedFor[]>(['self']);
  const [relation, setRelation] = React.useState('');
  const [terms, setTerms] = React.useState(false);
  // Optional consents are opt-in (DPDP): never pre-ticked.
  const [ai, setAi] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const go = async () => {
    if (!terms) return setError('Please accept the Terms and Privacy Policy to continue.');
    setBusy(true); setError(null);
    try {
      if (existing) {
        // Profile exists; only consents need refreshing (e.g. a new policy version).
        await api.post('/settings/consents', { consentType: 'terms', granted: true });
        await api.post('/settings/consents', { consentType: 'privacy', granted: true });
      } else {
        await api.post('/profile', { createdFor: createdFor[0] ?? 'self', managedByRelation: relation.trim() || null, consents: { terms: true, privacy: true, aiProcessing: ai } });
      }
      await onDone();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <View style={{ gap: space.lg }}>
      {!existing && <ChipGroup label="Profile is for" options={CREATED_FOR_OPTIONS} value={createdFor} onChange={setCreatedFor} />}
      {!existing && createdFor[0] !== 'self' && (
        <>
          <TextField label="Your relationship to them" optional value={relation} onChangeText={setRelation} placeholder="e.g. Mother" />
          <Notice>Please create a profile for someone else only with their consent. They stay in control of interests and conversations.</Notice>
        </>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Switch accessibilityLabel="Accept terms and privacy policy" value={terms} onValueChange={setTerms} trackColor={{ true: colors.emerald500, false: colors.lineStrong }} />
        <Text variant="body" style={{ flex: 1 }}>I agree to the Terms of Service and Privacy Policy, and confirm I am 18 or older.</Text>
      </View>
      {!existing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Switch accessibilityLabel="Allow AI matchmaking features (optional)" value={ai} onValueChange={setAi} trackColor={{ true: colors.emerald500, false: colors.lineStrong }} />
          <Text variant="body" style={{ flex: 1 }}>Use AI to explain matches and help me search. AI never reads my private messages. (Optional)</Text>
        </View>
      )}
      {error && <ErrorState message={error} />}
      <Button title="Continue" size="lg" onPress={go} loading={busy} full />
    </View>
  );
}

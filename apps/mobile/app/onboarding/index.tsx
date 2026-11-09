import * as React from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { CREATED_FOR_OPTIONS, ONBOARDING_STEPS, type CreatedFor, type OnboardingQuestion, type OnboardingStep, type OwnProfileResponse } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import { keys, useMe } from '@/hooks/queries';
import { colors, space } from '@/theme';
import { Button, ChipGroup, ErrorState, Loading, Notice, Screen, Switch, Text, TextField } from '@/components/ui';
import { BasicsForm, CareerForm, EducationForm, FamilyForm, LifestyleForm, PreferencesForm, QuestionsForm } from '@/components/forms';
import { PhotoManager } from '@/components/domain/PhotoManager';

const ORDER = ONBOARDING_STEPS.filter((s) => s !== 'done');
const TITLES: Record<OnboardingStep, [string, string]> = {
  start: ['Let’s begin', 'Who is this profile for?'],
  basics: ['The basics', 'Just the essentials — you can edit anything later.'],
  education: ['Education', 'Optional, but it helps people understand {you}.'],
  career: ['Work', 'What {you} do, and how {you} think about it.'],
  family: ['Family', 'A little about {your} family.'],
  lifestyle: ['Lifestyle', 'Everyday rhythms and interests.'],
  values: ['Values & future', 'What matters most to {you}, and where {you} are headed.'],
  dna: ['Relationship DNA', 'Where {you} sit on a few spectrums. There are no right answers.'],
  preferences: ['Partner preferences', 'Who {you}’d like to meet. Only non-negotiables are strict.'],
  photos: ['Photos', 'Profiles with photos receive more thoughtful interest.'],
  done: ['All set', ''],
};
const SECTION_OF: Partial<Record<OnboardingStep, string>> = { basics: 'basics', education: 'education', career: 'career', family: 'family', lifestyle: 'lifestyle', values: 'values', dna: 'dna', preferences: 'preferences', photos: 'photos' };

export default function Onboarding() {
  const qc = useQueryClient();
  const { signOut } = useAuth();
  const me = useMe();
  const [step, setStep] = React.useState<OnboardingStep | null>(null);
  const [profile, setProfile] = React.useState<OwnProfileResponse | null>(null);
  const [questions, setQuestions] = React.useState<OnboardingQuestion[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const loadProfile = React.useCallback(async () => {
    const p = await api.get<OwnProfileResponse>('/profile');
    setProfile(p);
    return p;
  }, []);

  // Resume where the member left off.
  React.useEffect(() => {
    if (!me.data) return;
    if (!me.data.profile) { setStep('start'); return; }
    if (me.data.consentsRequired.length) { setStep('start'); return; }
    loadProfile().then((p) => {
      const saved = p.onboardingStep as OnboardingStep | null;
      if (saved && saved !== 'done' && saved !== 'start' && ORDER.includes(saved)) return setStep(saved);
      const firstMissing = ORDER.find((s) => p.completion.missing.some((m) => m.section === SECTION_OF[s] && m.required));
      setStep(firstMissing ?? 'photos');
    }).catch((e) => setError(errorMessage(e)));
  }, [me.data, loadProfile]);

  React.useEffect(() => {
    if (step === 'values' || step === 'dna') {
      setQuestions([]);
      api.get<OnboardingQuestion[]>('/onboarding/questions', { section: step }).then(setQuestions).catch((e) => setError(errorMessage(e)));
    }
  }, [step]);

  const forSelf = (profile?.createdFor ?? 'self') === 'self';
  const copy = (s: string) => s.replace(/\{you\}/g, forSelf ? 'you' : 'they').replace(/\{your\}/g, forSelf ? 'your' : 'their');
  const idx = step ? ORDER.indexOf(step as (typeof ORDER)[number]) : 0;

  const advance = async () => {
    const next = ORDER[idx + 1] ?? 'done';
    await api.patch('/profile', { onboardingStep: next }).catch(() => undefined);
    const p = await loadProfile().catch(() => null);
    if (next === 'done') return finish(p);
    setStep(next);
  };

  const finish = async (p: OwnProfileResponse | null) => {
    await qc.invalidateQueries({ queryKey: keys.me });
    const refreshed = await me.refetch();
    if (refreshed.data?.profile?.status === 'draft' || (p && !p.completion.canActivate)) {
      const missing = (p?.completion.missing ?? []).filter((m) => m.required).map((m) => m.label).join(', ');
      setError(`A few required sections are still missing: ${missing}.`);
      const firstMissing = ORDER.find((s) => p?.completion.missing.some((m) => m.section === SECTION_OF[s] && m.required));
      if (firstMissing) setStep(firstMissing);
      return;
    }
    haptic.success();
    router.replace('/');
  };

  const save = (path: string, method: 'put' | 'post' = 'put') => async (values: unknown) => {
    await (method === 'put' ? api.put(path, values) : api.post(path, values));
    await advance();
  };

  if (!step) return <Screen>{error ? <ErrorState message={error} onRetry={() => me.refetch()} /> : <Loading />}</Screen>;
  const [title, subtitle] = TITLES[step];
  const f = profile?.form;

  return (
    <Screen edges={['top', 'bottom']} keyboardShouldPersistTaps="handled">
      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="eyebrow">Step {idx + 1} of {ORDER.length}</Text>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            {idx > 1 && <Pressable onPress={() => setStep(ORDER[idx - 1]!)} accessibilityRole="button" hitSlop={8}><Text variant="label">Back</Text></Pressable>}
            <Pressable onPress={() => signOut()} accessibilityRole="button" hitSlop={8}><Text variant="label">Sign out</Text></Pressable>
          </View>
        </View>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.line }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: ORDER.length, now: idx + 1 }}>
          <View style={{ height: 4, borderRadius: 2, width: `${((idx + 1) / ORDER.length) * 100}%`, backgroundColor: colors.emerald500 }} />
        </View>
        <Text variant="hero" accessibilityRole="header">{title}</Text>
        <Text variant="bodyMuted">{copy(subtitle)}</Text>
      </View>
      {error && <ErrorState message={error} />}

      {step === 'start' && <StartStep existing={!!me.data?.profile} onDone={async () => { await me.refetch(); await loadProfile().catch(() => null); setStep('basics'); }} />}
      {step === 'basics' && <BasicsForm forSelf={forSelf} initial={f?.basics ?? {}} onSubmit={save('/profile/basics')} />}
      {step === 'education' && <EducationForm initial={{ items: f?.education ?? [] }} onSubmit={save('/profile/education')} onSkip={advance} />}
      {step === 'career' && <CareerForm initial={f?.career ?? {}} onSubmit={save('/profile/career')} onSkip={advance} />}
      {step === 'family' && <FamilyForm initial={f?.family ?? {}} onSubmit={save('/profile/family')} onSkip={advance} />}
      {step === 'lifestyle' && <LifestyleForm initial={f?.lifestyle ?? {}} onSubmit={save('/profile/lifestyle')} onSkip={advance} />}
      {(step === 'values' || step === 'dna') && (questions.length
        ? <QuestionsForm key={step} questions={questions} onSubmit={async (answers) => { await api.post('/onboarding/answers', { answers }); await advance(); }} />
        : <Loading label="Loading questions" />)}
      {step === 'preferences' && <PreferencesForm forSelf={forSelf} initial={f?.preferences ?? {}} onSubmit={save('/profile/preferences')} />}
      {step === 'photos' && profile && (
        <View style={{ gap: space.lg }}>
          <PhotoManager photos={profile.photos} max={profile.limits.maxPhotos} onChanged={() => void loadProfile()} />
          <Button title={profile.photos.length ? 'Finish' : 'Finish without photos'} size="lg" onPress={advance} full />
        </View>
      )}
    </Screen>
  );
}

function StartStep({ existing, onDone }: { existing: boolean; onDone: () => Promise<void> }) {
  const [createdFor, setCreatedFor] = React.useState<CreatedFor[]>(['self']);
  const [relation, setRelation] = React.useState('');
  const [terms, setTerms] = React.useState(false);
  const [ai, setAi] = React.useState(true);
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
          <Switch accessibilityLabel="Allow AI matchmaking features" value={ai} onValueChange={setAi} trackColor={{ true: colors.emerald500, false: colors.lineStrong }} />
          <Text variant="body" style={{ flex: 1 }}>Use AI to explain matches and help me search. AI never reads my private messages. (Optional)</Text>
        </View>
      )}
      {error && <ErrorState message={error} />}
      <Button title="Continue" size="lg" onPress={go} loading={busy} full />
    </View>
  );
}

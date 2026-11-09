import * as React from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { OnboardingQuestion } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { keys, useOwnProfile, useQueryClient } from '@/hooks/queries';
import { ErrorState, Loading, Screen } from '@/components/ui';
import { BasicsForm, CareerForm, EducationForm, FamilyForm, LifestyleForm, PreferencesForm, QuestionsForm } from '@/components/forms';

const TITLES: Record<string, string> = { basics: 'Basic details', education: 'Education', career: 'Career', family: 'Family', lifestyle: 'Lifestyle', values: 'Values & future', preferences: 'Partner preferences' };

export default function EditSection() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const qc = useQueryClient();
  const profile = useOwnProfile();
  const questions = useQuery({ queryKey: ['questions', 'values'], queryFn: () => api.get<OnboardingQuestion[]>('/onboarding/questions', { section: 'values' }), enabled: section === 'values' });

  const done = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: keys.profile }), qc.invalidateQueries({ queryKey: keys.me })]);
    Alert.alert('Saved', 'Your profile has been updated.');
    router.back();
  };
  const put = (path: string) => async (v: unknown) => { await api.put(path, v); await done(); };

  if (profile.isLoading) return <Screen><Loading /></Screen>;
  if (profile.error || !profile.data) return <Screen><ErrorState message={errorMessage(profile.error)} onRetry={() => profile.refetch()} /></Screen>;
  const f = profile.data.form;
  const forSelf = profile.data.createdFor === 'self';

  return (
    <Screen edges={[]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: TITLES[section] ?? 'Edit' }} />
      {section === 'basics' && <BasicsForm forSelf={forSelf} initial={f.basics} onSubmit={put('/profile/basics')} submitLabel="Save" />}
      {section === 'education' && <EducationForm initial={{ items: f.education }} onSubmit={put('/profile/education')} submitLabel="Save" />}
      {section === 'career' && <CareerForm initial={f.career} onSubmit={put('/profile/career')} submitLabel="Save" />}
      {section === 'family' && <FamilyForm initial={f.family} onSubmit={put('/profile/family')} submitLabel="Save" />}
      {section === 'lifestyle' && <LifestyleForm initial={f.lifestyle} onSubmit={put('/profile/lifestyle')} submitLabel="Save" />}
      {section === 'preferences' && <PreferencesForm forSelf={forSelf} initial={f.preferences ?? {}} onSubmit={put('/profile/preferences')} submitLabel="Save" />}
      {section === 'values' && (questions.data ? <QuestionsForm questions={questions.data} submitLabel="Save" onSubmit={async (answers) => { await api.post('/onboarding/answers', { answers }); await done(); }} />
        : questions.error ? <ErrorState message={errorMessage(questions.error)} /> : <Loading />)}
    </Screen>
  );
}

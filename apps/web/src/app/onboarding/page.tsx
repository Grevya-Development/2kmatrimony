import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getServerAuth } from '@/server/auth';
import { buildMe } from '@/server/me';
import { getOwnProfile } from '@/server/profile/service';
import { listQuestions } from '@/server/profile/questions';
import { OnboardingWizard } from '@/components/onboarding/wizard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Create your profile' };

export default async function OnboardingPage() {
  const auth = await getServerAuth();
  if (!auth) redirect('/login?next=/onboarding');
  const me = await buildMe(auth);
  if (me.profile?.onboardingStep === 'done' && me.consentsRequired.length === 0) redirect('/app');
  const [profile, questions] = await Promise.all([auth.profile ? getOwnProfile(auth) : Promise.resolve(null), listQuestions(auth)]);
  return <OnboardingWizard initialProfile={profile} questions={questions} consentsRequired={me.consentsRequired} videoEnabled={me.featureFlags.video_intros !== false} />;
}

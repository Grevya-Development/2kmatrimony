import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getServerAuth } from '@/server/auth';
import { buildMe } from '@/server/me';
import { getOwnProfile } from '@/server/profile/service';
import { OnboardingWizard } from '@/components/onboarding/wizard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Create your profile' };

export default async function OnboardingPage() {
  const auth = await getServerAuth();
  if (!auth) redirect('/login?next=/onboarding');
  const me = await buildMe(auth);
  if (me.profile?.onboardingStep === 'done' && me.consentsRequired.length === 0) redirect('/app');
  const profile = auth.profile ? await getOwnProfile(auth) : null;
  return <OnboardingWizard initialProfile={profile} consentsRequired={me.consentsRequired} />;
}

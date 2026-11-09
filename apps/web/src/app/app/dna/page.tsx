import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerAuth } from '@/server/auth';
import { getOwnProfile } from '@/server/profile/service';
import { hasAiConsent } from '@/server/profile/dna-ai';
import { PageHeader } from '@/components/ui';
import { DnaEditor } from '@/components/dna/dna-editor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Relationship DNA' };

export default async function DnaPage() {
  const auth = await getServerAuth();
  if (!auth?.profile) redirect('/onboarding');
  const [own, consent] = await Promise.all([getOwnProfile(auth), hasAiConsent(auth.userId)]);
  return (
    <>
      <PageHeader eyebrow="Self-described" title="Relationship DNA"
        description="How you like to connect, live and plan — in your own terms. It shapes who we introduce, and you can change it anytime. It is not a personality test." />
      <DnaEditor initial={own.form.dna} aiConsent={consent} />
    </>
  );
}

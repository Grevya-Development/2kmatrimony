import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerAuth } from '@/server/auth';
import { buildMe } from '@/server/me';
import { MeProvider } from '@/components/shell/me-context';
import { FamilyMemberView } from '@/components/family/member-view';

export const metadata: Metadata = { title: 'Family circle', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function FamilyMemberPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const auth = await getServerAuth();
  if (!auth) redirect(`/login?next=/family/${profileId}`);
  const me = await buildMe(auth);
  return <MeProvider initial={me}><FamilyMemberView profileId={profileId} /></MeProvider>;
}

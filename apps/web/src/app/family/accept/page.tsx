import type { Metadata } from 'next';
import { getServerAuth } from '@/server/auth';
import { AcceptInvite } from '@/components/family/accept-invite';

export const metadata: Metadata = { title: 'Family invitation', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AcceptPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  const auth = await getServerAuth();
  return <AcceptInvite token={token} signedIn={!!auth} />;
}

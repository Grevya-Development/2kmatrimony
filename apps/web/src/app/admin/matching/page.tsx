import type { Metadata } from 'next';
import { MatchingPage } from '@/components/admin/pages/matching';

export const metadata: Metadata = { title: 'Matchmaking' };

export default function Page() {
  return <MatchingPage />;
}

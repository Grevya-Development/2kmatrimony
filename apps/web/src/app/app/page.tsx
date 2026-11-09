import { ActiveProfileGate } from '@/components/shell/profile-gate';
import type { Metadata } from 'next';
import { ForYou } from '@/components/discovery/for-you';

export const metadata: Metadata = { title: 'For you' };

export default function ForYouPage() {
  return <ActiveProfileGate><ForYou /></ActiveProfileGate>;
}

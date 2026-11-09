import { ActiveProfileGate } from '@/components/shell/profile-gate';
import type { Metadata } from 'next';
import { ShortlistView } from '@/components/interests/shortlist-view';

export const metadata: Metadata = { title: 'Shortlist' };
export default function ShortlistPage() { return <ActiveProfileGate><ShortlistView /></ActiveProfileGate>; }

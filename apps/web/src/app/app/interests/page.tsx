import type { Metadata } from 'next';
import { InterestsView } from '@/components/interests/interests-view';

export const metadata: Metadata = { title: 'Interests' };
export default function InterestsPage() { return <InterestsView />; }

import type { Metadata } from 'next';
import { SupportList } from '@/components/support/member-support';

export const metadata: Metadata = { title: 'Help & support' };

export default function Page() {
  return <SupportList />;
}

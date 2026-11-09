import type { Metadata } from 'next';
import { OverviewPage } from '@/components/admin/pages/overview';

export const metadata: Metadata = { title: 'Overview' };

export default function Page() {
  return <OverviewPage />;
}

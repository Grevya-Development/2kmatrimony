import type { Metadata } from 'next';
import { ScreeningPage } from '@/components/admin/pages/screening';

export const metadata: Metadata = { title: 'Screening' };

export default function Page() {
  return <ScreeningPage />;
}

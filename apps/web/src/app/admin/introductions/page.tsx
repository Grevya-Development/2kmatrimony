import type { Metadata } from 'next';
import { IntroductionsPage } from '@/components/admin/pages/introductions';

export const metadata: Metadata = { title: 'Introductions' };

export default function Page() {
  return <IntroductionsPage />;
}

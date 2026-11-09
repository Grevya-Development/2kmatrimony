import type { Metadata } from 'next';
import { ContentPage } from '@/components/admin/pages/content';

export const metadata: Metadata = { title: 'Content' };

export default function Page() {
  return <ContentPage />;
}

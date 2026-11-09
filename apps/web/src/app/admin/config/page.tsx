import type { Metadata } from 'next';
import { ConfigPage } from '@/components/admin/pages/config';

export const metadata: Metadata = { title: 'Configuration' };

export default function Page() {
  return <ConfigPage />;
}

import type { Metadata } from 'next';
import { AiOpsPage } from '@/components/admin/pages/ai';

export const metadata: Metadata = { title: 'AI operations' };

export default function Page() {
  return <AiOpsPage />;
}

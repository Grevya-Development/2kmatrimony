import type { Metadata } from 'next';
import { VerificationPage } from '@/components/admin/pages/verification';

export const metadata: Metadata = { title: 'Verification' };

export default function Page() {
  return <VerificationPage />;
}

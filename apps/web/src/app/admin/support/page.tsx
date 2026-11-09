import type { Metadata } from 'next';
import { SupportAdminPage } from '@/components/admin/pages/support-admin';

export const metadata: Metadata = { title: 'Support' };

export default function Page() {
  return <SupportAdminPage />;
}

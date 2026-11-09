import type { Metadata } from 'next';
import { AuditPage } from '@/components/admin/pages/audit';

export const metadata: Metadata = { title: 'Audit logs' };

export default function Page() {
  return <AuditPage />;
}

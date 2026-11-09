import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerAuth } from '@/server/auth';
import { SuperAdminPage } from '@/components/admin/pages/super';

export const metadata: Metadata = { title: 'Super admin' };

export default async function Page() {
  const auth = await getServerAuth();
  if (!auth?.admin?.isSuperAdmin) redirect('/admin');
  return <SuperAdminPage />;
}

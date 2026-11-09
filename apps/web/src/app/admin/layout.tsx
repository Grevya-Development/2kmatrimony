import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getServerAuth } from '@/server/auth';
import { buildMe } from '@/server/me';
import { AdminShell } from '@/components/shell/admin-shell';
import { AdminMfaGate } from '@/components/admin/mfa-gate';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin', robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await getServerAuth();
  if (!auth) redirect('/login?next=/admin');
  if (!auth.admin) redirect('/app');
  const me = await buildMe(auth);
  if (auth.admin.mfaRequired && auth.aal !== 'aal2') return <AdminMfaGate />;
  return <AdminShell me={me}>{children}</AdminShell>;
}

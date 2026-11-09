import { redirect } from 'next/navigation';
import { getServerAuth } from '@/server/auth';
import { buildMe } from '@/server/me';
import { AppShell } from '@/components/shell/app-shell';

export const dynamic = 'force-dynamic';

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const auth = await getServerAuth();
  if (!auth) redirect('/login?next=/app');
  const me = await buildMe(auth);
  if (me.consentsRequired.length || !auth.profile) redirect('/onboarding');
  return <AppShell me={me}>{children}</AppShell>;
}

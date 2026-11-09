import { redirect } from 'next/navigation';
import { getServerAuth } from '@/server/auth';
import { buildMe } from '@/server/me';
import { AppShell } from '@/components/shell/app-shell';
import { NotificationsSync } from '@/components/notifications/notifications-sync';
import { AnalyticsIdentity } from '@/components/analytics/analytics-identity';

export const dynamic = 'force-dynamic';

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const auth = await getServerAuth();
  if (!auth) redirect('/login?next=/app');
  const me = await buildMe(auth);
  if (me.consentsRequired.length || !auth.profile) redirect('/onboarding');
  return (
    <AppShell me={me}>
      <NotificationsSync />
      <AnalyticsIdentity />
      {children}
    </AppShell>
  );
}

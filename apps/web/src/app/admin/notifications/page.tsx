import type { Metadata } from 'next';
import { NotificationsAdminPage } from '@/components/admin/pages/notifications';

export const metadata: Metadata = { title: 'Notifications' };

export default function Page() {
  return <NotificationsAdminPage />;
}

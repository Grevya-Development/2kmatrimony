import type { Metadata } from 'next';
import { SubscriptionsPage } from '@/components/admin/pages/billing';

export const metadata: Metadata = { title: 'Subscriptions' };

export default function Page() {
  return <SubscriptionsPage />;
}

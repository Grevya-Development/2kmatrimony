import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BillingClient } from '@/components/billing/billing-client';
import { getSetting, isEnabled } from '@/server/config';
import { integrations } from '@/lib/env';

export const metadata: Metadata = { title: 'Plans & billing' };
export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  // 2K Marriage is free: billing is dormant unless the `payments` flag is turned back on.
  if (!(await isEnabled('payments'))) redirect('/app');
  const [brand, flag] = await Promise.all([getSetting<{ name: string }>('brand', { name: '2K Marriage' }), isEnabled('payments')]);
  return <BillingClient brandName={brand.name} paymentsEnabled={flag && integrations.razorpay} />;
}

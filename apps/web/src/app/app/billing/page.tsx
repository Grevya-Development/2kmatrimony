import type { Metadata } from 'next';
import { BillingClient } from '@/components/billing/billing-client';
import { getSetting, isEnabled } from '@/server/config';
import { integrations } from '@/lib/env';

export const metadata: Metadata = { title: 'Plans & billing' };
export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const [brand, flag] = await Promise.all([getSetting<{ name: string }>('brand', { name: '2K Matrimony' }), isEnabled('payments')]);
  return <BillingClient brandName={brand.name} paymentsEnabled={flag && integrations.razorpay} />;
}

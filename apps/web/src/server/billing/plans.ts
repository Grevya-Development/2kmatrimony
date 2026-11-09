import 'server-only';
import { BILLING_INTERVAL_MONTHS, resolveEntitlements, type BillingInterval, type PlanCode, type PlanItem } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { errors } from '@/server/http';

/** Public plans with active prices and typed entitlements, ordered by sort_order. */
export async function listPlans(): Promise<PlanItem[]> {
  const { data, error } = await db()
    .from('plans')
    .select('id, code, name, tagline, description, sort_order, plan_prices(id, interval, amount_paise, currency, is_active), plan_entitlements(key, value)')
    .eq('is_active', true)
    .eq('is_public', true)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    code: p.code as PlanCode,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    prices: (p.plan_prices ?? [])
      .filter((x) => x.is_active)
      .map((x) => ({
        id: x.id,
        interval: x.interval as BillingInterval,
        amountPaise: x.amount_paise,
        currency: x.currency,
        monthlyEquivalentPaise: Math.round(x.amount_paise / BILLING_INTERVAL_MONTHS[x.interval as BillingInterval]),
      }))
      .sort((a, b) => BILLING_INTERVAL_MONTHS[a.interval] - BILLING_INTERVAL_MONTHS[b.interval]),
    entitlements: resolveEntitlements(p.plan_entitlements ?? []),
  }));
}

export interface ResolvedPrice {
  planId: string;
  planCode: PlanCode;
  planName: string;
  sortOrder: number;
  priceId: string;
  interval: BillingInterval;
  amountPaise: number;
  currency: string;
}

export async function resolvePrice(planCode: PlanCode, interval: BillingInterval): Promise<ResolvedPrice> {
  const { data } = await db()
    .from('plans')
    .select('id, code, name, sort_order, is_active, plan_prices(id, interval, amount_paise, currency, is_active)')
    .eq('code', planCode)
    .maybeSingle();
  const price = data?.is_active ? data.plan_prices?.find((x) => x.interval === interval && x.is_active) : null;
  if (!data || !price) throw errors.notFound('That plan or billing period is not available.');
  return {
    planId: data.id,
    planCode: data.code as PlanCode,
    planName: data.name,
    sortOrder: data.sort_order,
    priceId: price.id,
    interval: price.interval as BillingInterval,
    amountPaise: price.amount_paise,
    currency: price.currency,
  };
}

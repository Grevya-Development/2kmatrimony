'use client';
import * as React from 'react';
import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { BILLING_INTERVAL_LABELS, formatInr, type BillingInterval, type Entitlements, type PlanItem } from '@2k/shared';
import { Badge, Button } from '@/components/ui';
import { cn } from '@/lib/utils';

export const ENTITLEMENT_ROWS: { key: keyof Entitlements; label: string; format?: (v: Entitlements[keyof Entitlements]) => string }[] = [
  { key: 'interests_per_day', label: 'Interests per day', format: (v) => String(v) },
  { key: 'daily_recommendations', label: 'Curated matches per day', format: (v) => String(v) },
  { key: 'advanced_filters', label: 'Advanced filters' },
  { key: 'ai_insights', label: 'AI match insights', format: (v) => (v === 'full' ? 'Full' : v === 'basic' ? 'Basic' : '—') },
  { key: 'ai_matchmaker_messages_per_day', label: 'AI matchmaker messages / day', format: (v) => String(v) },
  { key: 'see_who_viewed', label: 'See who viewed you' },
  { key: 'gap_analysis', label: 'Compatibility Gap Analysis' },
  { key: 'before_you_meet', label: 'Before You Meet briefings' },
  { key: 'curated_introductions', label: 'Curated introductions' },
  { key: 'human_matchmaker', label: 'Personal human matchmaker' },
  { key: 'priority_support', label: 'Priority support' },
];

export function EntitlementValue({ value, format }: { value: Entitlements[keyof Entitlements]; format?: (v: Entitlements[keyof Entitlements]) => string }) {
  if (typeof value === 'boolean') return value ? <Check className="h-4 w-4 text-success" aria-label="Included" /> : <Minus className="h-4 w-4 text-line-strong" aria-label="Not included" />;
  return <span>{format ? format(value) : String(value)}</span>;
}

/** Plan cards from live plan data. `onChoose` turns CTAs into checkout actions (in-app). */
export function PricingTable({ plans, ctaHref = '/login', onChoose, currentCode, busyKey }: {
  plans: PlanItem[];
  ctaHref?: string;
  onChoose?: (plan: PlanItem, interval: BillingInterval) => void;
  currentCode?: string;
  busyKey?: string | null;
}) {
  const intervals = React.useMemo(() => {
    const set = new Set<BillingInterval>();
    plans.forEach((p) => p.prices.forEach((x) => set.add(x.interval)));
    return (['month', 'quarter', 'half_year', 'year'] as BillingInterval[]).filter((i) => set.has(i));
  }, [plans]);
  const [interval, setInterval] = React.useState<BillingInterval>(intervals.includes('quarter') ? 'quarter' : intervals[0] ?? 'month');

  if (plans.length === 0) return <p className="text-center text-sm text-muted">Plans are being updated. Please check back shortly.</p>;

  return (
    <div className="space-y-8">
      {intervals.length > 1 && (
        <div className="flex justify-center">
          <div role="radiogroup" aria-label="Billing period" className="inline-flex flex-wrap justify-center gap-1 rounded-full border border-line bg-surface p-1">
            {intervals.map((i) => (
              <button key={i} type="button" role="radio" aria-checked={interval === i} onClick={() => setInterval(i)}
                className={cn('rounded-full px-4 py-1.5 text-sm font-medium transition-colors', interval === i ? 'bg-ink text-canvas' : 'text-muted hover:text-ink')}>
                {BILLING_INTERVAL_LABELS[i]}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const price = plan.prices.find((p) => p.interval === interval) ?? null;
          const featured = plan.code === 'premium';
          const isCurrent = currentCode === plan.code;
          return (
            <div key={plan.id} className={cn('flex flex-col rounded-3xl border bg-surface p-6 shadow-soft', featured ? 'border-burgundy-500 ring-4 ring-burgundy-50' : 'border-line')}>
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-3xl">{plan.name}</h3>
                {featured && <Badge tone="burgundy">Most chosen</Badge>}
                {isCurrent && <Badge tone="success">Current</Badge>}
              </div>
              {plan.tagline && <p className="mt-1 text-sm text-muted">{plan.tagline}</p>}
              <div className="mt-6 min-h-20">
                {plan.code === 'free' ? (
                  <p className="font-serif text-4xl">Free</p>
                ) : price ? (
                  <>
                    <p className="font-serif text-4xl">{formatInr(price.amountPaise)}</p>
                    <p className="text-sm text-muted">{BILLING_INTERVAL_LABELS[interval]}{price.interval !== 'month' ? ` · ${formatInr(price.monthlyEquivalentPaise)}/month` : ''} · incl. GST</p>
                  </>
                ) : (
                  <p className="text-sm text-muted">Not offered for this period</p>
                )}
              </div>
              {plan.description && <p className="mt-2 text-sm text-ink-2">{plan.description}</p>}
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {ENTITLEMENT_ROWS.map((row) => {
                  const v = plan.entitlements[row.key];
                  if (v === false || v === 'none' || v === 0) return null;
                  return (
                    <li key={row.key} className="flex items-start gap-2 text-ink-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                      <span>{typeof v === 'boolean' ? row.label : `${row.label}: ${row.format ? row.format(v) : String(v)}`}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-6">
                {plan.code === 'free' ? (
                  onChoose ? <Button variant="secondary" className="w-full" disabled>{isCurrent ? 'Your current plan' : 'Included'}</Button>
                    : <Button asChild variant="secondary" className="w-full"><Link href={ctaHref}>Start free</Link></Button>
                ) : onChoose ? (
                  <Button className="w-full" variant={featured ? 'primary' : 'secondary'} disabled={!price} loading={busyKey === `${plan.code}:${interval}`} onClick={() => price && onChoose(plan, interval)}>
                    {isCurrent ? 'Extend plan' : `Choose ${plan.name}`}
                  </Button>
                ) : (
                  <Button asChild className="w-full" variant={featured ? 'primary' : 'secondary'}><Link href={ctaHref}>Choose {plan.name}</Link></Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

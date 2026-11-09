// Shared (server + client) entitlement presentation. Kept out of 'use client'
// modules so server components can import the data and render the component.
import { Check, Minus } from 'lucide-react';
import type { Entitlements } from '@2k/shared';

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


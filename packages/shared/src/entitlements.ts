import type { Entitlements } from './api';

/** Safe defaults (Free plan) used when a plan is missing an entitlement key. */
export const DEFAULT_ENTITLEMENTS: Entitlements = {
  interests_per_day: 3,
  daily_recommendations: 5,
  advanced_filters: false,
  ai_insights: 'none',
  ai_matchmaker_messages_per_day: 3,
  smart_search_per_day: 3,
  see_who_viewed: false,
  gap_analysis: false,
  before_you_meet: false,
  curated_introductions: false,
  human_matchmaker: false,
  priority_support: false,
};

/** Merge raw plan_entitlements rows into a typed object, ignoring unknown/invalid values. */
export function resolveEntitlements(rows: { key: string; value: unknown }[]): Entitlements {
  const out: Entitlements = { ...DEFAULT_ENTITLEMENTS };
  const target = out as unknown as Record<string, unknown>;
  for (const { key, value } of rows) {
    if (!(key in DEFAULT_ENTITLEMENTS)) continue;
    const expected = typeof (DEFAULT_ENTITLEMENTS as unknown as Record<string, unknown>)[key];
    if (typeof value === expected) target[key] = value;
  }
  return out;
}

import 'server-only';
import { resolveEntitlements, type Entitlements, type PlanCode } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { errors } from './http';

export interface PlanState {
  code: PlanCode;
  name: string;
  planId: string | null;
  subscriptionId: string | null;
  currentPeriodEnd: string | null;
  entitlements: Entitlements;
}

/** The user's effective plan: latest active, unexpired subscription, else Free. */
export async function getPlanState(userId: string): Promise<PlanState> {
  const client = db();
  const nowIso = new Date().toISOString();
  const { data: sub } = await client
    .from('subscriptions')
    .select('id, current_period_end, plans(id, code, name)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('current_period_end', nowIso)
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle();

  let plan = sub?.plans as unknown as { id: string; code: PlanCode; name: string } | null;
  if (!plan) {
    const { data: free } = await client.from('plans').select('id, code, name').eq('code', 'free').maybeSingle();
    plan = (free as { id: string; code: PlanCode; name: string } | null) ?? { id: '', code: 'free', name: 'Free' };
  }
  const { data: rows } = plan.id
    ? await client.from('plan_entitlements').select('key, value').eq('plan_id', plan.id)
    : { data: [] };

  return {
    code: plan.code,
    name: plan.name,
    planId: plan.id || null,
    subscriptionId: sub?.id ?? null,
    currentPeriodEnd: sub?.current_period_end ?? null,
    entitlements: resolveEntitlements(rows ?? []),
  };
}

/** India-local calendar day used for daily quotas. */
export function quotaDay(now = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  return ist.toISOString().slice(0, 10);
}

/**
 * Atomically consume one unit of a daily quota. Throws 402 when exhausted.
 * `limit` <= 0 means the feature is not included in the plan.
 */
export async function consumeDailyQuota(userId: string, key: string, limit: number, label: string): Promise<number> {
  if (limit <= 0) throw errors.entitlement(`${label} is not included in your plan.`, { key, limit });
  const { data, error } = await db().rpc('increment_usage', { p_user: userId, p_key: key, p_period: quotaDay(), p_limit: limit });
  if (error) throw error;
  if (data === null) throw errors.entitlement(`You have reached today's limit for ${label.toLowerCase()} on your plan.`, { key, limit });
  return data;
}

export async function getDailyUsage(userId: string, key: string): Promise<number> {
  const { data } = await db().from('usage_counters').select('count').eq('user_id', userId).eq('key', key).eq('period_start', quotaDay()).maybeSingle();
  return data?.count ?? 0;
}

export function requireEntitlement(ent: Entitlements, key: keyof Entitlements, label: string): void {
  const v = ent[key];
  if (v === false || v === 'none' || v === 0) throw errors.entitlement(`${label} isn’t available on your account right now.`, { key });
}

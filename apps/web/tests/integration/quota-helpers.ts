import { admin } from './helpers';

/** India-local day used by daily quotas (mirrors server/entitlements quotaDay). */
export const quotaDay = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

/** Pre-fill today's usage so a test can hit an anti-abuse cap without hundreds of calls. */
export async function setUsage(userId: string, key: string, count: number): Promise<void> {
  const { error } = await admin().from('usage_counters').upsert({ user_id: userId, key, period_start: quotaDay(), count }, { onConflict: 'user_id,key,period_start' });
  if (error) throw error;
}

import 'server-only';
import { db } from '@/lib/supabase/admin';
import { generateRecommendations } from '@/server/matching/service';
import { getPlanState } from '@/server/entitlements';
import { notify } from '@/server/notify';
import { mapLimit } from './runner';

const PAGE = 200;

/**
 * Generate today's recommendations for active profiles seen in the last 30
 * days, honouring each member's plan limit; notify at most once per day.
 */
export async function dailyRecommendations(opts: { maxProfiles?: number; now?: Date } = {}): Promise<{ profiles: number; created: number; notified: number; failed: number }> {
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const dayStart = new Date(now.toISOString().slice(0, 10)).toISOString();
  const max = opts.maxProfiles ?? 5000;
  let profiles = 0, created = 0, notified = 0, failed = 0;

  for (let offset = 0; offset < max; offset += PAGE) {
    const { data } = await db().from('profiles').select('id, owner_user_id').eq('status', 'active').gte('last_active_at', since).order('id').range(offset, Math.min(offset + PAGE, max) - 1);
    const batch = data ?? [];
    if (batch.length === 0) break;
    await mapLimit(batch, 4, async (p) => {
      profiles++;
      try {
        const plan = await getPlanState(p.owner_user_id);
        const r = await generateRecommendations(p.id, plan.entitlements.daily_recommendations);
        created += r.created;
        if (r.created > 0) {
          const { count } = await db().from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', p.owner_user_id).eq('type', 'new_recommendations').gte('created_at', dayStart);
          if (!count) {
            await notify({ userId: p.owner_user_id, category: 'recommendations', templateKey: 'new_recommendations', data: { href: '/app' } });
            notified++;
          }
        }
      } catch (err) {
        failed++;
        console.error('[cron] recommendations failed for', p.id, err);
      }
    });
    if (batch.length < PAGE) break;
  }
  return { profiles, created, notified, failed };
}

import { notificationsReadSchema } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { parseJson, route } from '@/server/http';

/** Mark specific notifications (or all, when no ids) as read. */
export const POST = route({ allowSuspended: true }, async ({ req, auth }) => {
  const { ids } = await parseJson(req, notificationsReadSchema);
  let q = db().from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', auth.userId).is('read_at', null);
  if (ids?.length) q = q.in('id', ids);
  const { data, error } = await q.select('id');
  if (error) throw error;
  return { updated: data?.length ?? 0 };
});

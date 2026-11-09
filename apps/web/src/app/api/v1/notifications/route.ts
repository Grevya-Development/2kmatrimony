import { z } from 'zod';
import type { NotificationItem } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { cursor, ok, parseQuery, route } from '@/server/http';

const query = z.object({ cursor: z.string().max(200).optional(), limit: z.coerce.number().int().min(1).max(100).default(30), unread: z.enum(['0', '1']).default('0') });

export const GET = route({ allowSuspended: true }, async ({ req, auth }) => {
  const q = parseQuery(req, query);
  let sel = db().from('notifications').select('id, type, title, body, data, read_at, created_at').eq('user_id', auth.userId).order('created_at', { ascending: false }).limit(q.limit + 1);
  if (q.unread === '1') sel = sel.is('read_at', null);
  const c = cursor.decode<{ t: string }>(q.cursor);
  if (c) sel = sel.lt('created_at', c.t);
  const { data, error } = await sel;
  if (error) throw error;
  const rows = data ?? [];
  const page = rows.slice(0, q.limit);
  const items: NotificationItem[] = page.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, data: (n.data ?? {}) as Record<string, unknown>, readAt: n.read_at, createdAt: n.created_at }));
  const last = page[page.length - 1];
  return ok(items, { nextCursor: rows.length > q.limit && last ? cursor.encode({ t: last.created_at }) : null });
});

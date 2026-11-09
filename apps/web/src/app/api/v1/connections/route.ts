import { z } from 'zod';
import type { ConnectionItem } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { parseQuery, route } from '@/server/http';
import { buildCards, viewerBundle } from '@/server/discovery/cards';
import { unreadCounts } from '@/server/connections/service';

const query = z.object({ status: z.enum(['active', 'closed', 'all']).default('active') });

export const GET = route({ profile: 'required' }, async ({ req, auth }): Promise<ConnectionItem[]> => {
  const { status } = parseQuery(req, query);
  const me = auth.profile!;
  let q = db().from('connections').select('id, profile_a, profile_b, status, created_at, conversations(id, last_message_at, last_message_preview)').or(`profile_a.eq.${me.id},profile_b.eq.${me.id}`).order('created_at', { ascending: false }).limit(200);
  if (status !== 'all') q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const conv = (r: (typeof rows)[number]) => {
    const c = r.conversations as unknown as { id: string; last_message_at: string | null; last_message_preview: string | null } | { id: string; last_message_at: string | null; last_message_preview: string | null }[] | null;
    return Array.isArray(c) ? c[0] ?? null : c;
  };
  const otherOf = (r: (typeof rows)[number]) => (r.profile_a === me.id ? r.profile_b : r.profile_a);
  const [cards, unread] = await Promise.all([
    buildCards(await viewerBundle(me.id), rows.map(otherOf)),
    unreadCounts(me.id, rows.map((r) => conv(r)?.id).filter((x): x is string => !!x)),
  ]);
  const items: ConnectionItem[] = rows.flatMap((r) => {
    const card = cards.get(otherOf(r));
    const c = conv(r);
    return card ? [{ id: r.id, status: r.status as ConnectionItem['status'], createdAt: r.created_at, conversationId: c?.id ?? null, profile: card, unreadCount: c ? unread.get(c.id) ?? 0 : 0, lastMessageAt: c?.last_message_at ?? null, lastMessagePreview: c?.last_message_preview ?? null }] : [];
  });
  return items.sort((a, b) => (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt));
});

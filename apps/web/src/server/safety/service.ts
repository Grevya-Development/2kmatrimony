import 'server-only';
import type { Json } from '@2k/shared';
import { db } from '@/lib/supabase/admin';

/** True when either profile has blocked the other. */
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  const { data } = await db()
    .from('blocks')
    .select('blocker_profile_id')
    .or(`and(blocker_profile_id.eq.${a},blocked_profile_id.eq.${b}),and(blocker_profile_id.eq.${b},blocked_profile_id.eq.${a})`)
    .limit(1);
  return (data ?? []).length > 0;
}

/**
 * Record an automated risk signal for human review. Never enforces anything.
 * Duplicate open signals of the same kind for a user are ignored.
 */
export async function raiseRiskSignal(input: { userId: string; profileId?: string | null; kind: string; severity: number; details?: Record<string, unknown> }): Promise<void> {
  const { error } = await db().from('risk_signals').insert({
    user_id: input.userId,
    profile_id: input.profileId ?? null,
    kind: input.kind,
    severity: Math.max(1, Math.min(5, input.severity)),
    details: (input.details ?? {}) as NonNullable<Json>,
  });
  if (error && error.code !== '23505') console.error('[safety] risk signal failed', error.message);
}

/** Lock the conversation for a connection between two profiles (if any) and close the connection. */
export async function closeConnectionBetween(a: string, b: string, closedBy: string, reason: string): Promise<void> {
  const [pa, pb] = a < b ? [a, b] : [b, a];
  const { data: conn } = await db().from('connections').select('id, status').eq('profile_a', pa).eq('profile_b', pb).maybeSingle();
  if (!conn) return;
  if (conn.status === 'active') {
    await db().from('connections').update({ status: 'closed', closed_by_profile_id: closedBy, closed_reason: reason, closed_at: new Date().toISOString() }).eq('id', conn.id);
  }
  await db().from('conversations').update({ is_locked: true }).eq('connection_id', conn.id);
}

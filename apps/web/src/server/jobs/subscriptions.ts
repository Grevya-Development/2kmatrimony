import 'server-only';
import { db } from '@/lib/supabase/admin';
import { notify } from '@/server/notify';
import { reminderDue } from './retention';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

/** Mark lapsed subscriptions expired and tell members (unless superseded by another active plan). */
export async function expireSubscriptions(now = new Date()): Promise<{ expired: number }> {
  const { data } = await db()
    .from('subscriptions')
    .update({ status: 'expired' })
    .eq('status', 'active')
    .lte('current_period_end', now.toISOString())
    .select('id, user_id, plans(name)');
  for (const s of data ?? []) {
    const { count } = await db().from('subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', s.user_id).eq('status', 'active').gt('current_period_end', now.toISOString());
    if (!count) {
      await notify({ userId: s.user_id, category: 'billing', templateKey: 'subscription_expired', vars: { plan: (s.plans as { name: string } | null)?.name ?? 'paid' }, data: { href: '/app/billing' } });
    }
  }
  return { expired: data?.length ?? 0 };
}

/** 7-day and 1-day renewal reminders (each sent once per period). */
export async function sendRenewalReminders(now = new Date()): Promise<{ sent7d: number; sent1d: number }> {
  const horizon = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const { data } = await db()
    .from('subscriptions')
    .select('id, user_id, current_period_end, reminder_7d_sent_at, reminder_1d_sent_at, plans(name)')
    .eq('status', 'active')
    .gt('current_period_end', now.toISOString())
    .lte('current_period_end', horizon)
    .limit(1000);
  let sent7d = 0;
  let sent1d = 0;
  for (const s of data ?? []) {
    const due = reminderDue(new Date(s.current_period_end!), !!s.reminder_7d_sent_at, !!s.reminder_1d_sent_at, now);
    if (!due) continue;
    const column = due === '7d' ? 'reminder_7d_sent_at' : 'reminder_1d_sent_at';
    // Claim first so concurrent runs never double-send.
    const patch = due === '7d' ? { reminder_7d_sent_at: now.toISOString() } : { reminder_1d_sent_at: now.toISOString() };
    const { data: claimed } = await db().from('subscriptions').update(patch).eq('id', s.id).is(column, null).select('id').maybeSingle();
    if (!claimed) continue;
    await notify({ userId: s.user_id, category: 'billing', templateKey: 'subscription_expiring', vars: { plan: (s.plans as { name: string } | null)?.name ?? 'paid', until: fmt(s.current_period_end!) }, data: { href: '/app/billing' } });
    if (due === '7d') sent7d++; else sent1d++;
  }
  return { sent7d, sent1d };
}

import { NextResponse, type NextRequest } from 'next/server';
import { rejectUnlessCron } from '@/server/jobs/cron-auth';
import { runJobs } from '@/server/jobs/runner';
import { expireSubscriptions } from '@/server/jobs/subscriptions';
import { db } from '@/lib/supabase/admin';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/** Hourly: lapse subscriptions promptly; abandon checkout orders older than 24h. */
async function run(req: NextRequest) {
  const denied = rejectUnlessCron(req);
  if (denied) return denied;
  const summary = await runJobs([
    ['subscriptions.expire', () => expireSubscriptions()],
    ['payments.abandon', async () => {
      const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { count, error } = await db().from('payments').update({ status: 'failed', failure_reason: 'abandoned_checkout' }, { count: 'exact' }).eq('status', 'created').lt('created_at', cutoff);
      if (error) throw error;
      return { abandoned: count ?? 0 };
    }],
  ]);
  return NextResponse.json(summary, { status: summary.ok ? 200 : 207 });
}

export const GET = run;
export const POST = run;

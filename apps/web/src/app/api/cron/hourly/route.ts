import { NextResponse, type NextRequest } from 'next/server';
import { rejectUnlessCron } from '@/server/jobs/cron-auth';
import { runJobs } from '@/server/jobs/runner';
import { abandonStaleCheckouts, expireSubscriptions } from '@/server/jobs/subscriptions';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/** Hourly (Vercel Pro): lapse subscriptions promptly; abandon checkout orders older than 24h.
 *  On Hobby (daily crons only) the daily job runs the same tasks. */
async function run(req: NextRequest) {
  const denied = rejectUnlessCron(req);
  if (denied) return denied;
  const summary = await runJobs([
    ['subscriptions.expire', () => expireSubscriptions()],
    ['payments.abandon', () => abandonStaleCheckouts()],
  ]);
  return NextResponse.json(summary, { status: summary.ok ? 200 : 207 });
}

export const GET = run;
export const POST = run;

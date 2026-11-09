import { NextResponse, type NextRequest } from 'next/server';
import { rejectUnlessCron } from '@/server/jobs/cron-auth';
import { runJobs } from '@/server/jobs/runner';
import { dailyRecommendations } from '@/server/jobs/recommendations';
import { expireSubscriptions, sendRenewalReminders } from '@/server/jobs/subscriptions';
import { cleanupCounters, expireDataExports, purgeOldLogs, purgeVerificationDocuments, refreshMissingEmbeddings } from '@/server/jobs/maintenance';
import { expireInterests } from '@/server/interests/lifecycle';
import { executeDueDeletions } from '@/server/privacy/deletion';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

async function run(req: NextRequest) {
  const denied = rejectUnlessCron(req);
  if (denied) return denied;
  const summary = await runJobs([
    ['subscriptions.expire', () => expireSubscriptions()],
    ['subscriptions.reminders', () => sendRenewalReminders()],
    ['interests.expire', async () => ({ expired: await expireInterests() })],
    ['privacy.deletions', () => executeDueDeletions()],
    ['recommendations.daily', () => dailyRecommendations()],
    ['retention.dataExports', () => expireDataExports()],
    ['retention.verificationDocs', () => purgeVerificationDocuments()],
    ['retention.logs', () => purgeOldLogs()],
    ['maintenance.counters', () => cleanupCounters()],
    ['maintenance.embeddings', () => refreshMissingEmbeddings()],
  ]);
  return NextResponse.json(summary, { status: summary.ok ? 200 : 207 });
}

export const GET = run;
export const POST = run;

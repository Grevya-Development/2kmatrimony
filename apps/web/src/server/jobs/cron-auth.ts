import 'server-only';
import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { verifyBearer } from '@/server/billing/signatures';

/** Returns a 401 response when the request is not from the scheduler. */
export function rejectUnlessCron(req: Request): NextResponse | null {
  return verifyBearer(req.headers.get('authorization'), serverEnv.cronSecret) ? null : NextResponse.json({ error: { code: 'unauthorized', message: 'Invalid cron secret.' } }, { status: 401 });
}

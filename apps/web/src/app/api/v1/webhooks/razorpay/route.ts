import { NextResponse, type NextRequest } from 'next/server';
import { handleRazorpayWebhook } from '@/server/billing/webhook';

/** Razorpay webhooks: raw-body signature verification, idempotent processing. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const result = await handleRazorpayWebhook(raw, req.headers.get('x-razorpay-signature'), req.headers.get('x-razorpay-event-id'));
  return NextResponse.json(result.body, { status: result.status });
}

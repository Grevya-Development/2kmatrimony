import 'server-only';
import type Razorpay from 'razorpay';

/**
 * Ensure a Razorpay payment is CAPTURED before we grant a plan. An `authorized`
 * payment can still lapse or be voided, so we capture it for the exact order
 * amount first. If capture races with Razorpay auto-capture, re-fetch and use
 * the authoritative status. Returns the final status and method.
 */
export async function ensureCaptured(
  rzp: Pick<Razorpay, 'payments'>,
  remote: { id: string; status: string; method?: string | null },
  amountPaise: number,
  currency: string,
): Promise<{ status: string; method: string | null }> {
  if (remote.status === 'captured') return { status: 'captured', method: remote.method ?? null };
  if (remote.status !== 'authorized') return { status: remote.status, method: remote.method ?? null };
  try {
    const cap = await rzp.payments.capture(remote.id, amountPaise, currency);
    return { status: cap.status, method: cap.method ?? remote.method ?? null };
  } catch {
    const again = await rzp.payments.fetch(remote.id);
    return { status: again.status, method: again.method ?? remote.method ?? null };
  }
}

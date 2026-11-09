import 'server-only';
import type { Json } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/env';
import { activatePayment, failPayment } from './activation';
import { applyProcessedRefund } from './refunds';
import { verifyWebhookSignature } from './signatures';

interface RzpEntity { id: string; order_id?: string; payment_id?: string; status?: string; method?: string; amount?: number; error_description?: string; notes?: Record<string, string> }
interface RzpEvent { event: string; payload: { payment?: { entity: RzpEntity }; refund?: { entity: RzpEntity } }; created_at?: number }

/** Pure-ish handler used by the route and tests. */
export async function handleRazorpayWebhook(raw: string, signature: string | null, eventIdHeader: string | null): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!serverEnv.razorpayWebhookSecret) return { status: 503, body: { error: 'webhooks not configured' } };
  if (!verifyWebhookSignature(raw, signature, serverEnv.razorpayWebhookSecret)) return { status: 401, body: { error: 'invalid signature' } };

  let evt: RzpEvent;
  try { evt = JSON.parse(raw) as RzpEvent; } catch { return { status: 400, body: { error: 'invalid json' } }; }
  const entity = evt.payload.payment?.entity ?? evt.payload.refund?.entity;
  const eventId = eventIdHeader ?? `${evt.event}:${entity?.id ?? 'unknown'}:${evt.created_at ?? ''}`;

  const c = db();
  const { error: dupErr } = await c.from('payment_webhook_events').insert({ id: eventId, event_type: evt.event, payload: evt as unknown as NonNullable<Json> });
  if (dupErr) {
    // Duplicate delivery: acknowledge if already processed, otherwise retry processing below.
    const { data: existing } = await c.from('payment_webhook_events').select('processed_at').eq('id', eventId).maybeSingle();
    if (existing?.processed_at) return { status: 200, body: { ok: true, duplicate: true } };
  }

  try {
    await processEvent(evt);
    await c.from('payment_webhook_events').update({ processed_at: new Date().toISOString(), error: null }).eq('id', eventId);
    return { status: 200, body: { ok: true } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await c.from('payment_webhook_events').update({ error: message.slice(0, 500) }).eq('id', eventId);
    console.error('[razorpay webhook] failed', evt.event, message);
    return { status: 500, body: { error: 'processing failed' } }; // Razorpay retries
  }
}

async function paymentForOrder(orderId: string | undefined) {
  if (!orderId) return null;
  const { data } = await db().from('payments').select('id, amount_paise').eq('razorpay_order_id', orderId).maybeSingle();
  return data;
}

async function processEvent(evt: RzpEvent): Promise<void> {
  switch (evt.event) {
    case 'payment.captured':
    case 'order.paid': {
      const p = evt.payload.payment?.entity;
      const pay = await paymentForOrder(p?.order_id);
      if (!p || !pay) return; // not one of ours
      if (Number(p.amount) !== pay.amount_paise) throw new Error('amount mismatch');
      await activatePayment(pay.id, p.id, p.method ?? null, 'webhook');
      return;
    }
    case 'payment.failed': {
      const p = evt.payload.payment?.entity;
      const pay = await paymentForOrder(p?.order_id);
      if (pay) await failPayment(pay.id, p?.error_description ?? 'payment failed', true);
      return;
    }
    case 'refund.processed':
    case 'refund.failed': {
      const r = evt.payload.refund?.entity;
      if (!r) return;
      const { data: row } = await db().from('refunds').select('id').eq('razorpay_refund_id', r.id).maybeSingle();
      const refundId = row?.id ?? r.notes?.refund_id;
      if (!refundId) return;
      await db().from('refunds').update({ status: evt.event === 'refund.processed' ? 'processed' : 'failed', razorpay_refund_id: r.id }).eq('id', refundId);
      if (evt.event === 'refund.processed') await applyProcessedRefund(refundId);
      return;
    }
    default:
      return; // acknowledged, not handled
  }
}

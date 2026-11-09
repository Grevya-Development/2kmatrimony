import { createHmac, timingSafeEqual } from 'node:crypto';

/** Constant-time comparison of two hex/ascii strings. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const hmacSha256Hex = (secret: string, payload: string) => createHmac('sha256', secret).update(payload).digest('hex');

/** Razorpay Checkout success signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string, keySecret: string): boolean {
  if (!keySecret || !signature) return false;
  return safeEqual(hmacSha256Hex(keySecret, `${orderId}|${paymentId}`), signature);
}

/** Razorpay webhook signature over the raw request body. */
export function verifyWebhookSignature(rawBody: string, signature: string | null, webhookSecret: string): boolean {
  if (!webhookSecret || !signature) return false;
  return safeEqual(hmacSha256Hex(webhookSecret, rawBody), signature);
}

/** Bearer CRON_SECRET check (constant time). */
export function verifyBearer(header: string | null, secret: string): boolean {
  if (!secret || secret.length < 16 || !header?.toLowerCase().startsWith('bearer ')) return false;
  return safeEqual(header.slice(7).trim(), secret);
}

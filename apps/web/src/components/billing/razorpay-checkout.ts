'use client';
import type { CheckoutOrder } from '@2k/shared';

interface RazorpaySuccess { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
interface RazorpayInstance { open: () => void; on: (event: string, cb: (resp: { error?: { description?: string } }) => void) => void }
declare global {
  interface Window { Razorpay?: new (opts: Record<string, unknown>) => RazorpayInstance }
}

let loading: Promise<void> | null = null;
export function loadRazorpay(): Promise<void> {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { loading = null; reject(new Error('Could not load the payment window. Check your connection and try again.')); };
      document.body.appendChild(s);
    });
  }
  return loading;
}

/** Opens Razorpay Checkout; resolves with the signed result, null if dismissed. */
export async function openCheckout(order: CheckoutOrder, brandName: string): Promise<RazorpaySuccess | null> {
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: order.razorpayKeyId,
      order_id: order.razorpayOrderId,
      amount: order.amountPaise,
      currency: order.currency,
      name: brandName,
      description: `${order.planName} plan`,
      prefill: { name: order.prefill.name ?? undefined, email: order.prefill.email ?? undefined, contact: order.prefill.contact ?? undefined },
      theme: { color: '#013833' },
      handler: (resp: RazorpaySuccess) => resolve(resp),
      modal: { ondismiss: () => resolve(null) },
    });
    rzp.on('payment.failed', (resp) => reject(new Error(resp.error?.description ?? 'Payment failed. No amount was charged.')));
    rzp.open();
  });
}

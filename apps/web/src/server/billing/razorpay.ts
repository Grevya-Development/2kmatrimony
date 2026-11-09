import 'server-only';
import Razorpay from 'razorpay';
import { integrations, serverEnv } from '@/lib/env';
import { errors } from '@/server/http';

let client: Razorpay | null = null;

/** Razorpay SDK client; throws 503 service_unconfigured when keys are missing. */
export function razorpay(): Razorpay {
  if (!integrations.razorpay) throw errors.unconfigured('Razorpay payments');
  if (!client) client = new Razorpay({ key_id: serverEnv.razorpayKeyId, key_secret: serverEnv.razorpayKeySecret });
  return client;
}

/** For tests: drop the cached client so env changes take effect. */
export function resetRazorpayClient(): void {
  client = null;
}

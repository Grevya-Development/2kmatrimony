import { track } from '@/server/analytics/track';
import { checkoutSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { createCheckout } from '@/server/billing/checkout';

export const POST = route({ rateLimit: { name: 'checkout', limit: 10, windowSec: 600 } }, async ({ req, auth }) => {
  const input = await parseJson(req, checkoutSchema);
  const order = await createCheckout(auth, input);
  void track(auth.userId, 'checkout_started', { plan: input.planCode, interval: input.interval, coupon: !!input.couponCode }, auth.platform);
  return order;
});

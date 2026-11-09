import { checkoutSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { createCheckout } from '@/server/billing/checkout';

export const POST = route({ rateLimit: { name: 'checkout', limit: 10, windowSec: 600 } }, async ({ req, auth }) => {
  const input = await parseJson(req, checkoutSchema);
  return createCheckout(auth, input);
});

import { couponPreviewSchema, type CouponPreview } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { buildQuote } from '@/server/billing/quote';

export const POST = route({ rateLimit: { name: 'coupon-preview', limit: 20, windowSec: 600 } }, async ({ req, auth }): Promise<CouponPreview> => {
  const input = await parseJson(req, couponPreviewSchema);
  const q = await buildQuote({ userId: auth.userId, planCode: input.planCode, interval: input.interval, couponCode: input.couponCode });
  return { code: q.coupon!.code, description: q.coupon!.description, listAmountPaise: q.listPaise, discountPaise: q.discountPaise, amountPaise: q.gst.amountPaise, gstPaise: q.gst.gstPaise };
});

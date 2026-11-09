import 'server-only';
import type { BillingInterval, PlanCode } from '@2k/shared';
import { getSetting } from '@/server/config';
import { applyCoupon, type AppliedCoupon } from './coupons';
import { computeGst, isIntraState, type GstBreakdown } from './gst';
import { resolvePrice, type ResolvedPrice } from './plans';

export interface GstSettings {
  rate_bps: number;
  seller_gstin: string | null;
  seller_state: string;
  seller_legal_name: string | null;
  seller_address: string | null;
  sac: string;
}

export const getGstSettings = () =>
  getSetting<GstSettings>('gst', { rate_bps: 1800, seller_gstin: null, seller_state: 'KA', seller_legal_name: null, seller_address: null, sac: '998439' });

export interface Quote {
  price: ResolvedPrice;
  coupon: AppliedCoupon | null;
  listPaise: number;
  discountPaise: number;
  gst: GstBreakdown;
}

/** Price + coupon + GST for a plan purchase (shared by preview and checkout). */
export async function buildQuote(args: { userId: string; planCode: PlanCode; interval: BillingInterval; couponCode?: string; billingState?: string | null }): Promise<Quote> {
  const price = await resolvePrice(args.planCode, args.interval);
  const coupon = args.couponCode ? await applyCoupon(args.couponCode, price.planCode, args.userId, price.amountPaise) : null;
  const discountPaise = coupon?.discountPaise ?? 0;
  const settings = await getGstSettings();
  const gst = computeGst(price.amountPaise - discountPaise, settings.rate_bps, isIntraState(args.billingState, settings.seller_state));
  return { price, coupon, listPaise: price.amountPaise, discountPaise, gst };
}

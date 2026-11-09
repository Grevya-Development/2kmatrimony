/** Coupon maths and eligibility (pure; DB lookups happen in coupons.ts). */
export interface CouponLike {
  discount_type: string;
  discount_value: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string | null;
  max_redemptions: number | null;
  redeemed_count: number;
  per_user_limit: number;
  plan_codes: string[];
}

export type CouponProblem = 'inactive' | 'not_started' | 'expired' | 'exhausted' | 'user_limit' | 'plan_not_eligible';

export const COUPON_MESSAGES: Record<CouponProblem, string> = {
  inactive: 'This coupon is no longer active.',
  not_started: 'This coupon is not valid yet.',
  expired: 'This coupon has expired.',
  exhausted: 'This coupon has been fully redeemed.',
  user_limit: 'You have already used this coupon.',
  plan_not_eligible: 'This coupon does not apply to the selected plan.',
};

export function couponProblem(c: CouponLike, planCode: string, userRedemptions: number, now = new Date()): CouponProblem | null {
  if (!c.is_active) return 'inactive';
  if (new Date(c.valid_from).getTime() > now.getTime()) return 'not_started';
  if (c.valid_until && new Date(c.valid_until).getTime() <= now.getTime()) return 'expired';
  if (c.max_redemptions !== null && c.redeemed_count >= c.max_redemptions) return 'exhausted';
  if (userRedemptions >= c.per_user_limit) return 'user_limit';
  if (c.plan_codes.length > 0 && !c.plan_codes.includes(planCode)) return 'plan_not_eligible';
  return null;
}

/** Discount in paise; never below ₹1 charged (Razorpay minimum is 100 paise). */
export function discountFor(c: Pick<CouponLike, 'discount_type' | 'discount_value'>, listPaise: number): number {
  const raw = c.discount_type === 'percent' ? Math.round((listPaise * Math.min(100, c.discount_value)) / 100) : c.discount_value;
  return Math.max(0, Math.min(raw, listPaise - 100));
}

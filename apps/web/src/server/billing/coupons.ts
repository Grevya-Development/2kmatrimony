import 'server-only';
import { db } from '@/lib/supabase/admin';
import { errors } from '@/server/http';
import { COUPON_MESSAGES, couponProblem, discountFor } from './coupon-math';

export interface AppliedCoupon {
  couponId: string;
  code: string;
  description: string | null;
  discountPaise: number;
}

/** Validate a coupon for a user/plan/amount. Throws 422 with a friendly reason. */
export async function applyCoupon(code: string, planCode: string, userId: string, listPaise: number): Promise<AppliedCoupon> {
  const { data: coupon } = await db().from('coupons').select('*').eq('code', code.trim()).maybeSingle();
  if (!coupon) throw errors.validation('That coupon code is not valid.');
  const { count } = await db().from('coupon_redemptions').select('id', { count: 'exact', head: true }).eq('coupon_id', coupon.id).eq('user_id', userId);
  const problem = couponProblem(coupon, planCode, count ?? 0);
  if (problem) throw errors.validation(COUPON_MESSAGES[problem], { reason: problem });
  return { couponId: coupon.id, code: coupon.code, description: coupon.description, discountPaise: discountFor(coupon, listPaise) };
}

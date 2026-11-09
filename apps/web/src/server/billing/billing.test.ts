import { describe, expect, it } from 'vitest';
import { amountInWords, computeGst, financialYear, isIntraState } from './gst';
import { couponProblem, discountFor, type CouponLike } from './coupon-math';
import { hmacSha256Hex, verifyBearer, verifyPaymentSignature, verifyWebhookSignature } from './signatures';

describe('GST', () => {
  it('splits a GST-inclusive price into taxable + 18% GST', () => {
    const g = computeGst(99900, 1800, true);
    expect(g.taxablePaise).toBe(84661);
    expect(g.gstPaise).toBe(15239);
    expect(g.taxablePaise + g.gstPaise).toBe(99900);
    expect(g.cgstPaise + g.sgstPaise).toBe(g.gstPaise);
    expect(g.igstPaise).toBe(0);
  });
  it('uses IGST for inter-state supply', () => {
    const g = computeGst(199900, 1800, false);
    expect(g.igstPaise).toBe(g.gstPaise);
    expect(g.cgstPaise + g.sgstPaise).toBe(0);
  });
  it('detects intra-state supply', () => {
    expect(isIntraState('KA', 'KA')).toBe(true);
    expect(isIntraState('IN-KA', 'ka')).toBe(true);
    expect(isIntraState('TN', 'KA')).toBe(false);
    expect(isIntraState(null, 'KA')).toBe(true);
  });
  it('computes the Indian financial year in IST', () => {
    expect(financialYear(new Date('2026-11-09T10:00:00Z'))).toBe('2026-27');
    expect(financialYear(new Date('2027-03-31T17:00:00Z'))).toBe('2026-27');
    expect(financialYear(new Date('2027-03-31T19:00:00Z'))).toBe('2027-28'); // 00:30 IST on 1 April
  });
  it('writes amounts in Indian numbering words', () => {
    expect(amountInWords(149900)).toBe('Rupees One Thousand Four Hundred Ninety Nine Only');
    expect(amountInWords(1749950)).toBe('Rupees Seventeen Thousand Four Hundred Ninety Nine and Fifty Paise Only');
    expect(amountInWords(1_25_00_000_00)).toBe('Rupees One Crore Twenty Five Lakh Only');
  });
});

describe('coupons', () => {
  const base: CouponLike = { discount_type: 'percent', discount_value: 20, is_active: true, valid_from: '2026-01-01T00:00:00Z', valid_until: null, max_redemptions: null, redeemed_count: 0, per_user_limit: 1, plan_codes: [] };
  const now = new Date('2026-11-09T00:00:00Z');
  it('computes percent and flat discounts, never charging below ₹1', () => {
    expect(discountFor(base, 99900)).toBe(19980);
    expect(discountFor({ discount_type: 'flat', discount_value: 50000 }, 99900)).toBe(50000);
    expect(discountFor({ discount_type: 'flat', discount_value: 500000 }, 99900)).toBe(99800);
  });
  it('validates eligibility', () => {
    expect(couponProblem(base, 'plus', 0, now)).toBeNull();
    expect(couponProblem({ ...base, is_active: false }, 'plus', 0, now)).toBe('inactive');
    expect(couponProblem({ ...base, valid_from: '2027-01-01T00:00:00Z' }, 'plus', 0, now)).toBe('not_started');
    expect(couponProblem({ ...base, valid_until: '2026-11-01T00:00:00Z' }, 'plus', 0, now)).toBe('expired');
    expect(couponProblem({ ...base, max_redemptions: 5, redeemed_count: 5 }, 'plus', 0, now)).toBe('exhausted');
    expect(couponProblem(base, 'plus', 1, now)).toBe('user_limit');
    expect(couponProblem({ ...base, plan_codes: ['elite'] }, 'plus', 0, now)).toBe('plan_not_eligible');
  });
});

describe('signatures', () => {
  it('verifies Razorpay checkout signatures', () => {
    const sig = hmacSha256Hex('secret', 'order_1|pay_1');
    expect(verifyPaymentSignature('order_1', 'pay_1', sig, 'secret')).toBe(true);
    expect(verifyPaymentSignature('order_1', 'pay_2', sig, 'secret')).toBe(false);
    expect(verifyPaymentSignature('order_1', 'pay_1', sig, '')).toBe(false);
  });
  it('verifies webhook signatures over the raw body', () => {
    const body = '{"event":"payment.captured"}';
    expect(verifyWebhookSignature(body, hmacSha256Hex('wh', body), 'wh')).toBe(true);
    expect(verifyWebhookSignature(`${body} `, hmacSha256Hex('wh', body), 'wh')).toBe(false);
    expect(verifyWebhookSignature(body, null, 'wh')).toBe(false);
  });
  it('checks cron bearer tokens', () => {
    const s = 'x'.repeat(32);
    expect(verifyBearer(`Bearer ${s}`, s)).toBe(true);
    expect(verifyBearer('Bearer nope', s)).toBe(false);
    expect(verifyBearer(`Bearer short`, 'short')).toBe(false);
    expect(verifyBearer(null, s)).toBe(false);
  });
});

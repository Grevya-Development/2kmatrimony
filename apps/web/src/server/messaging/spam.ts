/** Lightweight heuristics for unsolicited contact sharing / repetition. Pure for unit testing. */
const URL_RE = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|in|net|org|io|me|link|xyz)\b/i;
const PHONE_RE = /(\+?\d[\d\s-]{8,}\d)/;
const PAYMENT_RE = /\b(upi|paytm|gpay|google pay|phonepe|bank transfer|send money|western union|gift card|crypto|bitcoin)\b/i;

export interface SpamAssessment {
  flagged: boolean;
  severe: boolean;
  reasons: string[];
}

export function assessMessage(body: string, ctx: { senderMessageCount: number; recentIdenticalCount: number }): SpamAssessment {
  const reasons: string[] = [];
  const early = ctx.senderMessageCount < 5;
  if (early && URL_RE.test(body)) reasons.push('link_in_early_message');
  if (early && PHONE_RE.test(body)) reasons.push('phone_in_early_message');
  if (PAYMENT_RE.test(body)) reasons.push('payment_language');
  if (ctx.recentIdenticalCount >= 2) reasons.push('repeated_message');
  const severe = ctx.recentIdenticalCount >= 4;
  return { flagged: reasons.length > 0, severe, reasons };
}

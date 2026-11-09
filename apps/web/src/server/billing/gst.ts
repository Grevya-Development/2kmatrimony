/**
 * GST maths (pure). List prices are GST-inclusive. All values in paise.
 */
export interface GstBreakdown {
  amountPaise: number; // charged, GST-inclusive
  taxablePaise: number;
  gstPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  intraState: boolean;
  rateBps: number;
}

export function computeGst(amountPaise: number, rateBps: number, intraState: boolean): GstBreakdown {
  if (!Number.isInteger(amountPaise) || amountPaise < 0) throw new Error('amount must be a non-negative integer (paise)');
  const taxablePaise = Math.round(amountPaise / (1 + rateBps / 10_000));
  const gstPaise = amountPaise - taxablePaise;
  const cgstPaise = intraState ? Math.floor(gstPaise / 2) : 0;
  const sgstPaise = intraState ? gstPaise - cgstPaise : 0;
  const igstPaise = intraState ? 0 : gstPaise;
  return { amountPaise, taxablePaise, gstPaise, cgstPaise, sgstPaise, igstPaise, intraState, rateBps };
}

/** Same state => CGST+SGST, otherwise IGST. Unknown buyer state defaults to the seller state (B2C). */
export function isIntraState(buyerState: string | null | undefined, sellerState: string): boolean {
  const b = (buyerState ?? '').trim().toUpperCase().replace(/^IN-/, '');
  const s = sellerState.trim().toUpperCase().replace(/^IN-/, '');
  return b === '' || b === s;
}

/** Indian financial year label (April–March) in IST, e.g. "2026-27". */
export function financialYear(date: Date = new Date()): string {
  const ist = new Date(date.getTime() + 5.5 * 3600_000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]!;
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', r ? twoDigits(r) : ''].filter(Boolean).join(' ');
}

/** Indian numbering system words, e.g. 149900 paise -> "Rupees One Thousand Four Hundred Ninety Nine Only". */
export function amountInWords(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const p = paise % 100;
  const parts: string[] = [];
  let n = rupees;
  const crore = Math.floor(n / 1_00_00_000); n %= 1_00_00_000;
  const lakh = Math.floor(n / 1_00_000); n %= 1_00_000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  const words = parts.length ? parts.join(' ') : 'Zero';
  return `Rupees ${words}${p ? ` and ${twoDigits(p)} Paise` : ''} Only`;
}

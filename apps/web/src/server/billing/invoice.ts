import 'server-only';
import { formatInr } from '@2k/shared';
import { db } from '@/lib/supabase/admin';
import type { AuthContext } from '@/server/auth';
import { errors } from '@/server/http';
import { amountInWords } from './gst';
import { getGstSettings } from './quote';

export async function getInvoiceForViewer(invoiceId: string, auth: AuthContext) {
  const { data: inv } = await db().from('invoices').select('*').eq('id', invoiceId).maybeSingle();
  if (!inv) throw errors.notFound('Invoice not found.');
  const isOwner = inv.user_id === auth.userId;
  const canAdmin = !!auth.admin?.can('payments.read') && (!auth.admin.mfaRequired || auth.aal === 'aal2');
  if (!isOwner && !canAdmin) throw errors.notFound('Invoice not found.');
  const seller = await getGstSettings();
  return { invoice: inv, seller };
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Self-contained printable GST tax invoice. */
export function renderInvoiceHtml({ invoice: inv, seller }: Awaited<ReturnType<typeof getInvoiceForViewer>>, brandName: string): string {
  const lines = (inv.line_items as { description: string; period_start?: string; period_end?: string; list_paise: number; discount_paise: number; taxable_paise: number }[]) ?? [];
  const date = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '');
  const rate = seller.rate_bps / 100;
  const taxRows = inv.igst_paise > 0
    ? `<tr><td>IGST @ ${rate}%</td><td class="r">${formatInr(inv.igst_paise)}</td></tr>`
    : `<tr><td>CGST @ ${rate / 2}%</td><td class="r">${formatInr(inv.cgst_paise)}</td></tr><tr><td>SGST @ ${rate / 2}%</td><td class="r">${formatInr(inv.sgst_paise)}</td></tr>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tax invoice ${esc(inv.invoice_number)}</title>
<style>
  :root{--ink:#1f1d1b;--muted:#77706a;--line:#e8e1d6;--accent:#7a2e3c}
  *{box-sizing:border-box} body{margin:0;background:#faf7f2;color:var(--ink);font:14px/1.5 Inter,system-ui,sans-serif}
  .page{max-width:820px;margin:32px auto;background:#fff;border:1px solid var(--line);border-radius:16px;padding:40px}
  h1{font:500 30px/1.1 'Cormorant Garamond',Georgia,serif;margin:0} .muted{color:var(--muted)} .r{text-align:right}
  header{display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid var(--line);padding-bottom:20px;margin-bottom:20px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px} .label{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#a8875a;font-weight:600;margin-bottom:4px}
  table{width:100%;border-collapse:collapse} th,td{padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:top} th{text-align:left;font-size:12px;color:var(--muted);font-weight:600}
  .totals{width:320px;margin-left:auto;margin-top:12px} .totals td{border:none;padding:6px 8px} .grand td{border-top:2px solid var(--ink);font-weight:600;font-size:16px}
  .words{margin-top:16px;font-style:italic} footer{margin-top:32px;font-size:12px;color:var(--muted)} .print{position:fixed;right:24px;bottom:24px;background:var(--accent);color:#fff;border:0;border-radius:999px;padding:12px 20px;font:inherit;cursor:pointer}
  @media print{body{background:#fff}.page{border:none;margin:0;padding:0}.print{display:none}}
</style></head><body>
<main class="page">
  <header>
    <div><h1>${esc(seller.seller_legal_name ?? brandName)}</h1>
      <div class="muted">${esc(seller.seller_address ?? '')}</div>
      <div class="muted">GSTIN: ${esc(seller.seller_gstin ?? 'Not configured')} · State: ${esc(inv.seller_state ?? seller.seller_state)}</div></div>
    <div class="r"><div class="label">Tax invoice</div><div style="font-weight:600">${esc(inv.invoice_number)}</div><div class="muted">${date(inv.issued_at)}</div></div>
  </header>
  <section class="grid">
    <div><div class="label">Billed to</div><div>${esc(inv.billing_name)}</div><div class="muted">${esc(inv.billing_email ?? '')} ${esc(inv.billing_phone ?? '')}</div>
      ${inv.customer_gstin ? `<div class="muted">GSTIN: ${esc(inv.customer_gstin)}</div>` : ''}</div>
    <div><div class="label">Place of supply</div><div>${esc(inv.billing_state ?? inv.seller_state ?? seller.seller_state)}</div><div class="muted">SAC ${esc(inv.hsn_sac)} · Online matchmaking services</div></div>
  </section>
  <table><thead><tr><th>Description</th><th class="r">List price</th><th class="r">Discount</th><th class="r">Taxable value</th></tr></thead><tbody>
  ${lines.map((l) => `<tr><td>${esc(l.description)}${l.period_start ? `<div class="muted">${date(l.period_start)} – ${date(l.period_end)}</div>` : ''}</td><td class="r">${formatInr(l.list_paise)}</td><td class="r">${l.discount_paise ? `− ${formatInr(l.discount_paise)}` : '—'}</td><td class="r">${formatInr(l.taxable_paise)}</td></tr>`).join('')}
  </tbody></table>
  <table class="totals"><tbody>
    <tr><td>Taxable value</td><td class="r">${formatInr(inv.taxable_paise)}</td></tr>${taxRows}
    <tr class="grand"><td>Total</td><td class="r">${formatInr(inv.total_paise)}</td></tr>
  </tbody></table>
  <p class="words">${esc(amountInWords(inv.total_paise))}</p>
  <footer>This is a computer-generated invoice and does not require a signature. Prices are inclusive of GST.</footer>
</main>
<button class="print" onclick="window.print()">Print or save as PDF</button>
</body></html>`;
}

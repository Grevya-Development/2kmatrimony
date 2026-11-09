/** Shared formatting for channel providers. Template bodies may contain literal "\n" sequences. */
export const normaliseNewlines = (s: string) => s.replace(/\\n/g, '\n');

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function toPlainText(body: string): string {
  return normaliseNewlines(body).trim();
}

/** Hosted PNG logo (email clients don't render SVG reliably). */
const logoUrl = () => `${(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/brand/logo-horizontal.png`;

/** Minimal branded HTML email (inline styles for client compatibility). */
export function toEmailHtml(subject: string, body: string, brand = '2K Marriage'): string {
  const paragraphs = normaliseNewlines(body)
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#013833">$1</a>')}</p>`)
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#fefaf4;padding:32px 16px;font-family:Montserrat,'Helvetica Neue',Arial,sans-serif;color:#062f2e">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e7dfd0;border-radius:16px" cellspacing="0" cellpadding="0">
<tr><td style="padding:28px 32px 8px"><img src="${esc(logoUrl())}" width="168" height="40" alt="${esc(brand)}" style="display:block;border:0;height:40px;width:auto"></td></tr>
<tr><td style="padding:8px 32px 8px;font-family:Newsreader,Georgia,serif;font-size:20px;color:#062f2e">${esc(subject)}</td></tr>
<tr><td style="padding:8px 32px 24px;font-size:15px;line-height:1.6">${paragraphs}</td></tr>
<tr><td style="padding:16px 32px 28px;border-top:1px solid #e7dfd0;font-size:12px;color:#5f6f6c">You can change which emails you receive in Settings → Notifications.</td></tr>
</table></td></tr></table></body></html>`;
}

/** E.164-ish digits without '+', defaulting to India for 10-digit numbers. */
export function msisdn(phone: string): string {
  const d = phone.replace(/\D/g, '');
  return d.length === 10 ? `91${d}` : d;
}

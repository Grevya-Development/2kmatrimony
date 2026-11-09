/** Shared formatting for channel providers. Template bodies may contain literal "\n" sequences. */
export const normaliseNewlines = (s: string) => s.replace(/\\n/g, '\n');

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function toPlainText(body: string): string {
  return normaliseNewlines(body).trim();
}

/** Minimal branded HTML email (inline styles for client compatibility). */
export function toEmailHtml(subject: string, body: string, brand = '2K Matrimony'): string {
  const paragraphs = normaliseNewlines(body)
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#7a2e3c">$1</a>')}</p>`)
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#faf7f2;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#1f1d1b">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#fffdf9;border:1px solid #e8e1d6;border-radius:16px" cellspacing="0" cellpadding="0">
<tr><td style="padding:28px 32px 8px;font-family:Georgia,serif;font-size:22px">${esc(brand)}</td></tr>
<tr><td style="padding:8px 32px 8px;font-family:Georgia,serif;font-size:20px;color:#1f1d1b">${esc(subject)}</td></tr>
<tr><td style="padding:8px 32px 24px;font-size:15px;line-height:1.6">${paragraphs}</td></tr>
<tr><td style="padding:16px 32px 28px;border-top:1px solid #e8e1d6;font-size:12px;color:#77706a">You can change which emails you receive in Settings → Notifications.</td></tr>
</table></td></tr></table></body></html>`;
}

/** E.164-ish digits without '+', defaulting to India for 10-digit numbers. */
export function msisdn(phone: string): string {
  const d = phone.replace(/\D/g, '');
  return d.length === 10 ? `91${d}` : d;
}

import { route } from '@/server/http';
import { getSetting } from '@/server/config';
import { getInvoiceForViewer, renderInvoiceHtml } from '@/server/billing/invoice';

export const GET = route<{ id: string }>({ allowSuspended: true }, async ({ req, auth, params }) => {
  const data = await getInvoiceForViewer(params.id, auth);
  if (new URL(req.url).searchParams.get('format') === 'html') {
    const brand = await getSetting<{ name: string }>('brand', { name: '2K Marriage' });
    return new Response(renderInvoiceHtml(data, brand.name), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'" },
    });
  }
  return data.invoice;
});

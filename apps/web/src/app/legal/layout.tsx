import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { getBrand, isSignedIn } from '@/components/marketing/data';

export const dynamic = 'force-dynamic';

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const [signedIn, brand] = await Promise.all([isSignedIn(), getBrand()]);
  return (
    <>
      <SiteHeader signedIn={signedIn} />
      <main id="main" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div role="note" className="mb-10 rounded-2xl border border-warning/30 bg-warning-bg px-5 py-4 text-sm text-warning">
          Draft — review with counsel before launch. This document is a working draft and is not yet legal advice or a binding policy.
        </div>
        <article className="space-y-5 text-[0.98rem] leading-relaxed text-ink-2 [&_h1]:font-serif [&_h1]:text-5xl [&_h1]:text-ink [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
          {children}
        </article>
        <p className="mt-12 text-sm text-muted">Contact: <a className="text-burgundy-600 underline-offset-4 hover:underline" href={`mailto:${brand.support_email}`}>{brand.support_email}</a></p>
      </main>
      <SiteFooter brand={brand} />
    </>
  );
}

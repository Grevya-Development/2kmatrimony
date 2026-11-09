import type { Metadata } from 'next';
import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { PricingTable } from '@/components/marketing/pricing-table';
import { ENTITLEMENT_ROWS, EntitlementValue } from '@/components/marketing/entitlement-rows';
import { Faq } from '@/components/marketing/faq';
import { getBrand, getCms, getPlansSafe, isSignedIn } from '@/components/marketing/data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pricing', description: 'Simple plans for thoughtful matchmaking. Start free; upgrade for advanced filters, AI insights and curated introductions. Prices include GST.' };

export default async function PricingPage() {
  const [signedIn, brand, plans, faqs] = await Promise.all([isSignedIn(), getBrand(), getPlansSafe(), getCms('faq')]);
  const cta = signedIn ? '/app/billing' : '/login?next=/app/billing';
  return (
    <>
      <SiteHeader signedIn={signedIn} />
      <main id="main" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="eyebrow mb-3">Pricing</p>
          <h1 className="font-serif text-5xl leading-tight sm:text-6xl text-balance">Plans that grow with your search</h1>
          <p className="mt-4 text-lg text-ink-2">Every plan includes mutual matching, privacy controls and safety tools. All prices include 18% GST.</p>
        </div>
        <PricingTable plans={plans} ctaHref={cta} />

        {plans.length > 0 && (
          <section className="mt-20" aria-labelledby="compare">
            <h2 id="compare" className="mb-6 font-serif text-3xl">Compare plans</h2>
            <div className="overflow-x-auto rounded-3xl border border-line bg-surface">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th scope="col" className="px-6 py-4 font-medium text-muted">Feature</th>
                    {plans.map((p) => <th key={p.id} scope="col" className="px-4 py-4 font-serif text-lg font-medium">{p.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ENTITLEMENT_ROWS.map((row) => (
                    <tr key={row.key} className="border-b border-line last:border-0">
                      <th scope="row" className="px-6 py-3.5 text-left font-normal text-ink-2">{row.label}</th>
                      {plans.map((p) => <td key={p.id} className="px-4 py-3.5"><EntitlementValue value={p.entitlements[row.key]} format={row.format} /></td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {faqs.length > 0 && <section className="mx-auto mt-20 max-w-4xl"><h2 className="mb-6 font-serif text-3xl">Questions</h2><Faq items={faqs} /></section>}
      </main>
      <SiteFooter brand={brand} />
    </>
  );
}

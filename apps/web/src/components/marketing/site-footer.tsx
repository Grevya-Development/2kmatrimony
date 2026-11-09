import Link from 'next/link';
import { Brand } from '@/components/shell/brand';
import type { Brand as BrandSettings } from './data';
import { BROWSE_CITIES, BROWSE_TONGUES, discoverHref } from './links';

export function SiteFooter({ brand, signedIn = false }: { brand: BrandSettings; signedIn?: boolean }) {
  const col = 'space-y-2.5 text-sm';
  const link = 'block text-emerald-100/90 transition-colors hover:text-white';
  return (
    <footer className="bg-emerald-700 text-emerald-100">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div className="max-w-sm space-y-5">
            <Brand variant="stacked-reverse" logoClassName="h-24" />
            <p className="text-sm leading-relaxed text-emerald-100/90">
              A free matrimony service where every profile is reviewed by our team and every introduction is chosen with care.
            </p>
            <p className="text-sm text-emerald-100/90">
              Write to us at <a className="text-gold-200 underline-offset-4 hover:underline" href={`mailto:${brand.support_email}`}>{brand.support_email}</a>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            <nav aria-label="Footer: about" className={col}>
              <p className="pb-1 text-xs font-semibold uppercase tracking-[0.14em] text-gold-400">2K Matrimony</p>
              <Link className={link} href="/#how-it-works">How it works</Link>
              <Link className={link} href="/#curated">Why curated</Link>
              <Link className={link} href="/#families">For families</Link>
              <Link className={link} href="/#safety">Safety</Link>
              <Link className={link} href="/#faq">FAQ</Link>
              <Link className={link} href="/login">Sign in</Link>
            </nav>
            <nav aria-label="Footer: mother tongue" className={col}>
              <p className="pb-1 text-xs font-semibold uppercase tracking-[0.14em] text-gold-400">Mother tongue</p>
              {BROWSE_TONGUES.slice(0, 8).map((t) => (
                <Link key={t} className={link} href={discoverHref({ motherTongues: [t] }, signedIn)}>{t} matrimony</Link>
              ))}
            </nav>
            <nav aria-label="Footer: cities" className={col}>
              <p className="pb-1 text-xs font-semibold uppercase tracking-[0.14em] text-gold-400">City</p>
              {BROWSE_CITIES.slice(0, 8).map((c) => (
                <Link key={c} className={link} href={discoverHref({ cities: [c] }, signedIn)}>{c}</Link>
              ))}
            </nav>
            <nav aria-label="Footer: legal" className={col}>
              <p className="pb-1 text-xs font-semibold uppercase tracking-[0.14em] text-gold-400">Legal</p>
              <Link className={link} href="/legal/terms">Terms of service</Link>
              <Link className={link} href="/legal/privacy">Privacy policy</Link>
            </nav>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-emerald-200/80 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} {brand.name}. For people 18 and older seeking marriage.</p>
          <p>Photographs are illustrative and do not show our members.</p>
        </div>
      </div>
    </footer>
  );
}

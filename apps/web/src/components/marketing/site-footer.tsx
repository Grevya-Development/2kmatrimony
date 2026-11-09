import Link from 'next/link';
import { Brand } from '@/components/shell/brand';
import type { Brand as BrandSettings } from './data';

export function SiteFooter({ brand }: { brand: BrandSettings }) {
  return (
    <footer className="bg-emerald-700 text-emerald-100">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <Brand variant="stacked-reverse" logoClassName="h-24" />
          <p className="max-w-sm pt-2 text-sm text-emerald-100">{brand.tagline}</p>
          <p className="text-sm text-emerald-100">Questions? <a className="text-gold-200 underline-offset-4 hover:underline" href={`mailto:${brand.support_email}`}>{brand.support_email}</a></p>
        </div>
        <nav aria-label="Product" className="space-y-2 text-sm">
          <p className="eyebrow !text-gold-400">Product</p>
          <Link className="block text-emerald-100 hover:text-white" href="/#how-it-works">How it works</Link>
          <Link className="block text-emerald-100 hover:text-white" href="/pricing">Pricing</Link>
          <Link className="block text-emerald-100 hover:text-white" href="/#faq">FAQ</Link>
          <Link className="block text-emerald-100 hover:text-white" href="/login">Sign in</Link>
        </nav>
        <nav aria-label="Legal" className="space-y-2 text-sm">
          <p className="eyebrow !text-gold-400">Legal</p>
          <Link className="block text-emerald-100 hover:text-white" href="/legal/terms">Terms of service</Link>
          <Link className="block text-emerald-100 hover:text-white" href="/legal/privacy">Privacy policy</Link>
        </nav>
      </div>
      <div className="border-t border-gold-500/30">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-emerald-200 sm:px-6">© {new Date().getFullYear()} {brand.name}. Members must be 18 or older. Compatibility describes stated preferences and never predicts outcomes.</p>
      </div>
    </footer>
  );
}

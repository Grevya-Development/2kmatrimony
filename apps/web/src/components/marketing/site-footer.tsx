import Link from 'next/link';
import { Brand } from '@/components/shell/brand';
import type { Brand as BrandSettings } from './data';

export function SiteFooter({ brand }: { brand: BrandSettings }) {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <Brand />
          <p className="max-w-sm text-sm text-muted">{brand.tagline}</p>
          <p className="text-sm text-muted">Questions? <a className="text-burgundy-600 underline-offset-4 hover:underline" href={`mailto:${brand.support_email}`}>{brand.support_email}</a></p>
        </div>
        <nav aria-label="Product" className="space-y-2 text-sm">
          <p className="eyebrow">Product</p>
          <Link className="block text-ink-2 hover:text-ink" href="/#how-it-works">How it works</Link>
          <Link className="block text-ink-2 hover:text-ink" href="/pricing">Pricing</Link>
          <Link className="block text-ink-2 hover:text-ink" href="/#faq">FAQ</Link>
          <Link className="block text-ink-2 hover:text-ink" href="/login">Sign in</Link>
        </nav>
        <nav aria-label="Legal" className="space-y-2 text-sm">
          <p className="eyebrow">Legal</p>
          <Link className="block text-ink-2 hover:text-ink" href="/legal/terms">Terms of service</Link>
          <Link className="block text-ink-2 hover:text-ink" href="/legal/privacy">Privacy policy</Link>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted sm:px-6">© {new Date().getFullYear()} {brand.name}. Members must be 18 or older. Compatibility describes stated preferences and never predicts outcomes.</p>
      </div>
    </footer>
  );
}

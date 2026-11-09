import Link from 'next/link';
import { Brand } from '@/components/shell/brand';

const LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#curated', label: 'Why curated' },
  { href: '/#families', label: 'For families' },
  { href: '/#safety', label: 'Safety' },
  { href: '/#faq', label: 'FAQ' },
];

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/90 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/80">
      <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center gap-8 px-4 sm:px-6 lg:px-8">
        <Brand />
        <nav aria-label="Site" className="hidden flex-1 items-center gap-7 lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-[0.92rem] text-ink-2 underline-offset-[6px] decoration-gold-400 decoration-2 transition-colors hover:text-ink hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 lg:ml-0">
          {signedIn ? (
            <Link href="/app" className="inline-flex h-10 items-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700">
              Go to my matches
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden h-10 items-center px-2 text-sm font-medium text-ink-2 hover:text-ink sm:inline-flex">Sign in</Link>
              <Link href="/login?next=%2Fonboarding" className="inline-flex h-10 items-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700">
                Register free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

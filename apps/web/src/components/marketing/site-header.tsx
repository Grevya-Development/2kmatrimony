import Link from 'next/link';
import { Brand } from '@/components/shell/brand';
import { Button } from '@/components/ui';

const LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#intelligence', label: 'Intelligence' },
  { href: '/#trust', label: 'Trust' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/#faq', label: 'FAQ' },
];

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Brand />
        <nav aria-label="Site" className="hidden flex-1 justify-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">{l.label}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {signedIn ? (
            <Button asChild size="sm"><Link href="/app">Open app</Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link href="/login">Sign in</Link></Button>
              <Button asChild size="sm"><Link href="/login">Find Your Match</Link></Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

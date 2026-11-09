import Link from 'next/link';
import { Button } from '@/components/ui';
import { Brand } from '@/components/shell/brand';

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Brand className="mb-10" />
      <p className="eyebrow mb-3">404</p>
      <h1 className="font-serif text-5xl">This page could not be found</h1>
      <p className="mt-4 max-w-md text-muted">The link may be outdated, or the profile may no longer be available.</p>
      <div className="mt-8 flex gap-3">
        <Button asChild><Link href="/">Go home</Link></Button>
        <Button asChild variant="secondary"><Link href="/app">Open app</Link></Button>
      </div>
    </main>
  );
}

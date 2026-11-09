import Link from 'next/link';
import { Brand } from '@/components/shell/brand';

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <Brand className="mb-12" />
      <p className="font-serif text-7xl leading-none text-gold-600">404</p>
      <h1 className="mt-6 font-serif text-4xl text-ink sm:text-5xl">We couldn’t find that page</h1>
      <p className="mt-4 max-w-md text-ink-2">The link may be old, or the profile you were looking for is no longer available.</p>
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-flex h-11 items-center rounded-full bg-emerald-600 px-6 font-semibold text-white hover:bg-emerald-700">Go to the home page</Link>
        <Link href="/app" className="inline-flex h-11 items-center rounded-full border border-line-strong bg-white px-6 font-medium text-ink hover:border-ink-2">My matches</Link>
      </div>
    </main>
  );
}

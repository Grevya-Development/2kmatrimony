'use client';
import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow mb-3">Something went wrong</p>
      <h1 className="font-serif text-4xl sm:text-5xl">We couldn’t load this page</h1>
      <p className="mt-4 max-w-md text-muted">Please try again. If the problem continues, contact support{error.digest ? ` and mention reference ${error.digest}` : ''}.</p>
      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="secondary"><Link href="/">Go home</Link></Button>
      </div>
    </main>
  );
}

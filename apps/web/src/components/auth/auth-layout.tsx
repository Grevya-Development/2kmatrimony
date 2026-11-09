import { Brand } from '@/components/shell/brand';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-surface-2 p-12 lg:flex">
        <Brand />
        <figure className="max-w-md">
          <blockquote className="font-serif text-4xl leading-[1.15] text-ink text-balance">
            “Don’t just find profiles. Discover someone you can build a meaningful life with.”
          </blockquote>
          <figcaption className="mt-6 text-sm text-muted">Mutual, transparent matchmaking — shaped by what matters to both of you.</figcaption>
        </figure>
        <ul className="grid grid-cols-3 gap-6 text-sm text-ink-2">
          <li><p className="font-serif text-2xl text-ink">Mutual</p>Compatibility measured in both directions</li>
          <li><p className="font-serif text-2xl text-ink">Private</p>You choose who sees what</li>
          <li><p className="font-serif text-2xl text-ink">Verified</p>Clear badges for checked details</li>
        </ul>
      </aside>
      <main id="main" className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden"><Brand /></div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}

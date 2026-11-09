import { Brand } from '@/components/shell/brand';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-emerald-600 p-12 text-canvas lg:flex">
        <Brand variant="stacked-reverse" logoClassName="h-32" />
        <figure className="max-w-md">
          <blockquote className="font-serif text-4xl leading-[1.15] text-canvas text-balance">
            “Don’t just find profiles. Discover someone you can build a meaningful life with.”
          </blockquote>
          <figcaption className="mt-6 text-sm text-emerald-100">Mutual, transparent matchmaking — shaped by what matters to both of you.</figcaption>
        </figure>
        <ul className="grid grid-cols-3 gap-6 border-t border-gold-500/40 pt-8 text-sm text-emerald-100">
          <li><p className="font-serif text-2xl text-gold-200">Mutual</p>Compatibility measured in both directions</li>
          <li><p className="font-serif text-2xl text-gold-200">Private</p>You choose who sees what</li>
          <li><p className="font-serif text-2xl text-gold-200">Verified</p>Clear badges for checked details</li>
        </ul>
      </aside>
      <main id="main" className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden"><Brand /></div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}

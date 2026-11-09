import Image from 'next/image';
import Link from 'next/link';
import { Brand } from '@/components/shell/brand';
import portraitImg from '../../../public/images/couple-portrait.webp';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-emerald-700 lg:block">
        <Image
          src={portraitImg}
          alt="A newly married couple in a silk saree and veshti"
          priority
          placeholder="blur"
          sizes="50vw"
          className="absolute inset-0 h-full w-full object-cover object-[50%_30%]"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-emerald-800/70 via-transparent to-emerald-800/90" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Brand variant="stacked-reverse" logoClassName="h-28" />
          <div className="max-w-md text-white">
            <p className="font-serif text-4xl leading-[1.12] text-balance">Real people review every profile. Real people choose every introduction.</p>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/20 pt-6 text-sm text-white/85">
              <li>Free to join</li>
              <li>Screened profiles</li>
              <li>Hand-picked matches</li>
            </ul>
            <p className="mt-4 text-xs text-white/60">Illustrative photograph, not a member.</p>
          </div>
        </div>
      </aside>
      <main id="main" className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <div className="lg:hidden"><Brand /></div>
          <Link href="/" className="text-sm text-muted hover:text-ink">Back to home</Link>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}

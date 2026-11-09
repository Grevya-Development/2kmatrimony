import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * 2K Matrimony logo — always the supplied Brand DNA artwork (never retyped).
 *  - horizontal: rings | wordmark lockup for headers (light backgrounds)
 *  - reverse:    white/gold horizontal lockup for emerald/dark backgrounds
 *  - stacked:    primary stacked logo with "Tradition Meets AI" tagline
 *  - stacked-reverse: stacked logo for emerald/dark backgrounds
 *  - mark:       interlocked rings only (gold)
 * Artwork lives in /public/brand (copied from 2K_Matrimony_Brand_DNA_Emerald).
 */
type Variant = 'horizontal' | 'reverse' | 'stacked' | 'stacked-reverse' | 'mark';

const ART: Record<Variant, { src: string; w: number; h: number }> = {
  horizontal: { src: '/brand/logo-horizontal.svg', w: 479, h: 114 },
  reverse: { src: '/brand/logo-horizontal-reverse.svg', w: 479, h: 114 },
  stacked: { src: '/brand/logo-stacked.svg', w: 891, h: 481.5 },
  'stacked-reverse': { src: '/brand/logo-stacked-reverse.svg', w: 891, h: 481.5 },
  mark: { src: '/brand/mark-gold.svg', w: 343, h: 263.25 },
};

const DEFAULT_HEIGHT: Record<Variant, string> = {
  horizontal: 'h-10 sm:h-11',
  reverse: 'h-10 sm:h-11',
  stacked: 'h-28',
  'stacked-reverse': 'h-28',
  mark: 'h-8',
};

export function BrandLogo({ variant = 'horizontal', className, priority }: { variant?: Variant; className?: string; priority?: boolean }) {
  const a = ART[variant];
  return (
    // SVG artwork with outlined text: a plain <img> keeps it crisp at any size.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={a.src}
      width={a.w}
      height={a.h}
      alt="2K Matrimony"
      className={cn('w-auto select-none', DEFAULT_HEIGHT[variant], className)}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      draggable={false}
    />
  );
}

export function Brand({ href = '/', className, variant = 'horizontal', logoClassName }: { href?: string; className?: string; variant?: Variant; logoClassName?: string }) {
  return (
    <Link href={href} className={cn('inline-flex shrink-0 items-center rounded-md', className)} aria-label="2K Matrimony home">
      <BrandLogo variant={variant} className={logoClassName} priority />
    </Link>
  );
}

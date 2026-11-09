import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Brand({ href = '/', className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn('group inline-flex items-baseline gap-1.5', className)} aria-label="2K Matrimony home">
      <span className="font-serif text-2xl font-semibold tracking-tight text-ink">2K</span>
      <span className="font-serif text-xl text-ink-2 group-hover:text-burgundy-600 transition-colors">Matrimony</span>
    </Link>
  );
}

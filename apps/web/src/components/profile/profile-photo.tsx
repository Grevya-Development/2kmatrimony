import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Photo with privacy-aware fallbacks (blurred-until-interest, or initials). */
export function ProfilePhoto({ url, blurred, name, className }: { url: string | null; blurred: boolean; name: string; className?: string }) {
  const initials = name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={`Photo of ${name}`} loading="lazy" className={cn('h-full w-full object-cover', className)} />;
  }
  return (
    <div className={cn('flex h-full w-full flex-col items-center justify-center gap-2 bg-champagne-50 text-champagne-600', className)}>
      {blurred ? (
        <>
          <Lock className="h-6 w-6" aria-hidden />
          <span className="px-6 text-center text-xs">Photos are visible after an interest is accepted</span>
        </>
      ) : (
        <span className="font-serif text-5xl">{initials || '·'}</span>
      )}
    </div>
  );
}

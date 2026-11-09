'use client';
import Link from 'next/link';
import { Briefcase, GraduationCap, MapPin } from 'lucide-react';
import type { ProfileCard } from '@2k/shared';
import { cn } from '@/lib/utils';
import { CompatibilityChip, VerifiedBadges } from './badges';
import { ProfilePhoto } from './profile-photo';

/** Editorial profile card. Shared by discovery, interests, shortlist, family and admin views. */
export function ProfileCardView({ card, href, actions, className, reason }: { card: ProfileCard; href?: string; actions?: React.ReactNode; className?: string; reason?: string | null }) {
  const link = href ?? `/app/profile/${card.id}`;
  return (
    <article className={cn('group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-soft transition-shadow duration-300 hover:shadow-lift', className)} aria-label={card.displayName}>
      <Link href={link} className="relative block aspect-[4/5] overflow-hidden bg-surface-2">
        <ProfilePhoto url={card.photoUrl} blurred={card.photoBlurred} name={card.displayName} className="transition-transform duration-500 ease-(--ease-out-soft) group-hover:scale-[1.02]" />
        {card.compatibility && <CompatibilityChip compatibility={card.compatibility} className="absolute left-3 top-3 bg-surface/95 shadow-soft backdrop-blur" />}
        {card.recentlyActive && <span className="absolute right-3 top-3 rounded-full bg-surface/95 px-2.5 py-1 text-[0.7rem] text-success shadow-soft">Active this week</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <Link href={link} className="font-serif text-2xl leading-tight text-ink hover:text-emerald-700">
            {card.displayName}{card.age !== null && <span className="text-ink-2">, {card.age}</span>}
          </Link>
          <ul className="mt-2 space-y-1 text-sm text-ink-2">
            {card.city && <li className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted" aria-hidden />{card.city}</li>}
            {card.profession && <li className="flex items-center gap-2"><Briefcase className="h-3.5 w-3.5 text-muted" aria-hidden />{card.profession}</li>}
            {card.education && <li className="flex items-center gap-2"><GraduationCap className="h-3.5 w-3.5 text-muted" aria-hidden />{card.education}</li>}
          </ul>
        </div>
        {reason && <p className="text-sm italic text-ink-2 text-pretty">{reason}</p>}
        {!reason && card.intro && <p className="line-clamp-2 text-sm text-muted text-pretty">{card.intro}</p>}
        {card.sharedInterests.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Shared interests">
            {card.sharedInterests.slice(0, 4).map((i) => <span key={i} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-2">{i}</span>)}
          </div>
        )}
        <VerifiedBadges verified={card.verified} />
        {actions && <div className="mt-auto pt-2">{actions}</div>}
      </div>
    </article>
  );
}

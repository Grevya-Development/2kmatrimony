import { BadgeCheck, Camera, Phone } from 'lucide-react';
import type { CompatibilitySummary, ProfileCard } from '@2k/shared';
import { Badge, Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';

/** Verified checks only — never shown for self-declared details. */
export function VerifiedBadges({ verified, className }: { verified: ProfileCard['verified']; className?: string }) {
  const items = [
    verified.identity && { key: 'id', icon: <BadgeCheck />, label: 'ID verified', tip: 'Government ID checked by our team or a compliant provider.' },
    verified.photo && { key: 'photo', icon: <Camera />, label: 'Photo verified', tip: 'Photos match a live selfie check.' },
    verified.phone && { key: 'phone', icon: <Phone />, label: 'Phone verified', tip: 'Mobile number confirmed by OTP.' },
  ].filter(Boolean) as { key: string; icon: React.ReactNode; label: string; tip: string }[];
  if (items.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {items.map((i) => (
        <Tooltip key={i.key} content={i.tip}>
          <span><Badge tone="success">{i.icon}{i.label}</Badge></span>
        </Tooltip>
      ))}
    </div>
  );
}

export function CompatibilityChip({ compatibility, className }: { compatibility: CompatibilitySummary | null; className?: string }) {
  if (!compatibility) return null;
  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full bg-champagne-100 px-3 py-1 text-xs font-medium text-ink', className)} title="How well your stated preferences align, in both directions. Not a prediction.">
      <span className="font-serif text-base leading-none text-burgundy-700">{compatibility.mutual}</span>
      <span className="text-ink-2">{compatibility.label}</span>
    </span>
  );
}

'use client';
import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import type { ShortlistItem } from '@2k/shared';
import { Badge, Button, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { ProfileCardView } from '@/components/profile/profile-card';
import { ProfileActions } from '@/components/discovery/profile-actions';
import { useApiData } from '@/components/discovery/hooks';

export function ShortlistView() {
  const { data, setData, error, loading, reload } = useApiData<ShortlistItem[]>('/shortlist');
  return (
    <div>
      <PageHeader eyebrow="Shortlist" title="Your shortlist" description="Profiles you (or family members you’ve invited) saved to revisit." />
      {loading ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="aspect-[4/6]" />)}</div>
        : error ? <ErrorState message={error} onRetry={reload} />
        : !data?.length ? <EmptyState icon={<Bookmark />} title="Your shortlist is empty" description="Save profiles you’d like to think about, then come back when you’re ready." action={<Button asChild><Link href="/app/discover">Discover</Link></Button>} />
        : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((item) => (
              <div key={item.profile.id} className="space-y-2">
                {(item.note || item.addedByFamily) && (
                  <div className="flex items-start gap-2 text-sm text-ink-2">
                    {item.addedByFamily && <Badge tone="gold">Added by family</Badge>}
                    {item.note && <p className="italic">“{item.note}”</p>}
                  </div>
                )}
                <ProfileCardView card={item.profile} actions={
                  <ProfileActions size="sm" target={{ id: item.profile.id, displayName: item.profile.displayName, relationship: item.profile.relationship }}
                    onChanged={(rel) => { if (!rel.shortlisted) setData((cur) => cur?.filter((x) => x.profile.id !== item.profile.id) ?? null); }}
                    onRemoved={() => setData((cur) => cur?.filter((x) => x.profile.id !== item.profile.id) ?? null)} />
                } />
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

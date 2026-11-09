'use client';
import * as React from 'react';
import Link from 'next/link';
import { Compass, Eye, MessageCircleHeart, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import { relativeTime, type ProfileViewersResponse, type RecommendationItem } from '@2k/shared';
import { Avatar, Button, Dialog, DialogContent, DialogTrigger, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { useMe } from '@/components/shell/me-context';
import { ProfileCardView } from '@/components/profile/profile-card';
import { api } from '@/lib/api';
import { ProfileActions } from './profile-actions';
import { showApiError, useApiData } from './hooks';

function ViewersButton({ data }: { data: ProfileViewersResponse }) {
  const [open, setOpen] = React.useState(false);
  const label = `${data.count} viewed you this month`;
  if (data.locked) {
    return <Button variant="secondary" size="sm" asChild><Link href="/app/billing" title="See who viewed you on Plus and above"><Eye />{label}</Link></Button>;
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="secondary" size="sm"><Eye />{label}</Button></DialogTrigger>
      <DialogContent side="right" title="Who viewed your profile" description="Members who opened your profile in the last 30 days.">
        <ul className="divide-y divide-line">
          {data.items.map((v) => (
            <li key={v.profile.id}>
              <Link href={`/app/profile/${v.profile.id}`} className="flex items-center gap-3 py-3 hover:text-emerald-700">
                <Avatar src={v.profile.photoUrl} name={v.profile.displayName} blurred={v.profile.photoBlurred} className="h-11 w-11" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{v.profile.displayName}{v.profile.age !== null ? `, ${v.profile.age}` : ''}</span>
                  <span className="block truncate text-xs text-muted">{[v.profile.city, v.profile.profession].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="text-xs text-muted">{relativeTime(v.viewedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Feedback({ candidateId }: { candidateId: string }) {
  const [sent, setSent] = React.useState<number | null>(null);
  const send = async (rating: -1 | 1) => {
    try {
      await api('/match-feedback', { body: { candidateProfileId: candidateId, rating, reason: rating === 1 ? 'great_fit' : 'not_my_preferences' } });
      setSent(rating);
      toast.success('Thanks — this helps us improve your introductions.');
    } catch (e) { showApiError(e); }
  };
  return (
    <div className="flex items-center gap-1 text-xs text-muted">
      <span className="mr-1">Good suggestion?</span>
      <button type="button" aria-label="Yes, a good suggestion" aria-pressed={sent === 1} onClick={() => send(1)} className={`rounded-full p-1.5 hover:bg-surface-2 ${sent === 1 ? 'text-success' : ''}`}><ThumbsUp className="h-3.5 w-3.5" /></button>
      <button type="button" aria-label="Not a good suggestion" aria-pressed={sent === -1} onClick={() => send(-1)} className={`rounded-full p-1.5 hover:bg-surface-2 ${sent === -1 ? 'text-danger' : ''}`}><ThumbsDown className="h-3.5 w-3.5" /></button>
    </div>
  );
}

export function ForYou() {
  const { me } = useMe();
  const profileActive = me.profile?.status === 'active';
  const { data, setData, error, loading, reload } = useApiData<RecommendationItem[]>(profileActive ? '/recommendations' : null);
  const viewers = useApiData<ProfileViewersResponse>('/profiles/viewers');
  const name = me.profile?.firstName ?? me.user.fullName ?? '';
  const remove = (id: string) => setData((cur) => cur?.filter((r) => r.id !== id) ?? null);

  return (
    <div>
      <PageHeader
        eyebrow={`${greeting()}${name ? `, ${name}` : ''}`}
        title="Today’s introductions"
        description="A small, considered set — suggested because you align with each other, not just one way."
        actions={viewers.data && viewers.data.count > 0 ? <ViewersButton data={viewers.data} /> : undefined}
      />

      {!profileActive ? (
        <EmptyState icon={<Sparkles />} title="Finish your profile to see introductions" description={`Your profile is ${me.profile?.completionPct ?? 0}% complete. Introductions begin once your values, Relationship DNA and partner preferences are in place.`} action={<Button asChild><Link href="/onboarding">Continue setting up</Link></Button>} />
      ) : loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/6]" />)}</div>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={<Compass />} title="No new introductions today" description="We only suggest people who align with you both ways. Try widening your preferences, or explore on your own." action={<div className="flex gap-2"><Button asChild><Link href="/app/discover">Discover</Link></Button><Button variant="secondary" asChild><Link href="/app/profile">Review preferences</Link></Button></div>} />
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((rec) => (
              <ProfileCardView
                key={rec.id}
                card={rec.profile}
                href={`/app/profile/${rec.profile.id}?source=recommendation`}
                reason={rec.reason}
                actions={
                  <div className="space-y-3">
                    <ProfileActions size="sm" recommendationId={rec.id} target={{ id: rec.profile.id, displayName: rec.profile.displayName, relationship: rec.profile.relationship }} onRemoved={() => remove(rec.id)} />
                    <Feedback candidateId={rec.profile.id} />
                  </div>
                }
              />
            ))}
          </div>
          <div className="mt-12 rounded-2xl border border-line bg-surface-2/60 px-6 py-10 text-center">
            <p className="font-serif text-3xl">You’re all caught up for today</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">New introductions arrive each day. Meanwhile, explore on your own or tell the matchmaker what matters most to you.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button variant="secondary" asChild><Link href="/app/discover"><Compass />Discover</Link></Button>
              {me.featureFlags.ai_matchmaker !== false && <Button variant="secondary" asChild><Link href="/app/matchmaker"><MessageCircleHeart />Talk to the matchmaker</Link></Button>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

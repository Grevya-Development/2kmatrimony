'use client';
import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Briefcase, EyeOff, GraduationCap, Info, MapPin } from 'lucide-react';
import {
  CHILDREN_OPTIONS, DIET_OPTIONS, EDUCATION_LEVEL_OPTIONS, EMPLOYMENT_TYPE_OPTIONS, FAMILY_STRUCTURE_OPTIONS, FAMILY_VALUES_OPTIONS,
  FITNESS_OPTIONS, HABIT_OPTIONS, INCOME_RANGE_OPTIONS, LIVING_OPTIONS, MARITAL_STATUS_OPTIONS, RELOCATION_OPTIONS, SETTLE_OPTIONS,
  TRAVEL_OPTIONS, formatHeight, labelOf, type ProfileDetail,
} from '@2k/shared';
import { Card, CardContent, ErrorState, Notice, Skeleton } from '@/components/ui';
import { MatchExplanationPanel } from '@/components/ai/match-explanation';
import { ProfileActions } from '@/components/discovery/profile-actions';
import { useApiData } from '@/components/discovery/hooks';
import { cn } from '@/lib/utils';
import { CompatibilityChip, VerifiedBadges } from './badges';
import { ProfilePhoto } from './profile-photo';

type Row = [string, string | number | null | undefined];

function DetailList({ rows }: { rows: Row[] }) {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (shown.length === 0) return <p className="text-sm text-muted">Not shared yet.</p>;
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {shown.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs uppercase tracking-wider text-muted">{k}</dt>
          <dd className="mt-1 text-[0.95rem] text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <h2 className="font-serif text-2xl">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}

function Gallery({ p }: { p: ProfileDetail }) {
  const [active, setActive] = React.useState(0);
  const photos = p.photos;
  const current = photos[active];
  return (
    <div className="space-y-3">
      <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-surface-2">
        <ProfilePhoto url={current && !current.blurred ? current.url : null} blurred={p.photoBlurred || !!current?.blurred} name={p.displayName} />
      </div>
      {photos.length > 1 && !photos[0]?.blurred && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none" role="tablist" aria-label="Photos">
          {photos.map((ph, i) => (
            <button key={ph.id} role="tab" aria-selected={i === active} aria-label={`Photo ${i + 1}`} onClick={() => setActive(i)}
              className={cn('h-20 w-16 shrink-0 overflow-hidden rounded-xl border-2', i === active ? 'border-burgundy-600' : 'border-transparent opacity-70 hover:opacity-100')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ph.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {p.video && (
        <figure className="overflow-hidden rounded-2xl border border-line bg-ink">
          <video src={p.video.url} controls preload="metadata" className="aspect-[9/16] w-full max-h-[480px] object-contain" aria-label={`Introduction video from ${p.displayName}`} />
          <figcaption className="bg-surface px-4 py-2 text-xs text-muted">Video introduction · {p.video.durationSeconds}s</figcaption>
        </figure>
      )}
    </div>
  );
}

export function ProfileDetailView({ id }: { id: string }) {
  const { data: p, error, loading, reload } = useApiData<ProfileDetail>(`/profiles/${id}`);

  if (loading) return <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr]"><Skeleton className="aspect-[4/5]" /><div className="space-y-4"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div></div>;
  if (error || !p) return <div className="space-y-4"><BackLink /><ErrorState message={error ?? 'This profile is not available.'} onRetry={reload} /></div>;

  const b = p.basics;
  return (
    <div className="pb-24">
      <BackLink />
      {p.isOwnProfile && <Notice className="mb-6">This is how other members see your profile. <Link href="/app/profile" className="font-medium underline underline-offset-4">Edit your profile</Link></Notice>}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="lg:sticky lg:top-24 lg:self-start"><Gallery p={p} /></div>
        <div className="min-w-0 space-y-6">
          <header className="space-y-3">
            <p className="eyebrow">{p.profileCode}</p>
            <h1 className="font-serif text-5xl leading-tight">{p.displayName}{p.age !== null && <span className="text-ink-2">, {p.age}</span>}</h1>
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-2">
              {p.city && <li className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-muted" />{[p.city, p.country !== 'IN' ? p.country : null].filter(Boolean).join(', ')}</li>}
              {p.profession && <li className="flex items-center gap-1.5"><Briefcase className="h-4 w-4 text-muted" />{p.profession}</li>}
              {p.education && <li className="flex items-center gap-1.5"><GraduationCap className="h-4 w-4 text-muted" />{p.education}</li>}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <CompatibilityChip compatibility={p.compatibility} />
              <VerifiedBadges verified={p.verified} />
            </div>
          </header>

          {b.about && (
            <section aria-labelledby="about-h">
              <h2 id="about-h" className="sr-only">About</h2>
              <p className="font-serif text-2xl leading-relaxed text-ink text-pretty">“{b.about}”</p>
            </section>
          )}

          <p className="flex items-start gap-2 text-xs text-muted"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Details below are shared by the member. Only items marked “Verified” have been independently checked.</p>

          {!p.isOwnProfile && <MatchExplanationPanel profileId={p.id} />}

          {(b.coreValues.length > 0 || b.personalityTraits.length > 0) && (
            <SectionCard title="Values & personality">
              <div className="flex flex-wrap gap-2">
                {b.coreValues.map((v) => <span key={v} className="rounded-full bg-burgundy-50 px-3 py-1 text-sm capitalize text-burgundy-700">{v}</span>)}
                {b.personalityTraits.map((t) => <span key={t} className="rounded-full border border-line px-3 py-1 text-sm capitalize text-ink-2">{t}</span>)}
              </div>
            </SectionCard>
          )}

          <SectionCard title="Basics">
            <DetailList rows={[
              ['Height', b.heightCm ? formatHeight(b.heightCm) : null],
              ['Marital status', b.maritalStatus ? labelOf(MARITAL_STATUS_OPTIONS, b.maritalStatus) : null],
              ['Mother tongue', b.motherTongue],
              ['Languages', b.languages.join(', ')],
              ['Native place', b.nativePlace],
              ['Religion', b.religion],
              ['Community', b.community],
            ]} />
          </SectionCard>

          {(p.educationHistory.length > 0 || p.career) && (
            <SectionCard title="Education & career">
              {p.educationHistory.map((e, i) => (
                <div key={i} className="border-b border-line pb-3 last:border-b-0">
                  <p className="font-medium">{e.qualification}{e.specialization ? ` · ${e.specialization}` : ''}</p>
                  <p className="text-sm text-muted">{[labelOf(EDUCATION_LEVEL_OPTIONS, e.level), e.institution].filter(Boolean).join(' · ')}</p>
                </div>
              ))}
              {p.career && <DetailList rows={[
                ['Profession', p.career.profession],
                ['Role', p.career.designation],
                ['Company', p.career.company],
                ['Works in', labelOf(EMPLOYMENT_TYPE_OPTIONS, p.career.employmentType)],
                ['Work city', p.career.workCity],
                ['Annual income', p.career.incomeRange ? labelOf(INCOME_RANGE_OPTIONS, p.career.incomeRange) : null],
                ['Relocation', p.career.relocationWillingness ? labelOf(RELOCATION_OPTIONS, p.career.relocationWillingness) : null],
              ]} />}
            </SectionCard>
          )}

          {p.lifestyle && (
            <SectionCard title="Lifestyle">
              <DetailList rows={[
                ['Food', labelOf(DIET_OPTIONS, p.lifestyle.diet)],
                ['Smoking', labelOf(HABIT_OPTIONS, p.lifestyle.smoking)],
                ['Drinking', labelOf(HABIT_OPTIONS, p.lifestyle.drinking)],
                ['Fitness', labelOf(FITNESS_OPTIONS, p.lifestyle.fitness)],
                ['Travel', labelOf(TRAVEL_OPTIONS, p.lifestyle.travel)],
              ]} />
              {[...p.lifestyle.interests, ...p.lifestyle.hobbies].length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {[...new Set([...p.lifestyle.interests, ...p.lifestyle.hobbies])].map((i) => (
                    <span key={i} className={cn('rounded-full px-3 py-1 text-sm', p.sharedInterests.includes(i) ? 'bg-champagne-100 text-ink' : 'border border-line text-ink-2')}>{i}</span>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {p.values && (
            <SectionCard title="Looking ahead">
              <DetailList rows={[
                ['Children', labelOf(CHILDREN_OPTIONS, p.values.childrenPreference)],
                ['After marriage', labelOf(LIVING_OPTIONS, p.values.livingArrangement)],
                ['Hopes to settle', labelOf(SETTLE_OPTIONS, p.values.settlePreference)],
              ]} />
              {p.values.relationshipExpectations && <div><p className="text-xs uppercase tracking-wider text-muted">A good marriage, in their words</p><p className="mt-1 text-pretty">{p.values.relationshipExpectations}</p></div>}
              {p.values.futureGoals && <div><p className="text-xs uppercase tracking-wider text-muted">Next five years</p><p className="mt-1 text-pretty">{p.values.futureGoals}</p></div>}
            </SectionCard>
          )}

          {p.family && (
            <SectionCard title="Family">
              <DetailList rows={[
                ['Family type', labelOf(FAMILY_STRUCTURE_OPTIONS, p.family.familyStructure)],
                ['Family values', labelOf(FAMILY_VALUES_OPTIONS, p.family.familyValues)],
                ['Father', p.family.fatherOccupation],
                ['Mother', p.family.motherOccupation],
                ['Brothers', p.family.brothers],
                ['Sisters', p.family.sisters],
              ]} />
              {p.family.familyBackground && <p className="text-pretty text-ink-2">{p.family.familyBackground}</p>}
            </SectionCard>
          )}

          {p.hiddenSections.length > 0 && (
            <Notice><span className="inline-flex items-center gap-2"><EyeOff className="h-4 w-4" />Some details ({p.hiddenSections.map((s) => s.replace(/_/g, ' ')).join(', ')}) are shared only with connections.</span></Notice>
          )}
        </div>
      </div>

      {!p.isOwnProfile && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:bottom-0">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <p className="hidden truncate font-serif text-xl sm:block">{p.displayName}</p>
            <ProfileActions target={{ id: p.id, displayName: p.displayName, relationship: p.relationship }} className="ml-auto" />
          </div>
        </div>
      )}
    </div>
  );
}

function BackLink() {
  return <button type="button" onClick={() => history.length > 1 ? history.back() : (window.location.href = '/app')} className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Back</button>;
}

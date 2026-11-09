'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BadgeCheck, Eye, EyeOff, Lock, MapPin, Pencil } from 'lucide-react';
import {
  CHILDREN_OPTIONS, DIET_OPTIONS, EDUCATION_LEVEL_OPTIONS, EMPLOYMENT_TYPE_OPTIONS, FAMILY_STRUCTURE_OPTIONS, FAMILY_VALUES_OPTIONS,
  FITNESS_OPTIONS, HABIT_OPTIONS, INCOME_RANGE_OPTIONS, LIVING_OPTIONS, MARITAL_STATUS_OPTIONS, NON_NEGOTIABLE_LABELS, RELOCATION_OPTIONS,
  SETTLE_OPTIONS, TRAVEL_OPTIONS, formatHeight, labelOf, type OwnProfileResponse, type ProfileDetail,
} from '@2k/shared';
import { api, ApiClientError } from '@/lib/api';
import { Avatar, Badge, Button, Card, CardContent, Dialog, DialogContent, ErrorState, Notice, PageHeader, Progress, Skeleton } from '@/components/ui';
import { DnaChart } from '@/components/dna/dna-chart';
import { subjectCopy } from './form-kit';
import { BasicsForm } from './basics-form';
import { EducationForm } from './education-form';
import { CareerForm } from './career-form';
import { FamilyForm } from './family-form';
import { LifestyleForm } from './lifestyle-form';
import { ValuesForm } from './values-form';
import { PreferencesForm } from './preferences-form';
import { PhotoManager, VideoManager } from './photo-manager';

type Section = 'basics' | 'education' | 'career' | 'family' | 'lifestyle' | 'values' | 'preferences';
const TITLES: Record<Section, string> = { basics: 'Basic details', education: 'Education', career: 'Work', family: 'Family', lifestyle: 'Lifestyle', values: 'Values & future', preferences: 'Partner preferences' };

const Row = ({ label, value }: { label: string; value: React.ReactNode }) =>
  value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0) ? null : (
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-1.5 text-sm"><dt className="text-muted">{label}</dt><dd className="text-ink">{Array.isArray(value) ? value.join(', ') : value}</dd></div>
  );

function SectionCard({ title, onEdit, children, empty }: { title: string; onEdit?: () => void; children: React.ReactNode; empty?: boolean }) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl">{title}</h2>
          {onEdit && <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit ${title}`}><Pencil />Edit</Button>}
        </div>
        {empty ? <p className="text-sm text-muted">Not added yet.</p> : <dl>{children}</dl>}
      </CardContent>
    </Card>
  );
}

function DetailSections({ d, onEdit }: { d: ProfileDetail; onEdit?: (s: Section) => void }) {
  const e = onEdit ? (s: Section) => () => onEdit(s) : () => undefined;
  const editable = !!onEdit;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionCard title="Basic details" onEdit={editable ? e('basics') : undefined}>
        <Row label="Height" value={d.basics.heightCm ? formatHeight(d.basics.heightCm) : null} />
        <Row label="Marital status" value={labelOf(MARITAL_STATUS_OPTIONS, d.basics.maritalStatus)} />
        <Row label="Mother tongue" value={d.basics.motherTongue} />
        <Row label="Languages" value={d.basics.languages} />
        <Row label="Native place" value={d.basics.nativePlace} />
        <Row label="Religion" value={d.basics.religion} />
        <Row label="Community" value={d.basics.community} />
      </SectionCard>
      <SectionCard title="Education" onEdit={editable ? e('education') : undefined} empty={!d.educationHistory.length}>
        {d.educationHistory.map((x, i) => <Row key={i} label={labelOf(EDUCATION_LEVEL_OPTIONS, x.level)} value={[x.qualification, x.specialization, x.institution].filter(Boolean).join(' · ')} />)}
      </SectionCard>
      <SectionCard title="Work" onEdit={editable ? e('career') : undefined} empty={!d.career}>
        {d.career && (<>
          <Row label="Profession" value={d.career.profession} />
          <Row label="Work type" value={labelOf(EMPLOYMENT_TYPE_OPTIONS, d.career.employmentType)} />
          <Row label="Company" value={d.career.company} />
          <Row label="Designation" value={d.career.designation} />
          <Row label="Income" value={d.career.incomeRange ? labelOf(INCOME_RANGE_OPTIONS, d.career.incomeRange) : null} />
          <Row label="Works in" value={d.career.workCity} />
          <Row label="Relocation" value={labelOf(RELOCATION_OPTIONS, d.career.relocationWillingness)} />
        </>)}
      </SectionCard>
      <SectionCard title="Family" onEdit={editable ? e('family') : undefined} empty={!d.family}>
        {d.family && (<>
          <Row label="Structure" value={labelOf(FAMILY_STRUCTURE_OPTIONS, d.family.familyStructure)} />
          <Row label="Values" value={labelOf(FAMILY_VALUES_OPTIONS, d.family.familyValues)} />
          <Row label="Father" value={d.family.fatherOccupation} />
          <Row label="Mother" value={d.family.motherOccupation} />
          <Row label="Siblings" value={d.family.brothers != null || d.family.sisters != null ? `${d.family.brothers ?? 0} brother(s), ${d.family.sisters ?? 0} sister(s)` : null} />
          <Row label="Background" value={d.family.familyBackground} />
        </>)}
      </SectionCard>
      <SectionCard title="Lifestyle" onEdit={editable ? e('lifestyle') : undefined} empty={!d.lifestyle}>
        {d.lifestyle && (<>
          <Row label="Food" value={labelOf(DIET_OPTIONS, d.lifestyle.diet)} />
          <Row label="Smoking" value={labelOf(HABIT_OPTIONS, d.lifestyle.smoking)} />
          <Row label="Drinking" value={labelOf(HABIT_OPTIONS, d.lifestyle.drinking)} />
          <Row label="Fitness" value={labelOf(FITNESS_OPTIONS, d.lifestyle.fitness)} />
          <Row label="Travel" value={labelOf(TRAVEL_OPTIONS, d.lifestyle.travel)} />
          <Row label="Interests" value={d.lifestyle.interests} />
          <Row label="Hobbies" value={d.lifestyle.hobbies} />
        </>)}
      </SectionCard>
      <SectionCard title="Values & future" onEdit={editable ? e('values') : undefined}>
        <Row label="Values" value={d.basics.coreValues.map((v) => v.replace(/_/g, ' '))} />
        <Row label="Personality" value={d.basics.personalityTraits} />
        <Row label="Children" value={labelOf(CHILDREN_OPTIONS, d.values?.childrenPreference)} />
        <Row label="Living" value={labelOf(LIVING_OPTIONS, d.values?.livingArrangement)} />
        <Row label="Settle" value={labelOf(SETTLE_OPTIONS, d.values?.settlePreference)} />
        <Row label="Marriage" value={d.values?.relationshipExpectations} />
        <Row label="Next five years" value={d.values?.futureGoals} />
      </SectionCard>
    </div>
  );
}

export function OwnProfile() {
  const router = useRouter();
  const params = useSearchParams();
  const preview = params.get('preview') === '1';
  const [data, setData] = React.useState<OwnProfileResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Section | null>(null);

  const load = React.useCallback(async () => {
    try { setError(null); setData(await api<OwnProfileResponse>(`/profile${preview ? '?preview=1' : ''}`)); }
    catch (e) { setError((e as ApiClientError).message); }
  }, [preview]);
  React.useEffect(() => { void load(); }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <div className="space-y-6"><Skeleton className="h-40" /><div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div></div>;

  const d = data.detail;
  const subject = subjectCopy(data.createdFor);
  const saved = async () => { setEditing(null); await load(); router.refresh(); };

  if (preview) {
    return (
      <div className="space-y-6">
        <Notice><span className="inline-flex items-center gap-2"><Eye className="h-4 w-4" />This is how a signed-in member who isn’t connected with you sees your profile. Photos under review are not shown.</span></Notice>
        {data.status !== 'active' && <Notice tone="warning">Your profile is currently <strong>{data.status}</strong>, so members can’t find it yet.</Notice>}
        {!d ? (
          <Card><CardContent className="flex items-center gap-3 text-sm text-muted"><EyeOff className="h-5 w-5" />Your visibility setting hides your profile from members who aren’t connected with you.</CardContent></Card>
        ) : (
          <>
            <Card><CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center">
              {d.photoUrl ? <img src={d.photoUrl} alt="" className="h-40 w-32 rounded-2xl object-cover" /> : <div className="flex h-40 w-32 items-center justify-center rounded-2xl bg-champagne-100 text-center text-xs text-champagne-600">{d.photoBlurred ? 'Photo shown after you accept interest' : 'No photo visible'}</div>}
              <div className="space-y-2">
                <h2 className="font-serif text-4xl">{d.displayName}{d.age ? `, ${d.age}` : ''}</h2>
                <p className="flex items-center gap-1 text-muted"><MapPin className="h-4 w-4" />{[d.city, d.country].filter(Boolean).join(', ')}</p>
                <p className="text-ink-2">{[d.profession, d.education].filter(Boolean).join(' · ')}</p>
                {d.basics.about && <p className="max-w-xl text-sm text-ink-2">{d.basics.about}</p>}
              </div>
            </CardContent></Card>
            {d.hiddenSections.length > 0 && <p className="flex items-center gap-2 text-sm text-muted"><Lock className="h-4 w-4" />Hidden from this viewer by your privacy settings: {d.hiddenSections.map((s) => s.replace(/_/g, ' ')).join(', ')}.</p>}
            <DetailSections d={d} />
          </>
        )}
        <Button asChild variant="secondary"><Link href="/app/profile">Exit preview</Link></Button>
      </div>
    );
  }

  const primary = data.photos.find((p) => p.isPrimary);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`Profile ${data.profileCode}`} title={subject.self ? 'Your profile' : `${d?.displayName ?? 'Their'} profile`}
        description="Everything here is editable. Members only see what your privacy settings allow."
        actions={<Button asChild variant="secondary"><Link href="/app/profile?preview=1"><Eye />Preview as others see it</Link></Button>} />

      <Card><CardContent className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <Avatar src={primary?.url} name={d?.displayName ?? 'You'} className="h-24 w-24 text-3xl" />
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-3xl">{d?.displayName}{d?.age ? `, ${d.age}` : ''}</h2>
            <Badge tone={data.status === 'active' ? 'success' : data.status === 'draft' ? 'warning' : 'neutral'}>{data.status === 'active' ? 'Visible to members' : data.status === 'draft' ? 'Not yet visible' : data.status}</Badge>
            {d?.verified.identity && <Badge tone="info"><BadgeCheck />ID verified</Badge>}
          </div>
          <div className="max-w-md space-y-1.5"><div className="flex justify-between text-sm"><span className="text-ink-2">Profile strength</span><span className="text-muted">{data.completion.pct}%</span></div><Progress value={data.completion.pct} label="Profile strength" /></div>
          {data.completion.missing.length > 0 && <p className="text-sm text-muted">Next: {data.completion.missing.slice(0, 3).map((m) => m.label.toLowerCase()).join(', ')}.</p>}
        </div>
      </CardContent></Card>

      <Card><CardContent className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="font-serif text-2xl">About</h2><Button variant="ghost" size="sm" onClick={() => setEditing('basics')}><Pencil />Edit</Button></div>
        <p className="whitespace-pre-line text-ink-2">{d?.basics.about || 'Add a short introduction so people can get a sense of you.'}</p>
      </CardContent></Card>

      <section className="space-y-4" aria-labelledby="photos-h">
        <h2 id="photos-h" className="font-serif text-3xl">Photos</h2>
        <PhotoManager photos={data.photos} maxPhotos={data.limits.maxPhotos} onChange={load} />
      </section>
      <section className="space-y-4" aria-labelledby="video-h">
        <h2 id="video-h" className="font-serif text-3xl">Video introduction</h2>
        <VideoManager video={data.video} limits={data.limits} onChange={load} />
      </section>

      {d && <DetailSections d={d} onEdit={setEditing} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardContent className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-serif text-2xl">Relationship DNA</h2><Button asChild variant="ghost" size="sm"><Link href="/app/dna"><Pencil />Open</Link></Button></div>
          {data.form.dna.length ? <DnaChart points={data.form.dna} compact /> : <p className="text-sm text-muted">Not answered yet.</p>}
        </CardContent></Card>
        <SectionCard title="Partner preferences" onEdit={() => setEditing('preferences')} empty={!data.form.preferences}>
          {data.form.preferences && (<>
            <Row label="Age" value={`${data.form.preferences.ageMin}–${data.form.preferences.ageMax}`} />
            <Row label="Height" value={data.form.preferences.heightMinCm ? `${data.form.preferences.heightMinCm}–${data.form.preferences.heightMaxCm} cm` : null} />
            <Row label="Cities" value={data.form.preferences.cities} />
            <Row label="Non-negotiables" value={(data.form.preferences.nonNegotiables ?? []).map((n) => NON_NEGOTIABLE_LABELS[n])} />
          </>)}
        </SectionCard>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <DialogContent side="right" title={TITLES[editing]} className="max-w-2xl">
            {editing === 'basics' && <BasicsForm initial={data.form.basics} subject={subject} onSaved={saved} />}
            {editing === 'education' && <EducationForm initial={{ items: data.form.education }} subject={subject} onSaved={saved} />}
            {editing === 'career' && <CareerForm initial={data.form.career} subject={subject} onSaved={saved} />}
            {editing === 'family' && <FamilyForm initial={data.form.family} subject={subject} onSaved={saved} />}
            {editing === 'lifestyle' && <LifestyleForm initial={data.form.lifestyle} subject={subject} onSaved={saved} />}
            {editing === 'values' && <ValuesForm initial={data.form.values} subject={subject} onSaved={saved} />}
            {editing === 'preferences' && <PreferencesForm initial={data.form.preferences ?? {}} subject={subject} onSaved={saved} />}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

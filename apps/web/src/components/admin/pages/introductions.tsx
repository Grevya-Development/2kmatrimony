'use client';
import * as React from 'react';
import { HeartHandshake } from 'lucide-react';
import { Badge, Button, EmptyState, Label, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';
import { AdminHeader, ErrorOr, Panel, SearchBox, fmtDate, human, mutate, useAdminData } from '../kit';

interface Person { profileId: string; profileCode: string; name: string; age: number | null; gender: string | null; city: string | null; motherTongue: string | null; education: string | null; profession: string | null; photoUrl: string | null }
interface Candidate extends Person { mutual: number; forMember: number; forCandidate: number; sharedInterests: string[] }
interface Workspace {
  member: Person & { about: string | null; preferences: { seeking: string[]; age: string | null; cities: string[]; educationLevels: string[]; diets: string[]; motherTongues: string[]; nonNegotiables: string[]; freeText: string | null } | null };
  candidates: Candidate[];
  recent: { id: string; note: string | null; status: string; createdAt: string; candidate: Person }[];
}

function Avatar({ p, size = 'h-12 w-12' }: { p: Person; size?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return p.photoUrl ? <img src={p.photoUrl} alt="" className={cn(size, 'shrink-0 rounded-full object-cover')} /> : <span className={cn(size, 'flex shrink-0 items-center justify-center rounded-full bg-gold-100 font-serif text-gold-600')}>{p.name.slice(0, 1)}</span>;
}
const line = (p: Person) => [p.age && `${p.age}`, p.city, p.motherTongue, p.profession].filter(Boolean).join(' · ');

export function IntroductionsPage() {
  const [q, setQ] = React.useState('');
  const [memberId, setMemberId] = React.useState<string | null>(null);
  const results = useAdminData<Person[]>(q.trim().length >= 2 ? `/admin/introductions/members?q=${encodeURIComponent(q.trim())}` : null);
  return (
    <>
      <AdminHeader title="Introductions" description="Hand-pick matches for a member. They see your note first on their For You page." />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Panel title="Member">
          <SearchBox value={q} onChange={setQ} placeholder="Name or profile code (TK…)" label="Find a member" />
          <ul className="mt-3 space-y-1">
            {(results.data ?? []).map((p) => (
              <li key={p.profileId}>
                <button type="button" onClick={() => setMemberId(p.profileId)} aria-pressed={memberId === p.profileId}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2', memberId === p.profileId && 'bg-surface-2')}>
                  <Avatar p={p} size="h-9 w-9" />
                  <span className="min-w-0"><span className="block truncate text-sm font-medium text-ink">{p.name}</span><span className="block truncate text-xs text-muted">{p.profileCode} · {line(p)}</span></span>
                </button>
              </li>
            ))}
            {q.trim().length >= 2 && results.data?.length === 0 && <li className="px-2 py-2 text-sm text-muted">No live profiles match.</li>}
          </ul>
        </Panel>
        {memberId ? <MemberWorkspace key={memberId} memberId={memberId} /> : (
          <EmptyState icon={<HeartHandshake />} title="Choose a member" description="Search on the left to see their preferences and the people who fit them best." />
        )}
      </div>
    </>
  );
}

function MemberWorkspace({ memberId }: { memberId: string }) {
  const state = useAdminData<Workspace>(`/admin/introductions/${memberId}`);
  const [picked, setPicked] = React.useState<Candidate | null>(null);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const send = async () => {
    if (!picked) return;
    setBusy(true);
    const r = await mutate('/admin/introductions', 'POST', { memberProfileId: memberId, candidateProfileId: picked.profileId, note: note.trim() }, `Introduction sent to the member`);
    setBusy(false);
    if (r) { setPicked(null); setNote(''); state.reload(); }
  };
  return (
    <ErrorOr state={state} rows={8}>
      {({ member: m, candidates, recent }) => (
        <div className="space-y-6">
          <Panel>
            <div className="flex items-start gap-4">
              <Avatar p={m} size="h-16 w-16" />
              <div className="min-w-0 space-y-2">
                <div><p className="font-serif text-2xl text-ink">{m.name}</p><p className="text-sm text-muted">{m.profileCode} · {line(m)}</p></div>
                {m.about && <p className="text-sm text-ink-2">{m.about}</p>}
                {m.preferences && (
                  <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <div><dt className="inline text-muted">Looking for: </dt><dd className="inline capitalize">{m.preferences.seeking.map(human).join(', ') || '—'}{m.preferences.age ? `, ${m.preferences.age}` : ''}</dd></div>
                    {m.preferences.cities.length > 0 && <div><dt className="inline text-muted">Cities: </dt><dd className="inline">{m.preferences.cities.join(', ')}</dd></div>}
                    {m.preferences.motherTongues.length > 0 && <div><dt className="inline text-muted">Mother tongue: </dt><dd className="inline">{m.preferences.motherTongues.join(', ')}</dd></div>}
                    {m.preferences.diets.length > 0 && <div><dt className="inline text-muted">Diet: </dt><dd className="inline capitalize">{m.preferences.diets.map(human).join(', ')}</dd></div>}
                    {m.preferences.nonNegotiables.length > 0 && <div className="sm:col-span-2"><dt className="inline text-muted">Non-negotiable: </dt><dd className="inline capitalize">{m.preferences.nonNegotiables.map(human).join(', ')}</dd></div>}
                    {m.preferences.freeText && <div className="sm:col-span-2"><dt className="inline text-muted">In their words: </dt><dd className="inline">{m.preferences.freeText}</dd></div>}
                  </dl>
                )}
              </div>
            </div>
          </Panel>

          {picked && (
            <Panel title={`Introduce ${picked.name}`} description="Write the note the member will read. Be specific about why you think they should meet." className="border-gold-200 bg-gold-50/60">
              <Label htmlFor="intro-note" className="sr-only">Personal note</Label>
              <Textarea id="intro-note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-28" placeholder="e.g. You both grew up in Coimbatore, value family dinners, and want to settle in Bengaluru. She is a doctor who loves trekking — I think you'd enjoy talking." />
              <div className="mt-3 flex gap-2">
                <Button loading={busy} disabled={note.trim().length < 20} onClick={() => void send()}>Send introduction</Button>
                <Button variant="ghost" onClick={() => setPicked(null)}>Cancel</Button>
              </div>
            </Panel>
          )}

          <Panel title="Best fits" description="Ranked by two-way compatibility. Everyone here meets both members’ non-negotiables.">
            {candidates.length === 0 ? <p className="text-sm text-muted">No eligible candidates right now.</p> : (
              <ul className="divide-y divide-line">
                {candidates.map((c) => (
                  <li key={c.profileId} className="flex items-center gap-4 py-3">
                    <Avatar p={c} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{c.name} <span className="font-normal text-muted">· {c.profileCode}</span></p>
                      <p className="truncate text-sm text-muted">{line(c)}{c.education ? ` · ${c.education}` : ''}</p>
                      {c.sharedInterests.length > 0 && <p className="mt-1 text-xs text-ink-2">Shared: {c.sharedInterests.join(', ')}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-serif text-2xl text-ink">{c.mutual}</p>
                      <p className="text-[0.7rem] text-muted">{c.forMember} / {c.forCandidate}</p>
                    </div>
                    <Button size="sm" variant={picked?.profileId === c.profileId ? 'primary' : 'secondary'} onClick={() => setPicked(c)}>Introduce</Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Introductions sent">
            {recent.length === 0 ? <p className="text-sm text-muted">None yet.</p> : (
              <ul className="space-y-3">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-start gap-3">
                    <Avatar p={r.candidate} size="h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm"><span className="font-medium text-ink">{r.candidate.name}</span> <span className="text-muted">· {fmtDate(r.createdAt)}</span></p>
                      {r.note && <p className="text-sm text-ink-2">“{r.note}”</p>}
                    </div>
                    <Badge tone={r.status === 'interested' ? 'success' : r.status === 'passed' ? 'neutral' : 'gold'} className="capitalize">{human(r.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </ErrorOr>
  );
}

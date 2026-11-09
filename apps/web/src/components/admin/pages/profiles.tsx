'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Check, X } from 'lucide-react';
import { DNA_DIMENSION_META, type DnaDimension } from '@2k/shared';
import { Badge, Button, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from '@/components/ui';
import {
  AdminHeader, ConfirmAction, DataTable, ErrorOr, FilterSelect, KeyValues, Pager, Panel, SearchBox, StatusBadge,
  fmtDate, fmtDateTime, human, mutate, qs, useAdminData, useCan, type Paged,
} from '../kit';

interface ProfileRow { id: string; owner_user_id: string; profile_code: string; first_name: string | null; last_name: string | null; gender: string | null; current_city: string | null; status: string; completion_pct: number; is_identity_verified: boolean; is_photo_verified: boolean; created_at: string }
interface MediaItem { id: string; kind: 'photo' | 'video'; profileId: string; profileCode: string | null; name: string | null; url: string | null; status: string; reason: string | null; createdAt: string }

export function ProfilesPage() {
  const can = useCan();
  return (
    <>
      <AdminHeader title="Profiles" description="Browse member profiles and review uploaded photos and introduction videos." />
      <Tabs defaultValue="browse">
        <TabsList><TabsTrigger value="browse">Browse</TabsTrigger>{can('profiles.moderate') && <TabsTrigger value="media">Media moderation</TabsTrigger>}</TabsList>
        <TabsContent value="browse"><BrowseProfiles /></TabsContent>
        {can('profiles.moderate') && <TabsContent value="media"><MediaQueue /></TabsContent>}
      </Tabs>
    </>
  );
}

function BrowseProfiles() {
  const router = useRouter();
  const [f, setF] = React.useState({ q: '', status: '', page: 1 });
  const state = useAdminData<Paged<ProfileRow>>(`/admin/profiles${qs(f)}`);
  return (
    <Panel>
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchBox label="Search profiles" value={f.q} onChange={(q) => setF({ ...f, q, page: 1 })} placeholder="Name, city or TK code" />
        <FilterSelect label="Profile status" value={f.status} onChange={(status) => setF({ ...f, status, page: 1 })} options={[['', 'All statuses'], ['draft', 'Draft'], ['active', 'Active'], ['hidden', 'Hidden'], ['suspended', 'Suspended']]} />
      </div>
      <ErrorOr state={state}>
        {(d) => (
          <>
            <DataTable<ProfileRow> caption="Profiles" rows={d.items} onRowClick={(p) => router.push(`/admin/profiles/${p.id}`)}
              columns={[
                { key: 'code', label: 'Code', render: (p) => <span className="font-mono text-xs">{p.profile_code}</span> },
                { key: 'name', label: 'Name', render: (p) => <span className="inline-flex items-center gap-1.5 text-ink">{[p.first_name, p.last_name].filter(Boolean).join(' ') || '—'}{p.is_identity_verified && <BadgeCheck className="h-4 w-4 text-success" aria-label="ID verified" />}</span> },
                { key: 'city', label: 'City', render: (p) => p.current_city ?? '—', hideOnMobile: true },
                { key: 'completion', label: 'Complete', render: (p) => `${p.completion_pct}%` },
                { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
                { key: 'created', label: 'Created', render: (p) => fmtDate(p.created_at), hideOnMobile: true },
              ]} />
            <Pager page={d.page} pages={d.pages} total={d.total} onPage={(page) => setF({ ...f, page })} />
          </>
        )}
      </ErrorOr>
    </Panel>
  );
}

function MediaQueue() {
  const [f, setF] = React.useState({ kind: 'photo', status: 'pending', page: 1 });
  const state = useAdminData<Paged<MediaItem>>(`/admin/media${qs(f)}`);
  const [reasons, setReasons] = React.useState<Record<string, string>>({});
  const decide = async (m: MediaItem, decision: 'approved' | 'rejected') => {
    const r = await mutate(`/admin/media/${m.id}`, 'POST', { kind: m.kind, decision, reason: reasons[m.id] || undefined }, decision === 'approved' ? 'Approved' : 'Rejected');
    if (r) state.setData((d) => (d ? { ...d, items: d.items.filter((x) => x.id !== m.id), total: d.total - 1 } : d));
  };
  return (
    <Panel>
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterSelect label="Media type" value={f.kind} onChange={(kind) => setF({ ...f, kind, page: 1 })} options={[['photo', 'Photos'], ['video', 'Videos']]} />
        <FilterSelect label="Moderation status" value={f.status} onChange={(status) => setF({ ...f, status, page: 1 })} options={[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']]} />
      </div>
      <ErrorOr state={state}>
        {(d) => d.items.length === 0 ? <p className="py-10 text-center text-sm text-muted">The queue is clear.</p> : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {d.items.map((m) => (
                <li key={m.id} className="overflow-hidden rounded-xl border border-line bg-canvas">
                  <div className="aspect-[4/5] bg-surface-2">
                    {m.url ? (m.kind === 'video'
                      ? <video src={m.url} controls className="h-full w-full object-cover" aria-label={`Introduction video by ${m.name ?? 'member'}`} />
                      // eslint-disable-next-line @next/next/no-img-element
                      : <img src={m.url} alt={`Photo uploaded by ${m.name ?? 'member'}`} className="h-full w-full object-cover" />)
                      : <p className="p-6 text-sm text-muted">File unavailable</p>}
                  </div>
                  <div className="space-y-2 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <Link href={`/admin/profiles/${m.profileId}`} className="font-mono text-burgundy-600 hover:underline">{m.profileCode}</Link>
                      <span className="text-muted">{fmtDateTime(m.createdAt)}</span>
                    </div>
                    {m.status === 'pending' ? (
                      <>
                        <Textarea aria-label="Rejection reason" placeholder="Reason if rejecting (shown to the member)" value={reasons[m.id] ?? ''} onChange={(e) => setReasons({ ...reasons, [m.id]: e.target.value })} className="min-h-16 text-sm" />
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1" onClick={() => decide(m, 'approved')}><Check />Approve</Button>
                          <Button size="sm" variant="secondary" className="flex-1" disabled={(reasons[m.id] ?? '').trim().length < 5} onClick={() => decide(m, 'rejected')}><X />Reject</Button>
                        </div>
                      </>
                    ) : <div className="flex items-center justify-between"><StatusBadge status={m.status} />{m.reason && <span className="truncate text-xs text-muted">{m.reason}</span>}</div>}
                  </div>
                </li>
              ))}
            </ul>
            <Pager page={d.page} pages={d.pages} total={d.total} onPage={(page) => setF({ ...f, page })} />
          </>
        )}
      </ErrorOr>
    </Panel>
  );
}

interface AdminProfile {
  profile: Record<string, unknown> & { id: string; owner_user_id: string; profile_code: string; first_name: string | null; last_name: string | null; status: string; about: string | null; is_identity_verified: boolean; is_photo_verified: boolean };
  education: { id: string; qualification: string; institution: string | null; level: string }[];
  career: Record<string, unknown> | null; family: Record<string, unknown> | null; lifestyle: Record<string, unknown> | null; values: Record<string, unknown> | null; preferences: Record<string, unknown> | null;
  dna: { dimension: string; self_score: number; partner_target: number | null; importance: number; source: string }[];
  photos: { id: string; url: string | null; isPrimary: boolean; moderationStatus: string; visibility: string }[];
  video: { id: string; url: string | null; moderationStatus: string; durationSeconds: number | null } | null;
  verifiedKinds: string[];
}

const SKIP = new Set(['profile_id', 'updated_at', 'id', 'embedding', 'search_tsv']);
const fields = (o: Record<string, unknown> | null): [string, React.ReactNode][] =>
  o ? Object.entries(o).filter(([k, v]) => !SKIP.has(k) && v !== null && !(Array.isArray(v) && v.length === 0)).map(([k, v]) => [human(k), Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : human(String(v))]) : [];

export function AdminProfilePage({ id }: { id: string }) {
  const state = useAdminData<AdminProfile>(`/admin/profiles/${id}`);
  const can = useCan();
  return (
    <ErrorOr state={state} rows={10}>
      {(d) => {
        const p = d.profile;
        return (
          <>
            <AdminHeader
              title={[p.first_name, p.last_name].filter(Boolean).join(' ') || p.profile_code}
              description={`${p.profile_code} · admin view includes fields hidden from other members`}
              actions={
                <>
                  <StatusBadge status={p.status} />
                  {can('users.read') && <Button asChild size="sm" variant="ghost"><Link href={`/admin/users/${p.owner_user_id}`}>Account</Link></Button>}
                  {can('profiles.moderate') && p.status !== 'hidden' && p.status !== 'deleted' && (
                    <ConfirmAction trigger={<Button size="sm" variant="secondary">Hide profile</Button>} title="Hide profile from discovery" confirmLabel="Hide" requireReason
                      onConfirm={(reason) => mutate(`/admin/profiles/${id}`, 'PATCH', { action: 'hide', reason }, 'Profile hidden').then((r) => { if (r) state.reload(); return r; })} />
                  )}
                  {can('profiles.moderate') && p.status === 'hidden' && (
                    <ConfirmAction trigger={<Button size="sm" variant="secondary">Unhide</Button>} title="Make profile visible again" confirmLabel="Unhide" requireReason
                      onConfirm={(reason) => mutate(`/admin/profiles/${id}`, 'PATCH', { action: 'unhide', reason }, 'Profile visible').then((r) => { if (r) state.reload(); return r; })} />
                  )}
                </>
              }
            />
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge tone={p.is_identity_verified ? 'success' : 'outline'}>{p.is_identity_verified ? 'Identity verified' : 'Identity not verified'}</Badge>
              <Badge tone={p.is_photo_verified ? 'success' : 'outline'}>{p.is_photo_verified ? 'Photo verified' : 'Photo not verified'}</Badge>
              {d.verifiedKinds.filter((k) => !['government_id', 'photo'].includes(k)).map((k) => <Badge key={k} tone="success" className="capitalize">{human(k)} verified</Badge>)}
              <Badge tone="info">All other details are self-declared</Badge>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <Panel title="Basics"><KeyValues items={fields(Object.fromEntries(Object.entries(p).filter(([k]) => !['about', 'search_text', 'owner_user_id', 'embedding_model', 'embedding_updated_at'].includes(k))))} /></Panel>
                {p.about && <Panel title="About"><p className="whitespace-pre-line text-sm text-ink-2">{p.about}</p></Panel>}
                <Panel title="Education">{d.education.length ? <ul className="space-y-1 text-sm">{d.education.map((e) => <li key={e.id}>{e.qualification}{e.institution ? ` · ${e.institution}` : ''} <span className="text-muted">({human(e.level)})</span></li>)}</ul> : <p className="text-sm text-muted">Not provided.</p>}</Panel>
                <div className="grid gap-4 md:grid-cols-2">
                  <Panel title="Career"><KeyValues items={fields(d.career)} /></Panel>
                  <Panel title="Family"><KeyValues items={fields(d.family)} /></Panel>
                  <Panel title="Lifestyle"><KeyValues items={fields(d.lifestyle)} /></Panel>
                  <Panel title="Values & future"><KeyValues items={fields(d.values)} /></Panel>
                </div>
                <Panel title="Partner preferences"><KeyValues items={fields(d.preferences)} /></Panel>
              </div>
              <div className="space-y-4">
                <Panel title={`Photos (${d.photos.length})`}>
                  {d.photos.length ? (
                    <ul className="grid grid-cols-2 gap-2">
                      {d.photos.map((ph) => (
                        <li key={ph.id} className="relative overflow-hidden rounded-lg border border-line">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {ph.url ? <img src={ph.url} alt="Member photo" className="aspect-square w-full object-cover" /> : <div className="aspect-square bg-surface-2" />}
                          <div className="absolute inset-x-1 bottom-1 flex gap-1">{ph.isPrimary && <Badge tone="champagne">Primary</Badge>}<StatusBadge status={ph.moderationStatus} /></div>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-muted">No photos.</p>}
                </Panel>
                {d.video && <Panel title="Introduction video">{d.video.url && <video src={d.video.url} controls className="w-full rounded-lg" aria-label="Introduction video" />}<div className="mt-2"><StatusBadge status={d.video.moderationStatus} /></div></Panel>}
                <Panel title="Relationship DNA" description="Self-declared positions (0–100).">
                  {d.dna.length ? (
                    <ul className="space-y-2 text-sm">
                      {d.dna.map((x) => (
                        <li key={x.dimension}>
                          <div className="flex justify-between"><span>{DNA_DIMENSION_META[x.dimension as DnaDimension]?.label ?? x.dimension}</span><span className="text-muted">{x.self_score}{x.partner_target !== null ? ` → ${x.partner_target}` : ''} · imp {x.importance}</span></div>
                          <div className="mt-1 h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-burgundy-500" style={{ width: `${x.self_score}%` }} /></div>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-muted">Not answered.</p>}
                </Panel>
              </div>
            </div>
          </>
        );
      }}
    </ErrorOr>
  );
}

'use client';
import * as React from 'react';
import Link from 'next/link';
import { Copy, Link2, MessageSquare, Trash2, UserPlus } from 'lucide-react';
import {
  FAMILY_PERMISSIONS, FAMILY_PERMISSION_LABELS, FAMILY_RELATIONS, relativeTime,
  type FamilyMemberItem, type FamilyPermission, type FamilyRelation, type FamilySuggestionItem, type ProfileCard,
} from '@2k/shared';
import { ProfileCardView } from '@/components/profile/profile-card';
import { useMe } from '@/components/shell/me-context';
import { Badge, Button, Checkbox, Dialog, DialogContent, EmptyState, ErrorState, Field, Input, NativeSelect, Notice, Skeleton } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { DiscussionThread } from './discussion-thread';

type Payload = { members: FamilyMemberItem[]; suggestions: FamilySuggestionItem[]; discussions: { profile: ProfileCard; lastAt: string; count: number }[] };

const relLabel = (r: string) => r[0]!.toUpperCase() + r.slice(1);

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="flex gap-2">
      <Input readOnly value={link} aria-label="Invitation link" className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <Button type="button" variant="secondary" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); }}><Copy />{copied ? 'Copied' : 'Copy'}</Button>
    </div>
  );
}

function PermissionBoxes({ value, onChange, idPrefix }: { value: FamilyPermission[]; onChange: (v: FamilyPermission[]) => void; idPrefix: string }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium text-ink-2">They can</legend>
      {FAMILY_PERMISSIONS.map((p) => (
        <label key={p} htmlFor={`${idPrefix}-${p}`} className="flex items-center gap-3 text-sm text-ink-2">
          <Checkbox id={`${idPrefix}-${p}`} checked={value.includes(p)} onCheckedChange={(c) => onChange(c ? [...value, p] : value.filter((x) => x !== p))} />
          {FAMILY_PERMISSION_LABELS[p]}
        </label>
      ))}
    </fieldset>
  );
}

function InviteForm({ onInvited }: { onInvited: (m: FamilyMemberItem, link: string, delivered: boolean) => void }) {
  const [contact, setContact] = React.useState('');
  const [relation, setRelation] = React.useState<FamilyRelation>('mother');
  const [name, setName] = React.useState('');
  const [perms, setPerms] = React.useState<FamilyPermission[]>(['view_profiles', 'suggest_matches', 'discuss']);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await api<{ member: FamilyMemberItem; inviteLink: string; delivered: boolean }>('/family', { body: { contact: contact.trim(), relation, displayName: name.trim() || null, permissions: perms } });
      onInvited(r.member, r.inviteLink, r.delivered);
      setContact(''); setName('');
    } catch (err) { setError(err instanceof ApiClientError ? err.message : 'Could not send the invitation.'); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email or mobile number" htmlFor="fam-contact" hint="They must sign in with this exact email or number to accept — a forwarded link alone won’t work."><Input value={contact} onChange={(e) => setContact(e.target.value)} required placeholder="amma@example.com or 98765 43210" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Relation" htmlFor="fam-rel"><NativeSelect value={relation} onChange={(e) => setRelation(e.target.value as FamilyRelation)}>{FAMILY_RELATIONS.map((r) => <option key={r} value={r}>{relLabel(r)}</option>)}</NativeSelect></Field>
        <Field label="Name" htmlFor="fam-name" optional><Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="How you call them" /></Field>
      </div>
      <PermissionBoxes value={perms} onChange={setPerms} idPrefix="inv" />
      {error && <ErrorState message={error} />}
      <Button type="submit" loading={busy} disabled={perms.length === 0 || !contact.trim()}><UserPlus />Send invitation</Button>
    </form>
  );
}

export function FamilyOwnerView() {
  const { me } = useMe();
  const [data, setData] = React.useState<Payload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [newLink, setNewLink] = React.useState<{ link: string; delivered: boolean } | null>(null);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [discussing, setDiscussing] = React.useState<ProfileCard | null>(null);

  const load = React.useCallback(async () => {
    try { setData(await api<Payload>('/family')); } catch (e) { setError(e instanceof ApiClientError ? e.message : 'Could not load your family circle.'); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const patch = async (m: FamilyMemberItem, body: { permissions?: FamilyPermission[]; regenerateInvite?: boolean }) => {
    const r = await api<{ member: FamilyMemberItem; inviteLink?: string }>(`/family/${m.id}`, { method: 'PATCH', body });
    setData((d) => d && { ...d, members: d.members.map((x) => (x.id === m.id ? r.member : x)) });
    if (r.inviteLink) setNewLink({ link: r.inviteLink, delivered: false });
  };
  const revoke = async (m: FamilyMemberItem) => {
    if (!window.confirm(`Remove ${m.displayName ?? relLabel(m.relation)} from your family circle?`)) return;
    await api(`/family/${m.id}`, { method: 'DELETE' });
    setData((d) => d && { ...d, members: d.members.filter((x) => x.id !== m.id) });
  };
  const decide = async (s: FamilySuggestionItem, status: 'considering' | 'dismissed') => {
    await api(`/family/suggestions/${s.id}`, { method: 'PATCH', body: { status } });
    setData((d) => d && { ...d, suggestions: status === 'dismissed' ? d.suggestions.filter((x) => x.id !== s.id) : d.suggestions.map((x) => (x.id === s.id ? { ...x, status } : x)) });
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-10">
      <Notice>You stay in control. Family members can only do what you allow — they can never send interests, accept connections or message anyone on your behalf.</Notice>

      <section aria-labelledby="fam-members" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="fam-members" className="font-serif text-3xl">Your family circle</h2>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <Button onClick={() => setInviteOpen(true)}><UserPlus />Invite</Button>
            <DialogContent title="Invite a family member" description="They’ll get a private link to accept. You can change or remove access anytime.">
              <InviteForm onInvited={(m, link, delivered) => { setData((d) => d && { ...d, members: [...d.members, m] }); setNewLink({ link, delivered }); setInviteOpen(false); }} />
            </DialogContent>
          </Dialog>
        </div>
        {newLink && (
          <div className="space-y-2 rounded-2xl border border-champagne-200 bg-champagne-50 p-4">
            <p className="flex items-center gap-2 text-sm font-medium"><Link2 className="h-4 w-4" />{newLink.delivered ? 'Invitation sent. You can also share this link directly:' : 'Share this private link with them (valid for 7 days):'}</p>
            <CopyLink link={newLink.link} />
          </div>
        )}
        {data.members.length === 0 ? (
          <EmptyState title="Invite someone you trust" description="Parents, siblings or a close friend can help review suggestions, shortlist and discuss — with exactly the permissions you choose." />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {data.members.map((m) => (
              <li key={m.id} className="space-y-4 rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-serif text-xl">{m.displayName ?? relLabel(m.relation)}</p>
                    <p className="text-sm text-muted">{relLabel(m.relation)} · {m.invitedContact}</p>
                  </div>
                  <Badge tone={m.status === 'active' ? 'success' : 'warning'}>{m.status === 'active' ? 'Active' : 'Invited'}</Badge>
                </div>
                <PermissionBoxes value={m.permissions} idPrefix={m.id} onChange={(v) => { if (v.length) void patch(m, { permissions: v }); }} />
                <div className="flex flex-wrap gap-2">
                  {m.status === 'invited' && <Button size="sm" variant="secondary" onClick={() => patch(m, { regenerateInvite: true })}><Link2 />New invite link</Button>}
                  <Button size="sm" variant="ghost" onClick={() => revoke(m)}><Trash2 />Remove</Button>
                </div>
                {m.status === 'invited' && m.inviteExpiresAt && <p className="text-xs text-muted">Invitation expires {new Date(m.inviteExpiresAt).toLocaleDateString('en-IN')}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="fam-suggestions" className="space-y-4">
        <h2 id="fam-suggestions" className="font-serif text-3xl">Suggestions from family</h2>
        {data.suggestions.length === 0 ? <p className="text-sm text-muted">No suggestions right now.</p> : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {data.suggestions.map((s) => (
              <div key={s.id} className="space-y-3">
                <p className="text-sm text-ink-2"><span className="font-medium text-ink">{s.suggestedBy.name ?? relLabel(s.suggestedBy.relation)}</span> suggested · {relativeTime(s.createdAt)}</p>
                {s.note && <p className="rounded-xl bg-champagne-50 px-3 py-2 text-sm italic text-ink-2">“{s.note}”</p>}
                {s.profile ? <ProfileCardView card={s.profile} href={`/app/profile/${s.profile.id}`} /> : <p className="text-sm text-muted">This profile is no longer available.</p>}
                <div className="flex flex-wrap gap-2">
                  {s.status === 'pending' && <Button size="sm" onClick={() => decide(s, 'considering')}>I’ll consider</Button>}
                  <Button size="sm" variant="secondary" onClick={() => decide(s, 'dismissed')}>Not for me</Button>
                  {s.profile && <Button size="sm" variant="ghost" onClick={() => setDiscussing(s.profile)}><MessageSquare />Discuss</Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {data.discussions.length > 0 && (
        <section aria-labelledby="fam-disc" className="space-y-4">
          <h2 id="fam-disc" className="font-serif text-3xl">Family discussions</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {data.discussions.map((d) => (
              <li key={d.profile.id}>
                <button type="button" onClick={() => setDiscussing(d.profile)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-surface-2">
                  <span className="font-medium">{d.profile.displayName}</span>
                  <span className="text-sm text-muted">{d.count} message{d.count === 1 ? '' : 's'} · {relativeTime(d.lastAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {me.familyOf.length > 0 && (
        <section aria-labelledby="fam-helping" className="space-y-3">
          <h2 id="fam-helping" className="font-serif text-3xl">Families you’re helping</h2>
          <ul className="flex flex-wrap gap-3">{me.familyOf.map((f) => <li key={f.profileId}><Button asChild variant="secondary"><Link href={`/family/${f.profileId}`}>Help {f.ownerName}</Link></Button></li>)}</ul>
        </section>
      )}

      <Dialog open={!!discussing} onOpenChange={(o) => { if (!o) setDiscussing(null); }}>
        {discussing && (
          <DialogContent title={`Discuss ${discussing.displayName}`} description="Visible only to you and family members with discussion access." side="right">
            <DiscussionThread targetProfileId={discussing.id} />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

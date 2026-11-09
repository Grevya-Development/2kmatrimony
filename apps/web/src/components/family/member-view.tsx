'use client';
import * as React from 'react';
import { Bookmark, Lightbulb, MessageSquare } from 'lucide-react';
import { FAMILY_PERMISSION_LABELS, relativeTime, type FamilyPermission, type ProfileCard } from '@2k/shared';
import { Meetings } from '@/components/connection/meetings';
import { ProfileCardView } from '@/components/profile/profile-card';
import { Badge, Button, Dialog, DialogContent, EmptyState, ErrorState, Notice, Skeleton, Textarea } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { DiscussionThread } from './discussion-thread';

type Payload = {
  owner: { profileId: string; firstName: string; profileCode: string };
  permissions: FamilyPermission[];
  recommendations: ProfileCard[];
  shortlist: { profile: ProfileCard; note: string | null; addedByMe: boolean }[];
  mySuggestions: { id: string; note: string | null; status: string; createdAt: string; profile: ProfileCard | null }[];
  connections: { id: string; profile: ProfileCard }[];
};

/** What an invited family member sees for the profile they help with — always from the owner's perspective. */
export function FamilyMemberView({ profileId }: { profileId: string }) {
  const [data, setData] = React.useState<Payload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [suggesting, setSuggesting] = React.useState<ProfileCard | null>(null);
  const [discussing, setDiscussing] = React.useState<ProfileCard | null>(null);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [flash, setFlash] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try { setData(await api<Payload>(`/family/of/${profileId}`)); } catch (e) { setError(e instanceof ApiClientError ? e.message : 'Could not load.'); }
  }, [profileId]);
  React.useEffect(() => { void load(); }, [load]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <Skeleton className="h-64 w-full" />;
  const can = (p: FamilyPermission) => data.permissions.includes(p);
  const shortlisted = new Set(data.shortlist.map((s) => s.profile.id));

  const shortlist = async (c: ProfileCard) => {
    setError(null);
    try { await api(`/family/of/${profileId}/shortlist`, { body: { targetProfileId: c.id } }); setFlash(`Added ${c.displayName} to ${data.owner.firstName}’s shortlist.`); await load(); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : 'Could not shortlist.'); }
  };
  const suggest = async () => {
    if (!suggesting) return;
    setBusy(true);
    try { await api('/family/suggestions', { body: { profileId, targetProfileId: suggesting.id, note: note.trim() || null } }); setFlash(`Suggestion sent to ${data.owner.firstName}.`); setSuggesting(null); setNote(''); await load(); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : 'Could not send the suggestion.'); }
    finally { setBusy(false); }
  };
  const actions = (c: ProfileCard) => (
    <div className="flex flex-wrap gap-2">
      {can('suggest_matches') && <Button size="sm" variant="secondary" onClick={() => setSuggesting(c)}><Lightbulb />Suggest</Button>}
      {can('shortlist') && !shortlisted.has(c.id) && <Button size="sm" variant="ghost" onClick={() => shortlist(c)}><Bookmark />Shortlist</Button>}
      {can('discuss') && <Button size="sm" variant="ghost" onClick={() => setDiscussing(c)}><MessageSquare />Discuss</Button>}
    </div>
  );

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">Family circle</p>
        <h1 className="mt-1 font-serif text-4xl">Helping {data.owner.firstName}</h1>
        <div className="mt-3 flex flex-wrap gap-2">{data.permissions.map((p) => <Badge key={p} tone="outline">{FAMILY_PERMISSION_LABELS[p]}</Badge>)}</div>
      </header>
      <Notice>{data.owner.firstName} stays in control of interests, connections and conversations. Profiles here are shown as {data.owner.firstName} sees them.</Notice>
      {flash && <Notice tone="success">{flash}</Notice>}

      {can('view_profiles') && (
        <section className="space-y-4">
          <h2 className="font-serif text-3xl">Suggested for {data.owner.firstName}</h2>
          {data.recommendations.length === 0 ? <EmptyState title="No suggestions yet" description="New matches appear here as they’re prepared." /> : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{data.recommendations.map((c) => <ProfileCardView key={c.id} card={c} actions={actions(c)} />)}</div>
          )}
        </section>
      )}

      {data.shortlist.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-serif text-3xl">Shortlist</h2>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {data.shortlist.map((s) => <div key={s.profile.id} className="space-y-2"><ProfileCardView card={s.profile} actions={actions(s.profile)} />{s.addedByMe && <p className="text-xs text-muted">Added by you</p>}</div>)}
          </div>
        </section>
      )}

      {data.mySuggestions.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-serif text-2xl">Your suggestions</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {data.mySuggestions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span>{s.profile?.displayName ?? 'Profile no longer available'} <span className="text-muted">· {relativeTime(s.createdAt)}</span></span>
                <Badge tone={s.status === 'considering' ? 'success' : s.status === 'dismissed' ? 'neutral' : 'warning'}>{s.status === 'pending' ? 'Waiting' : s.status === 'considering' ? 'Considering' : s.status === 'dismissed' ? 'Passed' : 'Acted on'}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {can('coordinate_meetings') && (
        <section className="space-y-4">
          <h2 className="font-serif text-3xl">Help coordinate meetings</h2>
          {data.connections.length === 0 ? <p className="text-sm text-muted">{data.owner.firstName} has no active connections yet.</p> : data.connections.map((c) => (
            <div key={c.id} className="space-y-3 rounded-2xl border border-line p-5">
              <p className="font-serif text-xl">With {c.profile.displayName}</p>
              <Meetings connectionId={c.id} active canRespond={false} />
            </div>
          ))}
        </section>
      )}

      <Dialog open={!!suggesting} onOpenChange={(o) => { if (!o) setSuggesting(null); }}>
        {suggesting && (
          <DialogContent title={`Suggest ${suggesting.displayName}`} description={`${data.owner.firstName} will see your note and decide.`}>
            <div className="space-y-4">
              <label htmlFor="sg-note" className="text-sm font-medium text-ink-2">Why you think they’d get along (optional)</label>
              <Textarea id="sg-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
              <Button onClick={suggest} loading={busy} className="w-full">Send suggestion</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
      <Dialog open={!!discussing} onOpenChange={(o) => { if (!o) setDiscussing(null); }}>
        {discussing && (
          <DialogContent title={`Discuss ${discussing.displayName}`} description="Visible only to the family circle." side="right">
            <DiscussionThread profileId={profileId} targetProfileId={discussing.id} />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

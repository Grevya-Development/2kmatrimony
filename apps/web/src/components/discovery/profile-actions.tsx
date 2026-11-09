'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { toast } from 'sonner';
import { Bookmark, BookmarkCheck, Check, Heart, MessageCircle, MoreHorizontal, X } from 'lucide-react';
import type { InterestStatus, RelationshipState, SendInterestResult } from '@2k/shared';
import { Button, Dialog, DialogContent, Field, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { showApiError } from './hooks';
import { BlockDialog, ReportDialog } from './safety-dialogs';

export interface ActionTarget { id: string; displayName: string; relationship: RelationshipState }

/**
 * State-aware actions for another member: shortlist, interest (send / accept /
 * withdraw / message), pass with undo, report and block.
 */
export function ProfileActions({ target, recommendationId, onRemoved, onChanged, size = 'md', className }: {
  target: ActionTarget; recommendationId?: string; onRemoved?: () => void; onChanged?: (r: RelationshipState) => void; size?: 'sm' | 'md'; className?: string;
}) {
  const router = useRouter();
  const [rel, setRel] = React.useState<RelationshipState>(target.relationship);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [interestOpen, setInterestOpen] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [reportOpen, setReportOpen] = React.useState(false);
  const [blockOpen, setBlockOpen] = React.useState(false);
  React.useEffect(() => setRel(target.relationship), [target.relationship]);

  const update = (r: RelationshipState) => { setRel(r); onChanged?.(r); };
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e) { showApiError(e); } finally { setBusy(null); }
  };

  const toggleShortlist = () => run('shortlist', async () => {
    if (rel.shortlisted) await api(`/shortlist/${target.id}`, { method: 'DELETE' });
    else if (recommendationId) await api(`/recommendations/${recommendationId}`, { body: { action: 'shortlisted' } });
    else await api('/shortlist', { body: { targetProfileId: target.id } });
    update({ ...rel, shortlisted: !rel.shortlisted });
    toast.success(rel.shortlisted ? 'Removed from shortlist' : 'Added to your shortlist');
  });

  const sendInterest = (e: React.FormEvent) => {
    e.preventDefault();
    void run('interest', async () => {
      const r = await api<SendInterestResult>('/interests', { body: { receiverProfileId: target.id, message: note.trim() || null } });
      setInterestOpen(false);
      setNote('');
      if (r.autoAccepted) {
        update({ ...rel, interest: { id: r.interestId, direction: 'received', status: 'accepted' }, connectionId: r.connectionId, conversationId: r.conversationId });
        toast.success(`You and ${target.displayName} are now connected.`);
      } else {
        update({ ...rel, interest: { id: r.interestId, direction: 'sent', status: 'pending' } });
        toast.success('Interest sent. We’ll let you know when they respond.');
      }
    });
  };

  const respond = (action: 'accept' | 'decline' | 'withdraw') => run(action, async () => {
    const r = await api<{ status: InterestStatus; connectionId: string | null; conversationId: string | null }>(`/interests/${rel.interest!.id}`, { body: { action } });
    update({ ...rel, interest: { ...rel.interest!, status: r.status }, connectionId: r.connectionId ?? rel.connectionId, conversationId: r.conversationId ?? rel.conversationId });
    toast.success(action === 'accept' ? `You and ${target.displayName} are now connected.` : action === 'decline' ? 'Interest declined. They won’t be told directly.' : 'Interest withdrawn.');
  });

  const pass = () => run('pass', async () => {
    if (recommendationId) await api(`/recommendations/${recommendationId}`, { body: { action: 'passed' } });
    else await api('/passes', { body: { targetProfileId: target.id } });
    update({ ...rel, passed: true });
    onRemoved?.();
    toast('Passed', {
      action: { label: 'Undo', onClick: () => { void api(`/passes/${target.id}`, { method: 'DELETE' }).then(() => { update({ ...rel, passed: false }); router.refresh(); }).catch(showApiError); } },
    });
  });

  const connected = !!rel.conversationId;
  const pendingReceived = rel.interest?.direction === 'received' && rel.interest.status === 'pending';
  const pendingSent = rel.interest?.direction === 'sent' && rel.interest.status === 'pending';
  const btn = size === 'sm' ? 'sm' : 'md';

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {connected ? (
        <Button asChild size={btn}><Link href={`/app/messages/${rel.conversationId}`}><MessageCircle />Message</Link></Button>
      ) : pendingReceived ? (
        <>
          <Button size={btn} loading={busy === 'accept'} onClick={() => respond('accept')}><Check />Accept</Button>
          <Button size={btn} variant="secondary" loading={busy === 'decline'} onClick={() => respond('decline')}>Decline</Button>
        </>
      ) : pendingSent ? (
        <Button size={btn} variant="secondary" loading={busy === 'withdraw'} onClick={() => respond('withdraw')} title="Withdraw interest">Interest sent · Withdraw</Button>
      ) : (
        <Button size={btn} loading={busy === 'interest'} onClick={() => setInterestOpen(true)}><Heart />Express interest</Button>
      )}
      <Button size={btn === 'sm' ? 'icon' : btn} variant="secondary" aria-pressed={rel.shortlisted} aria-label={rel.shortlisted ? 'Remove from shortlist' : 'Shortlist'} loading={busy === 'shortlist'} onClick={toggleShortlist} className={btn === 'sm' ? 'h-9 w-9' : undefined}>
        {rel.shortlisted ? <BookmarkCheck className="text-emerald-600" /> : <Bookmark />}{btn !== 'sm' && (rel.shortlisted ? 'Shortlisted' : 'Shortlist')}
      </Button>
      {!connected && !rel.passed && (
        <Button size={btn === 'sm' ? 'icon' : btn} variant="ghost" aria-label="Pass" loading={busy === 'pass'} onClick={pass} className={btn === 'sm' ? 'h-9 w-9' : undefined}>
          <X />{btn !== 'sm' && 'Pass'}
        </Button>
      )}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button size="icon" variant="ghost" aria-label="More actions" className="h-9 w-9"><MoreHorizontal /></Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-44 rounded-xl border border-line bg-surface p-1.5 shadow-lift">
            <DropdownMenu.Item onSelect={() => setReportOpen(true)} className="cursor-pointer rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-2">Report</DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => setBlockOpen(true)} className="cursor-pointer rounded-lg px-3 py-2 text-sm text-danger outline-none data-[highlighted]:bg-danger-bg">Block</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Dialog open={interestOpen} onOpenChange={setInterestOpen}>
        <DialogContent title={`Express interest in ${target.displayName}`} description="Add a short, genuine note if you like. They’ll see it with your interest.">
          <form onSubmit={sendInterest} className="space-y-4">
            <Field label="Note" htmlFor="interest-note" optional>
              <Textarea maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="I enjoyed reading about your love of travel…" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setInterestOpen(false)}>Cancel</Button>
              <Button type="submit" loading={busy === 'interest'}><Heart />Send interest</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetProfileId={target.id} name={target.displayName} />
      <BlockDialog open={blockOpen} onOpenChange={setBlockOpen} targetProfileId={target.id} name={target.displayName} onBlocked={() => { if (onRemoved) onRemoved(); else router.push('/app'); }} />
    </div>
  );
}

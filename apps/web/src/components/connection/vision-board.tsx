'use client';
import * as React from 'react';
import { Eye, EyeOff, Sparkles, Trash2 } from 'lucide-react';
import { VISION_CATEGORIES, VISION_CATEGORY_LABELS, type InsightEnvelope, type VisionCategory, type VisionItem, type VisionThemes } from '@2k/shared';
import { Badge, Button, ErrorState, NativeSelect, Notice, Skeleton, Switch, Textarea } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { cn } from '@/lib/utils';

export function VisionBoard({ connectionId, otherName, active }: { connectionId: string; otherName: string; active: boolean }) {
  const [items, setItems] = React.useState<VisionItem[] | null>(null);
  const [themes, setThemes] = React.useState<InsightEnvelope<VisionThemes> | null>(null);
  const [category, setCategory] = React.useState<VisionCategory>('travel');
  const [content, setContent] = React.useState('');
  const [share, setShare] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const r = await api<{ items: VisionItem[]; themes: InsightEnvelope<VisionThemes> | null }>(`/connections/${connectionId}/vision`);
      setItems(r.items);
      setThemes(r.themes);
    } catch (e) { setError(e instanceof ApiClientError ? e.message : 'Could not load the vision board.'); setItems([]); }
  }, [connectionId]);
  React.useEffect(() => { void load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const item = await api<VisionItem>(`/connections/${connectionId}/vision`, { body: { category, content: content.trim(), isShared: share } });
      setItems((xs) => [...(xs ?? []), item]);
      setContent('');
    } catch (err) { setError(err instanceof ApiClientError ? err.message : 'Could not add.'); }
    finally { setBusy(false); }
  };
  const toggleShare = async (it: VisionItem) => {
    const updated = await api<VisionItem>(`/connections/${connectionId}/vision/${it.id}`, { method: 'PATCH', body: { isShared: !it.isShared } });
    setItems((xs) => xs!.map((x) => (x.id === it.id ? updated : x)));
  };
  const remove = async (it: VisionItem) => {
    await api(`/connections/${connectionId}/vision/${it.id}`, { method: 'DELETE' });
    setItems((xs) => xs!.filter((x) => x.id !== it.id));
  };
  const findThemes = async () => {
    setBusy(true); setError(null);
    try { setThemes(await api(`/connections/${connectionId}/vision/themes`, { method: 'POST' })); }
    catch (err) { setError(err instanceof ApiClientError ? err.message : 'Could not find themes.'); }
    finally { setBusy(false); }
  };

  if (!items) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="space-y-6">
      <Notice>Everything you add is private to you until you choose to share it with {otherName}. Sharing is always voluntary.</Notice>
      {error && <ErrorState message={error} />}
      {active && (
        <form onSubmit={add} className="grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-[12rem_1fr]">
          <label className="sr-only" htmlFor="vb-cat">Category</label>
          <NativeSelect id="vb-cat" value={category} onChange={(e) => setCategory(e.target.value as VisionCategory)}>
            {VISION_CATEGORIES.map((c) => <option key={c} value={c}>{VISION_CATEGORY_LABELS[c]}</option>)}
          </NativeSelect>
          <label className="sr-only" htmlFor="vb-text">Your hope or goal</label>
          <Textarea id="vb-text" className="min-h-12" maxLength={500} value={content} onChange={(e) => setContent(e.target.value)} placeholder="A hope, plan or dream — e.g. a home with a garden, a year abroad, learning music together" />
          <label className="flex items-center gap-3 text-sm text-ink-2 sm:col-start-2"><Switch checked={share} onCheckedChange={setShare} />Share with {otherName}</label>
          <Button type="submit" className="sm:col-start-2 sm:justify-self-end" disabled={!content.trim()} loading={busy}>Add to board</Button>
        </form>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {VISION_CATEGORIES.map((cat) => {
          const list = items.filter((i) => i.category === cat);
          if (!list.length) return null;
          return (
            <div key={cat} className="rounded-2xl border border-line bg-surface p-4">
              <h3 className="mb-3 font-serif text-xl">{VISION_CATEGORY_LABELS[cat]}</h3>
              <ul className="space-y-2">{list.map((it) => (
                <li key={it.id} className={cn('flex items-start gap-3 rounded-xl p-3 text-sm', it.isMine ? 'bg-surface-2' : 'bg-champagne-50')}>
                  <p className="flex-1 text-ink">{it.content}<span className="mt-1 block text-xs text-muted">{it.isMine ? (it.isShared ? 'You · shared' : 'You · private') : otherName}</span></p>
                  {it.isMine && (
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => toggleShare(it)} className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-ink" aria-label={it.isShared ? 'Make private' : 'Share'}>{it.isShared ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                      <button type="button" onClick={() => remove(it)} className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-danger" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </li>
              ))}</ul>
            </div>
          );
        })}
      </div>
      {items.length === 0 && <p className="text-center text-sm text-muted">Nothing here yet. Start with one hope for the next few years.</p>}
      <div className="rounded-2xl border border-line p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-serif text-xl"><Sparkles className="h-4 w-4 text-champagne-600" aria-hidden />Common themes</h3>
          {active && <Button size="sm" variant="secondary" onClick={findThemes} loading={busy}>{themes ? 'Refresh themes' : 'Find common themes'}</Button>}
        </div>
        {themes ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><p className="mb-2 text-sm font-semibold">Shared hopes</p>{themes.content.commonThemes.length ? <ul className="space-y-1 text-sm text-ink-2">{themes.content.commonThemes.map((t) => <li key={t}>{t}</li>)}</ul> : <p className="text-sm text-muted">None yet.</p>}</div>
            <div><p className="mb-2 text-sm font-semibold">Still to explore</p><ul className="space-y-1 text-sm text-ink-2">{themes.content.unansweredQuestions.map((t) => <li key={t}>{t}</li>)}</ul></div>
            <p className="text-xs text-muted sm:col-span-2">{themes.content.note} {themes.generator === 'ai' && <Badge tone="champagne">AI</Badge>}</p>
          </div>
        ) : <p className="mt-2 text-sm text-muted">Uses only items you’ve both shared.</p>}
      </div>
    </div>
  );
}

'use client';
import * as React from 'react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { DNA_DIMENSION_META, type DnaDimension, type DnaSuggestion } from '@2k/shared';
import { api, ApiClientError } from '@/lib/api';
import { Button, Card, CardContent, Dialog, DialogContent, Field, Notice, Textarea } from '@/components/ui';
import { DnaChart, DnaLegend, type DnaPoint } from './dna-chart';
import { DnaScaleInput, type DnaValue } from './dna-scale-input';

const defaultValue = (p?: DnaPoint): DnaValue => ({ selfScore: p?.selfScore ?? 50, partnerTarget: p?.partnerTarget ?? null, importance: p?.importance ?? 3, flexible: p?.flexible ?? true });

export function DnaEditor({ initial, aiConsent }: { initial: DnaPoint[]; aiConsent: boolean }) {
  const [points, setPoints] = React.useState(initial);
  const [editing, setEditing] = React.useState<DnaDimension | null>(null);
  const [draft, setDraft] = React.useState<DnaValue>(defaultValue());
  const [saving, setSaving] = React.useState(false);
  const [text, setText] = React.useState('');
  const [thinking, setThinking] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<(DnaSuggestion & { edited: DnaValue; changed: boolean })[]>([]);
  const [aiError, setAiError] = React.useState<string | null>(null);

  const open = (d: DnaDimension) => { setDraft(defaultValue(points.find((p) => p.dimension === d))); setEditing(d); };

  const persist = async (entries: (DnaValue & { dimension: DnaDimension; origin: 'explicit' | 'ai_accepted' | 'ai_corrected' })[]) => {
    await api('/profile/dna', { method: 'PUT', body: { entries } });
    const source = (o: string) => (o === 'ai_accepted' ? 'ai_suggested' : o === 'ai_corrected' ? 'user_corrected' : 'explicit');
    setPoints((ps) => {
      const m = new Map(ps.map((p) => [p.dimension, p]));
      for (const e of entries) m.set(e.dimension, { dimension: e.dimension, selfScore: e.selfScore, partnerTarget: e.partnerTarget, importance: e.importance, flexible: e.flexible, source: source(e.origin) });
      return [...m.values()];
    });
  };

  const saveOne = async () => {
    if (!editing) return;
    setSaving(true);
    try { await persist([{ dimension: editing, ...draft, origin: 'explicit' }]); toast.success('Saved'); setEditing(null); }
    catch (e) { toast.error((e as ApiClientError).message); }
    finally { setSaving(false); }
  };

  const interpret = async () => {
    setThinking(true); setAiError(null); setSuggestions([]);
    try {
      const r = await api<{ suggestions: DnaSuggestion[] }>('/profile/dna/interpret', { body: { text } });
      if (!r.suggestions.length) setAiError('We could not find clear signals in that description. Try adding a little more about how you like to connect, live and plan.');
      setSuggestions(r.suggestions.map((s) => {
        const current = points.find((p) => p.dimension === s.dimension);
        return { ...s, changed: false, edited: { selfScore: s.selfScore, importance: s.importance, partnerTarget: current?.partnerTarget ?? null, flexible: current?.flexible ?? true } };
      }));
    } catch (e) {
      const err = e as ApiClientError;
      setAiError(err.code === 'service_unconfigured' || err.code === 'feature_disabled'
        ? 'AI suggestions are not available right now. You can still set each dimension yourself.'
        : err.message);
    } finally { setThinking(false); }
  };

  const acceptAll = async () => {
    setSaving(true);
    try {
      await persist(suggestions.map((s) => ({ dimension: s.dimension, ...s.edited, origin: s.changed ? 'ai_corrected' : 'ai_accepted' })));
      toast.success('Your confirmed suggestions are saved.');
      setSuggestions([]); setText('');
    } catch (e) { toast.error((e as ApiClientError).message); } finally { setSaving(false); }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardContent className="space-y-5">
          <DnaLegend />
          <DnaChart points={points} onSelect={open} />
          <p className="text-xs text-muted">Select any dimension to adjust it. Everything here is self-described — it is not a personality test or diagnosis, and you can change it anytime.</p>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-champagne-600" /><h2 className="font-serif text-2xl">Describe it in your words</h2></div>
          <p className="text-sm text-muted">Write a few sentences about how you like to connect, live and plan. We’ll suggest positions — you review and confirm each one.</p>
          {!aiConsent ? (
            <Notice>AI assistance is off. Turn it on in <a href="/app/settings?tab=consents" className="underline">Settings → Consents</a> to use suggestions.</Notice>
          ) : (
            <>
              <Field label="About you" htmlFor="dna-text" hint={`${text.length}/2000`}>
                <Textarea rows={5} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="I recharge with quiet evenings, love long conversations, and I’d like to live near my parents…" />
              </Field>
              <Button onClick={interpret} loading={thinking} disabled={text.trim().length < 20} className="w-full">Suggest positions</Button>
            </>
          )}
          {aiError && <Notice tone="warning">{aiError}</Notice>}
          {suggestions.length > 0 && (
            <div className="space-y-4 border-t border-line pt-4">
              {suggestions.map((s, i) => (
                <div key={s.dimension} className="space-y-3 rounded-xl border border-line p-4">
                  <p className="font-medium">{DNA_DIMENSION_META[s.dimension].label}</p>
                  <p className="text-sm italic text-muted">{s.rationale}</p>
                  <DnaScaleInput id={`sug-${s.dimension}`} left={DNA_DIMENSION_META[s.dimension].left} right={DNA_DIMENSION_META[s.dimension].right} value={s.edited}
                    onChange={(v) => setSuggestions((xs) => xs.map((x, j) => (j === i ? { ...x, edited: v, changed: true } : x)))} selfLabel="Suggested position (adjust if needed)" />
                  <Button variant="ghost" size="sm" onClick={() => setSuggestions((xs) => xs.filter((_, j) => j !== i))}>Discard this suggestion</Button>
                </div>
              ))}
              <Button onClick={acceptAll} loading={saving} className="w-full">Confirm {suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''}</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <DialogContent title={DNA_DIMENSION_META[editing].label} description="Self-described and always editable.">
            <DnaScaleInput id={`edit-${editing}`} left={DNA_DIMENSION_META[editing].left} right={DNA_DIMENSION_META[editing].right} value={draft} onChange={setDraft} />
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={saveOne} loading={saving}>Save</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

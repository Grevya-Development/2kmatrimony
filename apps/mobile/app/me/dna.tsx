import * as React from 'react';
import { View } from 'react-native';
import { DNA_DIMENSIONS, DNA_DIMENSION_META, type DnaDimension, type DnaSuggestion } from '@2k/shared';
import { api, ApiClientError, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { keys, useOwnProfile, useQueryClient } from '@/hooks/queries';
import { colors, space } from '@/theme';
import { Badge, Button, Card, ErrorState, ImportancePicker, Loading, Notice, Screen, SpectrumSlider, Switch, Text, TextField } from '@/components/ui';
import { DnaChart } from '@/components/domain/DnaChart';

interface Entry { dimension: DnaDimension; selfScore: number; partnerTarget: number | null; importance: number; flexible: boolean; statement: string | null; origin: 'explicit' | 'ai_accepted' | 'ai_corrected'; source?: string }

export default function DnaScreen() {
  const qc = useQueryClient();
  const profile = useOwnProfile();
  const [entries, setEntries] = React.useState<Record<string, Entry>>({});
  const [suggested, setSuggested] = React.useState<Record<string, DnaSuggestion>>({});
  const [text, setText] = React.useState('');
  const [note, setNote] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<'save' | 'interpret' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!profile.data) return;
    setEntries(Object.fromEntries(profile.data.form.dna.map((d) => [d.dimension, { ...d, statement: d.statement ?? null, origin: 'explicit' as const, source: d.source }])));
  }, [profile.data]);

  const update = (dim: DnaDimension, patch: Partial<Entry>) => setEntries((p) => {
    const cur = p[dim] ?? { dimension: dim, selfScore: 50, partnerTarget: null, importance: 3, flexible: true, statement: null, origin: 'explicit' as const };
    const origin = suggested[dim] && cur.origin !== 'explicit' ? 'ai_corrected' : cur.origin;
    return { ...p, [dim]: { ...cur, ...patch, origin } };
  });

  const interpret = async () => {
    setBusy('interpret'); setError(null);
    try {
      const r = await api.post<{ suggestions: DnaSuggestion[]; note: string }>('/profile/dna/interpret', { text });
      setNote(r.note);
      setSuggested(Object.fromEntries(r.suggestions.map((s) => [s.dimension, s])));
    } catch (e) {
      setError(e instanceof ApiClientError && e.code === 'service_unconfigured' ? 'AI suggestions aren’t available right now. You can set each spectrum yourself below.' : errorMessage(e));
    } finally { setBusy(null); }
  };

  const accept = (s: DnaSuggestion) => {
    haptic.tap();
    setEntries((p) => ({ ...p, [s.dimension]: { ...(p[s.dimension] ?? { partnerTarget: null, flexible: true, statement: null }), dimension: s.dimension, selfScore: s.selfScore, importance: s.importance, origin: 'ai_accepted' } as Entry }));
  };

  const save = async () => {
    const list = Object.values(entries);
    if (!list.length) return setError('Set at least one spectrum.');
    setBusy('save'); setError(null);
    try {
      await api.put('/profile/dna', { entries: list.map(({ source: _s, ...e }) => e) });
      haptic.success();
      await Promise.all([qc.invalidateQueries({ queryKey: keys.profile }), qc.invalidateQueries({ queryKey: keys.me })]);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
  };

  if (profile.isLoading) return <Screen edges={[]}><Loading /></Screen>;
  const chart = Object.values(entries);

  return (
    <Screen edges={[]} keyboardShouldPersistTaps="handled">
      <Text variant="bodyMuted">Your Relationship DNA is a picture of your own answers — not a personality test or diagnosis. You can change it any time.</Text>
      {chart.length > 0 && <DnaChart entries={chart} />}
      <View style={{ flexDirection: 'row', gap: space.md, justifyContent: 'center' }}>
        <Badge label="● You" tone="emerald" />
        <Badge label="◌ Hoped-for partner" tone="gold" />
      </View>
      <Card style={{ gap: space.md }}>
        <Text variant="heading">Describe yourself in your words</Text>
        <Text variant="small">Optional: AI can suggest positions from what you write. Nothing is saved until you accept and save.</Text>
        <TextField label="About how you relate and communicate" multiline maxLength={2000} value={text} onChangeText={setText} placeholder="I like a lot of independence but I check in every evening…" />
        <Button title="Suggest positions" variant="secondary" onPress={interpret} loading={busy === 'interpret'} disabled={text.trim().length < 20} />
        {note && <Notice>{note}</Notice>}
      </Card>
      {error && <ErrorState message={error} />}
      {DNA_DIMENSIONS.map((dim) => {
        const meta = DNA_DIMENSION_META[dim];
        const e = entries[dim];
        const s = suggested[dim];
        return (
          <Card key={dim} style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text variant="heading" style={{ fontSize: 20, flex: 1 }}>{meta.label}</Text>
              {e?.source === 'ai_suggested' && <Badge label="AI suggested" tone="info" />}
              {!e && <Badge label="Not set" tone="neutral" />}
            </View>
            {s && (
              <View style={{ gap: 6, padding: space.md, borderRadius: 12, backgroundColor: colors.infoBg }}>
                <Text variant="small" style={{ color: colors.info }}>Suggestion: {s.selfScore} — {s.rationale}</Text>
                <Button title="Use suggestion" size="sm" variant="secondary" onPress={() => accept(s)} />
              </View>
            )}
            <SpectrumSlider label={`${meta.label} — you`} value={e?.selfScore ?? 50} onChange={(n) => update(dim, { selfScore: n })} left={meta.left} right={meta.right} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="label">Partner similar to me</Text>
              <Switch accessibilityLabel={`${meta.label}: partner similar to me`} value={(e?.partnerTarget ?? null) === null} onValueChange={(on) => update(dim, { partnerTarget: on ? null : e?.selfScore ?? 50 })} trackColor={{ true: colors.emerald500, false: colors.lineStrong }} />
            </View>
            {e && e.partnerTarget !== null && <SpectrumSlider label={`${meta.label} — partner`} value={e.partnerTarget} onChange={(n) => update(dim, { partnerTarget: n })} left={meta.left} right={meta.right} />}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="label">Importance</Text>
              <ImportancePicker label={`${meta.label} importance`} value={e?.importance ?? 3} onChange={(n) => update(dim, { importance: n })} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="label">Flexible</Text>
              <Switch accessibilityLabel={`${meta.label}: flexible`} value={e?.flexible ?? true} onValueChange={(on) => update(dim, { flexible: on })} trackColor={{ true: colors.emerald500, false: colors.lineStrong }} />
            </View>
          </Card>
        );
      })}
      <Button title="Save Relationship DNA" size="lg" onPress={save} loading={busy === 'save'} full />
    </Screen>
  );
}

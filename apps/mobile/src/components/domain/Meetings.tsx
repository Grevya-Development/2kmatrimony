import * as React from 'react';
import { Alert, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { MeetingPlan } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { space } from '@/theme';
import { Badge, Button, Card, ErrorState, Loading, Notice, Text, TextField } from '@/components/ui';

const MEETING_TONE = { proposed: 'warning', accepted: 'success', declined: 'neutral', cancelled: 'neutral', completed: 'info' } as const;
const pad = (n: number) => String(n).padStart(2, '0');

/** Propose, accept/decline, cancel and complete first meetings. */
export function Meetings({ connectionId: id, active, canRespond }: { connectionId: string; active: boolean; canRespond: boolean }) {
  const q = useQuery({ queryKey: ['meetings', id], queryFn: () => api.get<MeetingPlan[]>(`/connections/${id}/meetings`) });
  const tomorrow = new Date(Date.now() + 86400_000);
  const [title, setTitle] = React.useState('Coffee');
  const [day, setDay] = React.useState(pad(tomorrow.getDate()));
  const [month, setMonth] = React.useState(pad(tomorrow.getMonth() + 1));
  const [year, setYear] = React.useState(String(tomorrow.getFullYear()));
  const [time, setTime] = React.useState('17:00');
  const [place, setPlace] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const propose = useMutation({
    mutationFn: async () => {
      const [h, m] = time.split(':').map((x) => Number(x));
      const when = new Date(Number(year), Number(month) - 1, Number(day), h ?? NaN, m ?? 0);
      if (Number.isNaN(when.getTime())) throw new Error('Enter a valid date and time (HH:MM).');
      if (when.getTime() < Date.now()) throw new Error('Choose a time in the future.');
      return api.post<MeetingPlan>(`/connections/${id}/meetings`, { title: title.trim(), proposedAt: when.toISOString(), locationText: place.trim() || null, notes: notes.trim() || null });
    },
    onSuccess: () => { haptic.success(); setError(null); setPlace(''); setNotes(''); void q.refetch(); },
    onError: (e) => setError(errorMessage(e)),
  });
  const update = async (m: MeetingPlan, status: 'accepted' | 'declined' | 'cancelled' | 'completed') => {
    try { await api.patch(`/connections/${id}/meetings/${m.id}`, { status }); haptic.success(); void q.refetch(); }
    catch (e) { Alert.alert('Not updated', errorMessage(e)); }
  };

  return (
    <View style={{ gap: space.md }}>
      <Notice>Meet somewhere public for the first time, and tell someone you trust where you’ll be.</Notice>
      {q.isLoading ? <Loading /> : q.error ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : (q.data ?? []).map((m) => (
        <Card key={m.id} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="label">{m.title}</Text>
            <Badge label={m.status} tone={MEETING_TONE[m.status]} />
          </View>
          <Text>{new Date(m.proposedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}{m.locationText ? ` · ${m.locationText}` : ''}</Text>
          {m.notes && <Text variant="small">{m.notes}</Text>}
          <Text variant="small">{m.proposedByMe ? 'Proposed by you' : m.proposedByFamily ? 'Proposed by family' : 'Proposed by them'}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {canRespond && m.status === 'proposed' && !m.proposedByMe && <>
              <Button title="Accept" size="sm" onPress={() => update(m, 'accepted')} />
              <Button title="Decline" size="sm" variant="secondary" onPress={() => update(m, 'declined')} />
            </>}
            {canRespond && m.status === 'accepted' && <Button title="Mark as met" size="sm" variant="secondary" onPress={() => update(m, 'completed')} />}
            {(m.status === 'proposed' || m.status === 'accepted') && <Button title="Cancel" size="sm" variant="ghost" onPress={() => update(m, 'cancelled')} />}
          </View>
        </Card>
      ))}
      {!q.isLoading && (q.data ?? []).length === 0 && <Text variant="bodyMuted">No meetings planned yet.</Text>}
      {active && (
        <Card style={{ gap: space.md }}>
          <Text variant="heading">Propose a meeting</Text>
          <TextField label="What" value={title} onChangeText={setTitle} maxLength={120} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><TextField label="Day" keyboardType="number-pad" maxLength={2} value={day} onChangeText={setDay} /></View>
            <View style={{ flex: 1 }}><TextField label="Month" keyboardType="number-pad" maxLength={2} value={month} onChangeText={setMonth} /></View>
            <View style={{ flex: 1.3 }}><TextField label="Year" keyboardType="number-pad" maxLength={4} value={year} onChangeText={setYear} /></View>
          </View>
          <TextField label="Time (24h, HH:MM)" keyboardType="numbers-and-punctuation" maxLength={5} value={time} onChangeText={setTime} />
          <TextField label="Where" optional value={place} onChangeText={setPlace} maxLength={200} placeholder="A café or public place" />
          <TextField label="Notes" optional multiline value={notes} onChangeText={setNotes} maxLength={500} />
          {error && <ErrorState message={error} />}
          <Button title="Send proposal" onPress={() => propose.mutate()} loading={propose.isPending} disabled={!title.trim()} />
        </Card>
      )}
    </View>
  );
}

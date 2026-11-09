import * as React from 'react';
import { View } from 'react-native';
import type { OnboardingQuestion } from '@2k/shared';
import { colors, space } from '@/theme';
import { Card, ChipGroup, ImportancePicker, SpectrumSlider, Switch, Text, TextField } from '@/components/ui';
import { Footer, useSubmit } from './common';

interface DnaAnswer { selfScore: number; partnerTarget: number | null; importance: number; flexible: boolean; statement?: string | null }
const isScale = (o: OnboardingQuestion['options']): o is { left: string; right: string } => !Array.isArray(o);

/** Renders configurable questions (values or DNA). Answers POST to /onboarding/answers. */
export function QuestionsForm({ questions, onSubmit, submitLabel, onSkip }: {
  questions: OnboardingQuestion[]; onSubmit: (answers: { questionKey: string; answer: unknown }[]) => Promise<unknown>; submitLabel?: string; onSkip?: () => void;
}) {
  const [answers, setAnswers] = React.useState<Record<string, unknown>>(() => Object.fromEntries(questions.filter((q) => q.answer !== null && q.answer !== undefined).map((q) => [q.key, q.answer])));
  const set = (k: string, v: unknown) => setAnswers((p) => ({ ...p, [k]: v }));
  const { busy, error, submit } = useSubmit(onSubmit);

  const go = () => {
    const payload = questions.flatMap((q) => {
      const a = answers[q.key];
      if (a === undefined || a === null || a === '' || (Array.isArray(a) && a.length === 0)) return [];
      return [{ questionKey: q.key, answer: a }];
    });
    void submit(payload, () => {
      const missing = questions.find((q) => q.isRequired && !payload.some((p) => p.questionKey === q.key));
      if (missing) return `Please answer: “${missing.prompt}”`;
      return payload.length ? null : 'Answer at least one question.';
    });
  };

  return (
    <View style={{ gap: space.lg }}>
      {questions.map((q) => (
        <Card key={q.key} style={{ gap: space.md }}>
          <Text variant="heading" style={{ fontSize: 20 }}>{q.prompt}</Text>
          {q.helpText && <Text variant="small">{q.helpText}</Text>}
          {q.inputType === 'scale' && isScale(q.options) ? (
            <ScaleQuestion q={q} value={(answers[q.key] as DnaAnswer | undefined) ?? null} onChange={(v) => set(q.key, v)} left={q.options.left} right={q.options.right} />
          ) : (q.inputType === 'single_select' || q.inputType === 'multi_select') && Array.isArray(q.options) ? (
            <ChipGroup
              label={q.prompt}
              multiple={q.inputType === 'multi_select'}
              max={5}
              options={q.options}
              value={q.inputType === 'multi_select' ? ((answers[q.key] as string[] | undefined) ?? []) : answers[q.key] ? [answers[q.key] as string] : []}
              onChange={(v) => set(q.key, q.inputType === 'multi_select' ? v : v[0] ?? null)}
            />
          ) : (
            <TextField label="Your answer" optional={!q.isRequired} multiline={q.inputType === 'long_text'} maxLength={q.inputType === 'long_text' ? 1000 : 300} value={(answers[q.key] as string | undefined) ?? ''} onChangeText={(t) => set(q.key, t)} />
          )}
        </Card>
      ))}
      <Footer busy={busy} error={error} label={submitLabel} onPress={go} onSkip={onSkip} />
    </View>
  );
}

function ScaleQuestion({ q, value, onChange, left, right }: { q: OnboardingQuestion; value: DnaAnswer | null; onChange: (v: DnaAnswer) => void; left: string; right: string }) {
  const v: DnaAnswer = value ?? { selfScore: 50, partnerTarget: null, importance: 3, flexible: true };
  const [touched, setTouched] = React.useState(!!value);
  const update = (patch: Partial<DnaAnswer>) => { setTouched(true); onChange({ ...v, ...patch }); };
  return (
    <View style={{ gap: space.md }}>
      <SpectrumSlider label={`${q.prompt} — where you are`} value={v.selfScore} onChange={(n) => update({ selfScore: n })} left={left} right={right} />
      {!touched && <Text variant="small" style={{ color: colors.champagne600 }}>Move the slider to answer.</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="label">Partner similar to me</Text>
        <Switch accessibilityLabel="Partner similar to me" value={v.partnerTarget === null} onValueChange={(on) => update({ partnerTarget: on ? null : v.selfScore })} trackColor={{ true: colors.burgundy500, false: colors.lineStrong }} />
      </View>
      {v.partnerTarget !== null && <SpectrumSlider label={`${q.prompt} — where you'd like a partner`} value={v.partnerTarget} onChange={(n) => update({ partnerTarget: n })} left={left} right={right} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="label">How much it matters</Text>
        <ImportancePicker label="Importance" value={v.importance} onChange={(n) => update({ importance: n })} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="label">I’m flexible on this</Text>
        <Switch accessibilityLabel="Flexible" value={v.flexible} onValueChange={(on) => update({ flexible: on })} trackColor={{ true: colors.burgundy500, false: colors.lineStrong }} />
      </View>
    </View>
  );
}

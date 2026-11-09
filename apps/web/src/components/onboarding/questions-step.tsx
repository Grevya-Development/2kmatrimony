'use client';
import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import type { CompletionReport, OnboardingQuestion } from '@2k/shared';
import { api, ApiClientError } from '@/lib/api';
import { Button, ChipGroup, Input, Textarea } from '@/components/ui';
import { DnaScaleInput, type DnaValue } from '@/components/dna/dna-scale-input';
import type { Subject } from '@/components/profile-edit/form-kit';

const adapt = (s: string, subject: Subject) =>
  subject.self ? s : s.replace(/\bYou\b/g, 'They').replace(/\byou\b/g, 'they').replace(/\bYour\b/g, 'Their').replace(/\byour\b/g, 'their').replace(/\byourself\b/g, 'themselves');

const defaultDna = (): DnaValue => ({ selfScore: 50, partnerTarget: null, importance: 3, flexible: true });

/** One question at a time; answers are saved together at the end of the section. */
export function QuestionsStep({ questions, subject, onDone, onBack }: { questions: OnboardingQuestion[]; subject: Subject; onDone: (c: CompletionReport | null) => void; onBack?: () => void }) {
  const reduce = useReducedMotion();
  const [i, setI] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, unknown>>(() => Object.fromEntries(questions.filter((q) => q.answer !== null && q.answer !== undefined).map((q) => [q.key, q.answer])));
  const [busy, setBusy] = React.useState(false);
  const q = questions[i];
  if (!q) return null;

  const value = answers[q.key];
  const set = (v: unknown) => setAnswers((a) => ({ ...a, [q.key]: v }));
  const answered = value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0);
  const isLast = i === questions.length - 1;

  const finish = async (all: Record<string, unknown> = answers) => {
    const payload = questions.filter((x) => all[x.key] !== undefined && all[x.key] !== '' && !(Array.isArray(all[x.key]) && (all[x.key] as unknown[]).length === 0))
      .map((x) => ({ questionKey: x.key, answer: all[x.key] }));
    const missing = questions.filter((x) => x.isRequired && !payload.some((p) => p.questionKey === x.key));
    if (missing.length) {
      setI(questions.indexOf(missing[0]!));
      toast.message('One more answer is needed to continue.');
      return;
    }
    if (!payload.length) return onDone(null);
    setBusy(true);
    try {
      const r = await api<{ completion: CompletionReport }>('/onboarding/answers', { body: { answers: payload } });
      onDone(r.completion);
    } catch (e) { toast.error((e as ApiClientError).message); } finally { setBusy(false); }
  };

  const next = (all?: Record<string, unknown>) => (isLast ? finish(all) : setI(i + 1));
  const options = Array.isArray(q.options) ? q.options : [];
  const scale = !Array.isArray(q.options) ? q.options : null;

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted" aria-live="polite">Question {i + 1} of {questions.length}{!q.isRequired && ' · optional'}</p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={q.key} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -12 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="space-y-6">
          <div>
            <h2 className="font-serif text-3xl leading-tight text-ink text-balance sm:text-4xl">{adapt(q.prompt, subject)}</h2>
            {q.helpText && <p className="mt-2 text-muted">{adapt(q.helpText, subject)}</p>}
          </div>
          {q.inputType === 'scale' && scale && (
            <DnaScaleInput id={q.key} left={scale.left} right={scale.right} value={(value as DnaValue | undefined) ?? defaultDna()} onChange={set}
              selfLabel={subject.self ? 'Where do you sit?' : 'Where do they sit?'} partnerLabel={subject.self ? 'And your ideal partner?' : 'And their ideal partner?'} />
          )}
          {q.inputType === 'single_select' && <ChipGroup label={q.prompt} options={options} value={typeof value === 'string' ? [value] : []} onChange={([x]) => set(x)} />}
          {q.inputType === 'multi_select' && <ChipGroup multiple max={5} label={q.prompt} options={options} value={Array.isArray(value) ? (value as string[]) : []} onChange={set} />}
          {q.inputType === 'long_text' && <Textarea aria-label={q.prompt} rows={4} maxLength={1000} value={(value as string) ?? ''} onChange={(e) => set(e.target.value)} />}
          {(q.inputType === 'text' || q.inputType === 'number') && <Input aria-label={q.prompt} type={q.inputType === 'number' ? 'number' : 'text'} value={(value as string) ?? ''} onChange={(e) => set(q.inputType === 'number' ? Number(e.target.value) : e.target.value)} />}
        </motion.div>
      </AnimatePresence>
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={() => (i === 0 ? onBack?.() : setI(i - 1))} disabled={i === 0 && !onBack}>Back</Button>
        <div className="flex gap-2">
          {!q.isRequired && !answered && <Button type="button" variant="ghost" onClick={() => next()}>Skip</Button>}
          <Button type="button" size="lg" loading={busy} disabled={q.isRequired && !answered && q.inputType !== 'scale'}
            onClick={() => {
              if (q.inputType === 'scale' && value === undefined) { const all = { ...answers, [q.key]: defaultDna() }; setAnswers(all); next(all); } else next();
            }}>
            {isLast ? 'Save & continue' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}

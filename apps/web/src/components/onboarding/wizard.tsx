'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, CircleAlert } from 'lucide-react';
import type { CompletionReport, ConsentType, CreatedFor, OnboardingQuestion, OnboardingStep, OwnProfileResponse } from '@2k/shared';
import { api } from '@/lib/api';
import { Brand } from '@/components/shell/brand';
import { Button, Progress } from '@/components/ui';
import { subjectCopy } from '@/components/profile-edit/form-kit';
import { BasicsForm } from '@/components/profile-edit/basics-form';
import { EducationForm } from '@/components/profile-edit/education-form';
import { CareerForm } from '@/components/profile-edit/career-form';
import { FamilyForm } from '@/components/profile-edit/family-form';
import { LifestyleForm } from '@/components/profile-edit/lifestyle-form';
import { PreferencesForm } from '@/components/profile-edit/preferences-form';
import { PhotoManager, VideoManager } from '@/components/profile-edit/photo-manager';
import { StartStep } from './start-step';
import { ConsentStep } from './consent-step';
import { QuestionsStep } from './questions-step';

const FLOW: { key: OnboardingStep; label: string }[] = [
  { key: 'start', label: 'Begin' },
  { key: 'basics', label: 'About' },
  { key: 'education', label: 'Education' },
  { key: 'career', label: 'Work' },
  { key: 'family', label: 'Family' },
  { key: 'lifestyle', label: 'Lifestyle' },
  { key: 'values', label: 'Values' },
  { key: 'dna', label: 'Relationship DNA' },
  { key: 'preferences', label: 'Partner' },
  { key: 'photos', label: 'Photos' },
  { key: 'done', label: 'Done' },
];

function headings(step: OnboardingStep, s: ReturnType<typeof subjectCopy>): { eyebrow: string; title: string; lead: string } {
  const H: Record<OnboardingStep, { title: string; lead: string }> = {
    start: { title: 'Let’s begin with who this is for.', lead: 'A few minutes now helps us introduce people who genuinely align — and you can edit everything later.' },
    basics: { title: s.self ? 'Tell us a little about yourself.' : 'Tell us a little about them.', lead: 'The essentials members see first.' },
    education: { title: 'Education', lead: 'Optional, but it helps people understand your journey.' },
    career: { title: s.self ? 'What do you do?' : 'What do they do?', lead: 'Work, ambitions and openness to relocating.' },
    family: { title: 'Family', lead: 'Share what feels right. Family details follow your privacy settings.' },
    lifestyle: { title: 'Everyday life', lead: 'Habits, routines and what lights you up.' },
    values: { title: s.self ? 'What matters to you.' : 'What matters to them.', lead: 'Values and plans for the future — the heart of a meaningful match.' },
    dna: { title: 'Relationship DNA', lead: 'Ten gentle spectrums about how you connect. Self-described — never a diagnosis.' },
    preferences: { title: s.self ? 'Who are you hoping to meet?' : 'Who are they hoping to meet?', lead: 'Flexible preferences shape ranking. Non-negotiables are respected strictly.' },
    photos: { title: 'Photos & introduction', lead: 'Profiles with clear photos receive more thoughtful interest.' },
    done: { title: 'You’re all set.', lead: '' },
  };
  const idx = FLOW.findIndex((f) => f.key === step);
  return { eyebrow: step === 'done' ? 'Complete' : `Step ${Math.max(1, idx)} of ${FLOW.length - 2}`, ...H[step] };
}

export function OnboardingWizard({ initialProfile, questions, consentsRequired, videoEnabled }: {
  initialProfile: OwnProfileResponse | null; questions: OnboardingQuestion[]; consentsRequired: ConsentType[]; videoEnabled: boolean;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [own, setOwn] = React.useState(initialProfile);
  const [createdFor, setCreatedFor] = React.useState<CreatedFor | null>(initialProfile?.createdFor ?? null);
  const [needsConsent, setNeedsConsent] = React.useState(!!initialProfile && consentsRequired.length > 0);
  const resume = (initialProfile?.onboardingStep as OnboardingStep | null) ?? (initialProfile ? 'basics' : 'start');
  const [step, setStep] = React.useState<OnboardingStep>(FLOW.some((f) => f.key === resume) ? resume : 'basics');
  const [completion, setCompletion] = React.useState<CompletionReport | null>(initialProfile?.completion ?? null);
  const [direction, setDirection] = React.useState(1);
  const subject = subjectCopy(createdFor);

  const refresh = React.useCallback(async () => {
    const p = await api<OwnProfileResponse>('/profile');
    setOwn(p);
    setCompletion(p.completion);
    return p;
  }, []);

  const go = React.useCallback(async (to: OnboardingStep, dir = 1) => {
    setDirection(dir);
    setStep(to);
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    if (to !== 'start') await api('/profile', { method: 'PATCH', body: { onboardingStep: to } }).catch(() => undefined);
    if (to === 'photos' || to === 'done') await refresh().catch(() => undefined);
  }, [reduce, refresh]);

  const idx = FLOW.findIndex((f) => f.key === step);
  const nextOf = (s: OnboardingStep) => FLOW[FLOW.findIndex((f) => f.key === s) + 1]!.key;
  const prevOf = (s: OnboardingStep) => FLOW[Math.max(1, FLOW.findIndex((f) => f.key === s) - 1)]!.key;
  const advance = (c: CompletionReport | null) => { if (c) setCompletion(c); void go(nextOf(step)); };
  const back = () => void go(prevOf(step), -1);
  const skip = () => void go(nextOf(step));
  const h = headings(step, subject);
  const form = own?.form;

  if (needsConsent) {
    return (
      <Shell eyebrow="Policy update" title="Before you continue" lead="" progress={null}>
        <ConsentStep required={consentsRequired} onDone={() => { setNeedsConsent(false); if (initialProfile?.onboardingStep === 'done') { router.replace('/app'); router.refresh(); } }} />
      </Shell>
    );
  }

  const body = (() => {
    switch (step) {
      case 'start': return <StartStep onDone={async (cf) => { setCreatedFor(cf); await refresh(); void go('basics'); }} />;
      case 'basics': return <BasicsForm key="b" initial={form?.basics ?? {}} subject={subject} submitLabel="Continue" onSaved={advance} />;
      case 'education': return <EducationForm key="e" initial={{ items: form?.education ?? [] }} subject={subject} submitLabel="Continue" onSaved={advance} onSkip={skip} />;
      case 'career': return <CareerForm key="c" initial={form?.career ?? {}} subject={subject} submitLabel="Continue" onSaved={advance} onSkip={skip} />;
      case 'family': return <FamilyForm key="f" initial={form?.family ?? {}} subject={subject} submitLabel="Continue" onSaved={advance} onSkip={skip} />;
      case 'lifestyle': return <LifestyleForm key="l" initial={form?.lifestyle ?? {}} subject={subject} submitLabel="Continue" onSaved={advance} onSkip={skip} />;
      case 'values': return <QuestionsStep key="v" questions={questions.filter((q) => q.section === 'values')} subject={subject} onDone={advance} onBack={back} />;
      case 'dna': return <QuestionsStep key="d" questions={questions.filter((q) => q.section === 'dna')} subject={subject} onDone={advance} onBack={back} />;
      case 'preferences': return <PreferencesForm key="p" initial={form?.preferences ?? {}} subject={subject} submitLabel="Continue" onSaved={advance} />;
      case 'photos': return (
        <div className="space-y-10">
          {own ? <PhotoManager photos={own.photos} maxPhotos={own.limits.maxPhotos} onChange={async () => { await refresh(); }} /> : null}
          {videoEnabled && own && (
            <section className="space-y-4"><h2 className="font-serif text-2xl">Video introduction <span className="text-base text-muted">(optional)</span></h2>
              <VideoManager video={own.video} limits={own.limits} onChange={async () => { await refresh(); }} /></section>
          )}
          <div className="flex justify-between"><Button variant="ghost" onClick={back}>Back</Button><Button size="lg" onClick={() => void go('done')}>{own?.photos.length ? 'Continue' : 'Skip for now'}</Button></div>
        </div>
      );
      case 'done': return <DoneStep completion={completion} onJump={(s) => void go(s, -1)} onFinish={() => { router.replace('/app'); router.refresh(); }} />;
    }
  })();

  return (
    <Shell eyebrow={h.eyebrow} title={h.title} lead={h.lead} progress={step === 'done' || step === 'start' ? null : (idx / (FLOW.length - 1)) * 100}
      onBack={step !== 'start' && step !== 'basics' && step !== 'done' && step !== 'values' && step !== 'dna' ? back : undefined} completion={completion?.pct}>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div key={step} custom={direction}
          initial={reduce ? false : { opacity: 0, x: 24 * direction }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: -24 * direction }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
          {body}
        </motion.div>
      </AnimatePresence>
    </Shell>
  );
}

const STEP_FOR_SECTION: Record<string, OnboardingStep> = { basics: 'basics', about: 'basics', photos: 'photos', education: 'education', career: 'career', family: 'family', lifestyle: 'lifestyle', values: 'values', dna: 'dna', preferences: 'preferences' };

function DoneStep({ completion, onJump, onFinish }: { completion: CompletionReport | null; onJump: (s: OnboardingStep) => void; onFinish: () => void }) {
  const required = completion?.missing.filter((m) => m.required) ?? [];
  const optional = completion?.missing.filter((m) => !m.required) ?? [];
  React.useEffect(() => { if (completion?.canActivate) void api('/profile', { method: 'PATCH', body: { onboardingStep: 'done' } }).catch(() => undefined); }, [completion?.canActivate]);
  return (
    <div className="space-y-8">
      {completion?.canActivate ? (
        <div className="rounded-2xl border border-success/20 bg-success-bg p-6">
          <p className="flex items-center gap-2 font-serif text-2xl text-success"><Check className="h-6 w-6" />Your profile is live</p>
          <p className="mt-2 text-sm text-ink-2">We’ll begin introducing people whose values and plans align with yours — in both directions.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-warning/20 bg-warning-bg p-6">
          <p className="flex items-center gap-2 font-serif text-2xl text-warning"><CircleAlert className="h-6 w-6" />Almost there</p>
          <p className="mt-2 text-sm text-ink-2">Complete these to become visible to members:</p>
          <ul className="mt-3 space-y-2">{required.map((m) => (
            <li key={m.section}><button className="text-sm font-medium text-emerald-700 underline underline-offset-4" onClick={() => onJump(STEP_FOR_SECTION[m.section] ?? 'basics')}>{m.label}</button></li>
          ))}</ul>
        </div>
      )}
      <div className="space-y-2"><div className="flex justify-between text-sm"><span>Profile strength</span><span className="text-muted">{completion?.pct ?? 0}%</span></div><Progress value={completion?.pct ?? 0} label="Profile strength" /></div>
      {optional.length > 0 && (
        <div className="space-y-2"><p className="text-sm text-muted">Optional, but helpful:</p>
          <div className="flex flex-wrap gap-2">{optional.map((m) => <Button key={m.section} variant="secondary" size="sm" onClick={() => onJump(STEP_FOR_SECTION[m.section] ?? 'basics')}>{m.label}</Button>)}</div></div>
      )}
      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={onFinish}>{completion?.canActivate ? 'See your matches' : 'Go to the app'}</Button>
        <Button asChild size="lg" variant="secondary"><Link href="/app/dna">View Relationship DNA</Link></Button>
      </div>
    </div>
  );
}

function Shell({ eyebrow, title, lead, progress, onBack, completion, children }: { eyebrow: string; title: string; lead: string; progress: number | null; onBack?: () => void; completion?: number; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Brand href="/" />
          {onBack ? <Button variant="ghost" size="sm" onClick={onBack}>Back</Button> : <span className="text-xs text-muted">{completion !== undefined ? `${completion}% complete` : ''}</span>}
        </div>
        {progress !== null && <Progress value={progress} className="h-1 rounded-none" label="Onboarding progress" />}
      </header>
      <main id="main" className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <p className="eyebrow mb-3">{eyebrow}</p>
        <h1 className="font-serif text-4xl leading-tight text-balance sm:text-5xl">{title}</h1>
        {lead && <p className="mt-3 max-w-xl text-[1.02rem] text-muted text-pretty">{lead}</p>}
        <div className="mt-10">{children}</div>
      </main>
    </div>
  );
}

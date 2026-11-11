'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Hourglass } from 'lucide-react';
import {
  defaultPartnerBasics, genderFromCreatedFor, quickStepFor,
  type BasicsInput, type CompletionReport, type ConsentType, type CreatedFor, type OwnProfileResponse, type QuickOnboardingStep,
} from '@2k/shared';
import { api } from '@/lib/api';
import { Brand } from '@/components/shell/brand';
import { Button, Progress } from '@/components/ui';
import { subjectCopy } from '@/components/profile-edit/form-kit';
import { PhotoManager } from '@/components/profile-edit/photo-manager';
import { ProfileChecklist } from '@/components/profile/profile-checklist';
import { StartStep } from './start-step';
import { ConsentStep } from './consent-step';
import { EssentialsStep } from './essentials-step';
import { PartnerStep } from './partner-step';
import { clearQuickStart, readQuickStartPreferences } from './quick-start-prefill';

/** Three short steps after "who is this for". Everything else is gathered after onboarding. */
const STEPS: QuickOnboardingStep[] = ['basics', 'preferences', 'photos'];

function headings(step: QuickOnboardingStep, s: ReturnType<typeof subjectCopy>): { title: string; lead: string } {
  switch (step) {
    case 'start': return { title: 'Let’s begin.', lead: 'Two minutes to get started. Everything else can wait until later.' };
    case 'basics': return { title: s.self ? 'A little about you.' : 'A little about them.', lead: 'Just the essentials. You can add more anytime.' };
    case 'preferences': return { title: s.self ? 'Who are you hoping to meet?' : 'Who are they hoping to meet?', lead: 'Start broad. You can refine this anytime.' };
    case 'photos': return { title: 'Add a photo.', lead: 'Optional, but profiles with a clear photo get far more thoughtful interest.' };
    case 'done': return { title: 'You’re in.', lead: '' };
  }
}

export function OnboardingWizard({ initialProfile, consentsRequired }: {
  initialProfile: OwnProfileResponse | null; consentsRequired: ConsentType[];
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [own, setOwn] = React.useState(initialProfile);
  const [createdFor, setCreatedFor] = React.useState<CreatedFor | null>(initialProfile?.createdFor ?? null);
  const [needsConsent, setNeedsConsent] = React.useState(!!initialProfile && consentsRequired.length > 0);
  const [step, setStep] = React.useState<QuickOnboardingStep>(quickStepFor(initialProfile?.onboardingStep, !!initialProfile));
  const [basics, setBasics] = React.useState<Partial<BasicsInput>>(initialProfile?.form.basics ?? {});
  const [completion, setCompletion] = React.useState<CompletionReport | null>(initialProfile?.completion ?? null);
  const [direction, setDirection] = React.useState(1);
  const subject = subjectCopy(createdFor);

  const refresh = React.useCallback(async () => {
    const p = await api<OwnProfileResponse>('/profile');
    setOwn(p);
    setCompletion(p.completion);
    return p;
  }, []);

  const go = React.useCallback(async (to: QuickOnboardingStep, dir = 1) => {
    setDirection(dir);
    setStep(to);
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    if (to !== 'start') await api('/profile', { method: 'PATCH', body: { onboardingStep: to } }).catch(() => undefined);
    if (to === 'photos' || to === 'done') await refresh().catch(() => undefined);
  }, [reduce, refresh]);

  // Partner basics: saved preferences first, then the landing page quick-start, then defaults from their own details.
  const [quickPrefs, setQuickPrefs] = React.useState<ReturnType<typeof readQuickStartPreferences>>(null);
  React.useEffect(() => { setQuickPrefs(readQuickStartPreferences()); }, []);
  const savedPrefs = own?.form.preferences;
  const hasSavedPrefs = !!savedPrefs && Array.isArray(savedPrefs.seekingGenders) && savedPrefs.seekingGenders.length > 0;
  const preferencesInitial = hasSavedPrefs ? savedPrefs : { ...defaultPartnerBasics(basics.gender, basics.dateOfBirth), ...(savedPrefs ?? {}), ...(quickPrefs ?? {}) };

  if (needsConsent) {
    return (
      <Shell title="Before you continue" lead="" progress={null}>
        <ConsentStep required={consentsRequired} onDone={() => { setNeedsConsent(false); if (initialProfile?.onboardingStep === 'done') { router.replace('/app'); router.refresh(); } }} />
      </Shell>
    );
  }

  const finish = () => { router.replace('/app'); router.refresh(); };
  const idx = STEPS.indexOf(step);
  const h = headings(step, subject);

  const body = (() => {
    switch (step) {
      case 'start': return <StartStep onDone={async (cf) => { setCreatedFor(cf); await refresh(); void go('basics'); }} />;
      case 'basics': return (
        <EssentialsStep key="b" initial={basics} subject={subject} suggestedGender={genderFromCreatedFor(createdFor)}
          onSaved={(c, b) => { if (c) setCompletion(c); setBasics(b); void go('preferences'); }} />
      );
      case 'preferences': return (
        <PartnerStep key={hasSavedPrefs ? 'p-saved' : quickPrefs ? 'p-quick' : `p-${basics.gender ?? ''}`} initial={preferencesInitial} subject={subject}
          onBack={() => void go('basics', -1)} onSaved={(c) => { clearQuickStart(); if (c) setCompletion(c); void go('photos'); }} />
      );
      case 'photos': return (
        <div className="space-y-10">
          {own ? <PhotoManager photos={own.photos} maxPhotos={own.limits.maxPhotos} onChange={async () => { await refresh(); }} /> : null}
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => void go('preferences', -1)}>Back</Button>
            <Button size="lg" onClick={() => void go('done')}>{own?.photos.length ? 'Finish' : 'Skip for now'}</Button>
          </div>
        </div>
      );
      case 'done': return <DoneStep completion={completion} onFinish={finish} />;
    }
  })();

  return (
    <Shell eyebrow={idx >= 0 ? `Step ${idx + 1} of ${STEPS.length}` : undefined} title={h.title} lead={h.lead}
      progress={idx >= 0 ? ((idx + 1) / STEPS.length) * 100 : null}>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div key={step} custom={direction}
          initial={reduce ? false : { opacity: 0, x: 24 * direction }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: -24 * direction }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
          {body}
        </motion.div>
      </AnimatePresence>
    </Shell>
  );
}

function DoneStep({ completion, onFinish }: { completion: CompletionReport | null; onFinish: () => void }) {
  const live = completion?.status === 'active';
  return (
    <div className="space-y-8">
      {live ? (
        <div className="rounded-2xl border border-success/20 bg-success-bg p-6">
          <p className="flex items-center gap-2 font-serif text-2xl text-success"><Check className="h-6 w-6" aria-hidden />Your profile is live</p>
          <p className="mt-2 text-sm text-ink-2">We’ll begin introducing people whose values and plans align with yours, in both directions.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gold-200 bg-gold-50 p-6">
          <p className="flex items-center gap-2 font-serif text-2xl text-ink"><Hourglass className="h-6 w-6 text-gold-600" aria-hidden />Your profile is with our team</p>
          <p className="mt-2 text-sm text-ink-2">A real person reviews every profile before it goes live, usually within 24 hours. We’ll let you know as soon as it’s approved.</p>
        </div>
      )}
      <ProfileChecklist completion={completion} title="While you wait, add a little more" />
      <Button size="lg" onClick={onFinish}>Continue to 2K Marriage</Button>
    </div>
  );
}

function Shell({ eyebrow, title, lead, progress, children }: { eyebrow?: string; title: string; lead: string; progress: number | null; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-5">
          <Brand href="/" />
          {eyebrow && <span className="text-xs font-medium text-muted">{eyebrow}</span>}
        </div>
        {progress !== null && <Progress value={progress} className="h-1 rounded-none" label="Onboarding progress" />}
      </header>
      <main id="main" className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
        <h1 className="font-serif text-4xl leading-tight text-balance sm:text-5xl">{title}</h1>
        {lead && <p className="mt-3 max-w-xl text-[1.02rem] text-muted text-pretty">{lead}</p>}
        <div className="mt-9">{children}</div>
      </main>
    </div>
  );
}

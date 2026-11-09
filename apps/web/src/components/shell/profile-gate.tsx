'use client';
import * as React from 'react';
import Link from 'next/link';
import { Hourglass, PenLine } from 'lucide-react';
import { Button } from '@/components/ui';
import { useMe } from './me-context';

/**
 * Browsing features are only for live profiles. While a new profile is with our
 * team for review (or still being completed), show a calm explanation instead.
 */
export function ActiveProfileGate({ children }: { children: React.ReactNode }) {
  const { me } = useMe();
  const status = me.profile?.status;
  if (status === 'active') return <>{children}</>;
  if (status === 'in_review') return <InReviewState />;
  const note = me.profile?.reviewNote;
  return (
    <GateCard icon={<PenLine className="h-5 w-5" aria-hidden />} title={note ? 'A few changes before you go live' : 'Let’s finish your profile first'}
      body={note ? 'Our team reviewed your profile and asked for a few changes. Once you update it, we’ll take another look.' : 'Introductions start once your profile is complete and our team has reviewed it.'}
      note={note ?? undefined}
      action={<Button asChild><Link href={note ? '/app/profile' : '/onboarding'}>{note ? 'Update my profile' : 'Continue your profile'}</Link></Button>} />
  );
}

export function InReviewState() {
  return (
    <GateCard icon={<Hourglass className="h-5 w-5" aria-hidden />} title="Your profile is with our team"
      body="Every profile on 2K Matrimony is reviewed by a real person before it goes live — usually within 24 hours. We’ll let you know the moment it’s approved. Meanwhile you can polish your profile or add photos."
      action={<div className="flex flex-wrap justify-center gap-2"><Button asChild variant="secondary"><Link href="/app/profile">Review my profile</Link></Button><Button asChild variant="ghost"><Link href="/app/verification">Get verified</Link></Button></div>} />
  );
}

function GateCard({ icon, title, body, action, note }: { icon: React.ReactNode; title: string; body: string; action: React.ReactNode; note?: string }) {
  return (
    <section className="mx-auto max-w-xl py-16 text-center" aria-labelledby="gate-title">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-100 text-gold-600">{icon}</span>
      <h1 id="gate-title" className="mt-5 font-serif text-4xl text-ink text-balance">{title}</h1>
      <p className="mt-3 text-muted text-pretty">{body}</p>
      {note && (
        <figure className="mx-auto mt-6 max-w-md rounded-xl border border-gold-200 bg-gold-50 px-5 py-4 text-left">
          <figcaption className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-gold-600">From our review team</figcaption>
          <blockquote className="mt-1 text-sm leading-relaxed text-ink-2">{note}</blockquote>
        </figure>
      )}
      <div className="mt-8">{action}</div>
    </section>
  );
}

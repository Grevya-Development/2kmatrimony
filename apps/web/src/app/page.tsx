import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, BadgeCheck, Eye, FileLock2, HeartHandshake, MessagesSquare, Scale, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui';
import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { Reveal } from '@/components/marketing/reveal';
import { CompatibilityIllustration, DnaSpectrumIllustration, RingsArt } from '@/components/marketing/art';
import { Faq } from '@/components/marketing/faq';
import { PricingTable } from '@/components/marketing/pricing-table';
import { getBrand, getCms, getPlansSafe, isSignedIn } from '@/components/marketing/data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: '2K Matrimony — More Than a Match. A Meaningful Beginning.' },
  description: 'Discover someone who aligns with your values, ambitions, lifestyle, and vision of the future. Mutual, transparent, privacy-first matchmaking.',
  openGraph: {
    title: 'More Than a Match. A Meaningful Beginning.',
    description: 'Intelligent, mutual matchmaking that helps you find a connection that truly matters.',
    type: 'website',
    siteName: '2K Matrimony',
  },
};

const STEPS = [
  { title: 'Share what matters', body: 'A short, conversational onboarding about your values, lifestyle, family and future — never a wall of forms. Skip anything, edit anytime.' },
  { title: 'See your Relationship DNA', body: 'Your preferences become a clear, editable picture. It is built only from your own answers, and you can correct anything.' },
  { title: 'Meet mutual matches', body: 'We recommend people only when you fit each other’s preferences — and explain why, including where you differ.' },
  { title: 'Connect with intention', body: 'Express interest, connect when it is mutual, and prepare for meaningful conversations with private briefings.' },
];

const INTELLIGENCE = [
  { icon: Sparkles, title: 'Relationship DNA', body: 'Ten dimensions — from communication to long-term aspirations — expressed in your own words, visualised and fully editable.' },
  { icon: Scale, title: 'Compatibility Gap Analysis', body: 'When you connect, see where you align, where you differ, and the questions worth exploring. Differences are topics, never verdicts.' },
  { icon: MessagesSquare, title: 'Before You Meet', body: 'An optional private briefing with shared interests, thoughtful conversation starters and first-meeting ideas.' },
  { icon: HeartHandshake, title: 'Marriage Readiness', body: 'Explore finances, family, careers and more privately — so the important conversations feel natural when the time comes.' },
];

const TRUST = [
  { icon: BadgeCheck, title: 'Clear verification', body: 'Badges for checks we actually performed — phone, email, photo, ID or employment. Everything else is labelled as the member’s own statement.' },
  { icon: Eye, title: 'You decide who sees what', body: 'Photos, income and family details can be visible to all members, only connections, or nobody. Profiles are never public on the web.' },
  { icon: FileLock2, title: 'Designed for India’s DPDP Act', body: 'Explicit consent, data export and account deletion in Settings, with identity documents kept in restricted storage.' },
  { icon: ShieldCheck, title: 'People, not algorithms, enforce', body: 'Automated signals flag spam and fraud, but serious decisions are always reviewed by our trust & safety team.' },
];

export default async function LandingPage() {
  const [signedIn, brand, plans, faqs, stories] = await Promise.all([isSignedIn(), getBrand(), getPlansSafe(), getCms('faq'), getCms('success_story')]);
  const cta = signedIn ? '/app' : '/login';

  return (
    <>
      <SiteHeader signedIn={signedIn} />
      <main id="main">
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 md:pt-24 lg:grid-cols-[1.15fr_1fr]">
            <Reveal>
              <p className="eyebrow mb-5">Mutual · Transparent · Private</p>
              <h1 className="font-serif text-5xl leading-[1.04] text-ink text-balance sm:text-6xl lg:text-7xl">More Than a Match. A Meaningful Beginning.</h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2 text-pretty">
                Discover someone who aligns with your values, ambitions, lifestyle, and vision of the future. Let intelligent matchmaking help you find a connection that truly matters.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button asChild size="lg"><Link href={cta}>Find Your Match <ArrowRight /></Link></Button>
                <Button asChild variant="ghost" size="lg"><Link href="#how-it-works">How it works</Link></Button>
              </div>
              <p className="mt-6 text-sm text-muted">Free to create a profile. For members 18 and older.</p>
            </Reveal>
            <Reveal delay={0.15} className="relative flex justify-center">
              <RingsArt className="absolute -top-6 left-1/2 w-[130%] max-w-none -translate-x-1/2 opacity-80" />
              <div className="relative pt-10"><CompatibilityIllustration /></div>
            </Reveal>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="scroll-mt-20 border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <Reveal className="max-w-2xl">
              <p className="eyebrow mb-3">How it works</p>
              <h2 className="font-serif text-4xl leading-tight sm:text-5xl text-balance">Thoughtful by design, simple to use</h2>
            </Reveal>
            <ol className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <Reveal as="li" key={s.title} delay={i * 0.08} className="relative">
                  <span className="font-serif text-5xl text-gold-400">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="mt-3 font-serif text-2xl">{s.title}</h3>
                  <p className="mt-2 text-[0.97rem] leading-relaxed text-ink-2">{s.body}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* AI MATCHMAKING */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <p className="eyebrow mb-3">AI matchmaking</p>
            <h2 className="font-serif text-4xl leading-tight sm:text-5xl text-balance">Compatibility, measured in both directions</h2>
            <p className="mt-5 text-lg leading-relaxed text-ink-2">
              Most platforms ask whether someone suits you. We also ask whether you suit them. A match is recommended only when the fit is mutual — across values, emotional expectations, communication, family, lifestyle, career, location and future goals.
            </p>
            <ul className="mt-8 space-y-4 text-[0.98rem] text-ink-2">
              <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />Every recommendation explains its reasoning — alignments, differences and what is still unknown.</li>
              <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />Your non-negotiables are respected; everything else stays flexible.</li>
              <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />Describe who you are looking for in your own words — the AI matchmaker turns it into filters you can review.</li>
              <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />Never a promise of outcomes, never a personality diagnosis — just honest alignment.</li>
            </ul>
          </Reveal>
          <Reveal delay={0.1} className="rounded-3xl border border-line bg-surface p-8 shadow-soft">
            <p className="eyebrow mb-6">Relationship DNA</p>
            <DnaSpectrumIllustration />
          </Reveal>
        </section>

        {/* RELATIONSHIP INTELLIGENCE */}
        <section id="intelligence" className="scroll-mt-20 bg-ink text-canvas">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <Reveal className="max-w-2xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-gold-400">Relationship intelligence</p>
              <h2 className="font-serif text-4xl leading-tight sm:text-5xl text-balance">Help for the conversations that matter</h2>
              <p className="mt-5 text-lg text-canvas/75">Optional tools that support — never replace — getting to know each other. Private by default, shared only when you choose.</p>
            </Reveal>
            <div className="mt-14 grid gap-px overflow-hidden rounded-3xl bg-canvas/10 sm:grid-cols-2">
              {INTELLIGENCE.map((f, i) => (
                <Reveal key={f.title} delay={i * 0.06} className="bg-ink p-8">
                  <f.icon className="h-6 w-6 text-gold-400" aria-hidden />
                  <h3 className="mt-5 font-serif text-2xl">{f.title}</h3>
                  <p className="mt-2 leading-relaxed text-canvas/70">{f.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* TRUST */}
        <section id="trust" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
          <Reveal className="max-w-2xl">
            <p className="eyebrow mb-3">Trust & verification</p>
            <h2 className="font-serif text-4xl leading-tight sm:text-5xl text-balance">Privacy and safety you can see</h2>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {TRUST.map((t, i) => (
              <Reveal key={t.title} delay={i * 0.06} className="flex gap-5 rounded-3xl border border-line bg-surface p-7">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-600"><t.icon className="h-5 w-5" aria-hidden /></div>
                <div>
                  <h3 className="font-serif text-2xl">{t.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-2">{t.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-8 flex items-center gap-3 rounded-2xl bg-surface-2 px-6 py-4 text-sm text-ink-2">
            <Users className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            Parents and family can help — with permissions you set — while you stay in control of interests, connections and conversations.
          </Reveal>
        </section>

        {/* SUCCESS STORIES — only real, consented, published stories */}
        {stories.length > 0 && (
          <section className="border-y border-line bg-surface">
            <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
              <Reveal className="max-w-2xl">
                <p className="eyebrow mb-3">Stories</p>
                <h2 className="font-serif text-4xl leading-tight sm:text-5xl">Meaningful beginnings</h2>
              </Reveal>
              <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {stories.map((s, i) => (
                  <Reveal key={s.id} delay={i * 0.06} as="div">
                    <figure className="h-full rounded-3xl border border-line bg-canvas p-7">
                      <blockquote className="font-serif text-xl leading-snug text-ink">“{s.body}”</blockquote>
                      <figcaption className="mt-5 text-sm text-muted">{s.title}</figcaption>
                    </figure>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* PRICING */}
        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            <p className="eyebrow mb-3">Pricing</p>
            <h2 className="font-serif text-4xl leading-tight sm:text-5xl">Begin free. Upgrade when it helps.</h2>
            <p className="mt-4 text-ink-2">All prices include GST. Cancel any time — your profile and connections stay yours.</p>
          </Reveal>
          <PricingTable plans={plans} ctaHref={cta} />
        </section>

        {/* FAQ */}
        {faqs.length > 0 && (
          <section id="faq" className="mx-auto max-w-4xl scroll-mt-20 px-4 pb-24 sm:px-6">
            <Reveal className="mb-10 text-center">
              <p className="eyebrow mb-3">Questions</p>
              <h2 className="font-serif text-4xl sm:text-5xl">Frequently asked</h2>
            </Reveal>
            <Faq items={faqs} />
          </section>
        )}

        {/* FINAL CTA */}
        <section className="px-4 pb-24 sm:px-6">
          <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-emerald-700 px-8 py-16 text-center text-white sm:px-16">
            <RingsArt className="pointer-events-none absolute -right-24 -top-16 w-[28rem] opacity-25" />
            <h2 className="relative font-serif text-4xl leading-tight sm:text-5xl text-balance">Don’t just find profiles. Discover someone you can build a meaningful life with.</h2>
            <div className="relative mt-9 flex justify-center">
              <Button asChild size="lg" variant="gold"><Link href={cta}>Find Your Match <ArrowRight /></Link></Button>
            </div>
          </Reveal>
        </section>
      </main>
      <SiteFooter brand={brand} />
    </>
  );
}

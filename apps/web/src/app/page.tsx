import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Check } from 'lucide-react';
import '@/components/marketing/marketing.css';
import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { Reveal } from '@/components/marketing/reveal';
import { Faq } from '@/components/marketing/faq';
import { QuickStartForm } from '@/components/marketing/quick-start';
import { BROWSE_CITIES, BROWSE_TONGUES, discoverHref } from '@/components/marketing/links';
import { getBrand, getCms, isSignedIn } from '@/components/marketing/data';
import heroImg from '../../public/images/hero-floral-arch.webp';
import ritualImg from '../../public/images/ritual-hands-fire.webp';
import petalsImg from '../../public/images/petal-shower.webp';
import gardenImg from '../../public/images/couple-garden.webp';
import mehendiImg from '../../public/images/mehendi-hand.webp';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: '2K Marriage — Free, hand-picked matrimony introductions' },
  description: 'Free to join. Every profile is reviewed by our team before it goes live, and every introduction is hand-picked by a matchmaker who writes you a note about why.',
  openGraph: {
    title: '2K Marriage — Hand-picked matches. A meaningful beginning.',
    description: 'Free matrimony with real people behind every introduction.',
    type: 'website',
    siteName: '2K Marriage',
  },
};

const PAGE_FAQ = [
  { id: 'free', title: 'Is it really free?', body: 'Yes. Creating a profile, receiving introductions, sending interests and messaging your connections are all free. There are no paid plans and we will not ask for card or UPI details.' },
  { id: 'handpicked', title: 'Who chooses my introductions?', body: 'A matchmaker on our team. They read your profile and partner preferences, look at people who would also be open to someone like you, and write a short note with each introduction explaining why. Our matching tools help them shortlist; a person makes the final choice.' },
  { id: 'review', title: 'Why does my profile need to be reviewed?', body: 'So everyone you see is genuine. Before a profile goes live we check the photos and details for obvious problems. This usually takes less than 24 hours, and you can keep editing your profile while you wait.' },
];

const STEPS = [
  {
    n: '01',
    title: 'Create your profile',
    body: 'Tell us about yourself, your family and the life you hope to build. It takes about ten minutes, and parents or siblings can create a profile on someone’s behalf.',
  },
  {
    n: '02',
    title: 'Our team reviews it',
    body: 'A real person checks your photos and details before your profile is shown to anyone, usually within a day. You can add ID, photo or employment verification for a badge.',
  },
  {
    n: '03',
    title: 'Receive hand-picked introductions',
    body: 'Your matchmaker suggests a few people at a time, each with a note on why they thought of you. Show interest when you like someone; you can talk once you both agree.',
  },
];

const COMMITMENTS = [
  'Every profile is looked at by a person before it goes live.',
  'Introductions come with a note from your matchmaker, not just a percentage.',
  'We suggest people who would be open to someone like you, not only people you might like.',
  'Nobody can message you until you have both said yes.',
];

export default async function LandingPage() {
  const [brand, faqs, stories, signedIn] = await Promise.all([getBrand(), getCms('faq'), getCms('success_story'), isSignedIn()]);
  const allFaqs = [...PAGE_FAQ, ...faqs.map((f) => ({ id: f.id, title: f.title, body: f.body }))];
  const startHref = signedIn ? '/app' : '/login?next=%2Fonboarding';

  return (
    <>
      <SiteHeader signedIn={signedIn} />
      <main id="main" className="overflow-x-clip">
        {/* HERO ------------------------------------------------------------ */}
        <section aria-labelledby="hero-title" className="relative">
          <div className="relative min-h-[34rem] lg:min-h-[44rem]">
            <Image
              src={heroImg}
              alt="A bride and groom in traditional wedding clothes walking hand in hand beneath an arch of flowers"
              priority
              placeholder="blur"
              sizes="100vw"
              className="absolute inset-0 h-full w-full object-cover object-[50%_65%]"
            />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-emerald-800/85 via-emerald-800/50 to-transparent lg:via-emerald-800/35" />
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-emerald-800/60 to-transparent lg:hidden" />
            <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-16 sm:px-6 lg:grid-cols-[1fr_24rem] lg:items-center lg:gap-16 lg:px-8 lg:py-24">
              <div className="max-w-xl text-white motion-safe:animate-[heroIn_0.9s_cubic-bezier(0.22,1,0.36,1)_both]">
                <p className="text-sm font-semibold tracking-[0.08em] text-gold-200">Free matrimony · Personally curated</p>
                <h1 id="hero-title" className="mt-4 font-serif text-[2.75rem] leading-[1.02] text-white sm:text-6xl lg:text-[4.4rem]">
                  Hand-picked matches. A meaningful beginning.
                </h1>
                <p className="mt-6 max-w-md text-lg leading-relaxed text-white/90">
                  Every profile is reviewed by our team, and every introduction is chosen by a matchmaker who tells you why.
                </p>
                <p className="mt-8 hidden text-sm text-white/80 lg:block">
                  Already a member? <Link href="/login" className="font-semibold text-white underline underline-offset-4">Sign in</Link>
                </p>
              </div>
              <QuickStartForm signedIn={signedIn} className="motion-safe:animate-[heroIn_0.9s_0.15s_cubic-bezier(0.22,1,0.36,1)_both]" />
            </div>
          </div>
          {/* Trust band */}
          <div className="border-b border-line bg-surface">
            <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-3 px-4 py-5 text-sm text-ink-2 sm:px-6 md:grid-cols-5 lg:px-8">
              {['Free to join and use', 'Every profile screened by our team', 'Hand-picked introductions', 'Verified badges you can trust', 'Your privacy, your rules'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-gold-500" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* HOW IT WORKS ---------------------------------------------------- */}
        <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20 bg-canvas">
          <div className="mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20 lg:px-8 lg:py-28">
            <Reveal className="relative order-2 lg:order-1">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem]">
                <Image src={ritualImg} alt="A couple’s hands joined beside the sacred fire during a wedding ritual" placeholder="blur" sizes="(min-width: 1024px) 40vw, 100vw" className="h-full w-full object-cover" />
              </div>
              <div className="absolute -bottom-6 -right-2 hidden w-60 rounded-xl bg-white p-4 text-sm shadow-lift ring-1 ring-black/5 sm:block lg:-right-10">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gold-600">A note from your matchmaker</p>
                <p className="mt-2 font-serif text-lg leading-snug text-ink">“You both want to settle near family in Chennai and love long weekend drives.”</p>
                <p className="mt-2 text-xs text-muted">Example of how introductions are explained</p>
              </div>
            </Reveal>
            <div className="order-1 lg:order-2">
              <p className="eyebrow">How it works</p>
              <h2 id="how-title" className="mt-3 font-serif text-4xl leading-tight text-ink sm:text-5xl">Three steps, with people looking out for you</h2>
              <ol className="mt-10 space-y-9">
                {STEPS.map((s, i) => (
                  <Reveal as="li" key={s.n} delay={i * 0.08} className="grid grid-cols-[3.25rem_1fr] gap-4">
                    <span className="font-serif text-3xl leading-none text-gold-600">{s.n}</span>
                    <div className="border-t border-line pt-4">
                      <h3 className="font-serif text-2xl text-ink">{s.title}</h3>
                      <p className="mt-2 max-w-lg leading-relaxed text-ink-2">{s.body}</p>
                    </div>
                  </Reveal>
                ))}
              </ol>
              <Link href={startHref} className="group mt-10 inline-flex items-center gap-2 font-semibold text-emerald-600 hover:text-emerald-700">
                Create your free profile <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        {/* WHY CURATED ----------------------------------------------------- */}
        <section id="curated" aria-labelledby="curated-title" className="scroll-mt-20 bg-emerald-700 text-white">
          <div className="mx-auto grid max-w-7xl lg:grid-cols-2">
            <div className="relative min-h-[22rem] lg:min-h-full">
              <Image src={petalsImg} alt="Family members showering a newly married couple with flower petals" placeholder="blur" sizes="(min-width: 1024px) 50vw, 100vw" className="absolute inset-0 h-full w-full object-cover object-top" />
            </div>
            <div className="px-4 py-16 sm:px-10 lg:px-16 lg:py-28">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-400">Why curated</p>
              <h2 id="curated-title" className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">Fewer profiles. Better introductions.</h2>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-emerald-100">
                Scrolling through hundreds of strangers is tiring, and it is not how most families have found a good match. We would rather show you a handful of people chosen with thought.
              </p>
              <ul className="mt-10 space-y-5">
                {COMMITMENTS.map((c, i) => (
                  <Reveal as="li" key={c} delay={i * 0.06} className="flex gap-4 border-t border-white/15 pt-5">
                    <span className="mt-1 h-2 w-2 shrink-0 rotate-45 bg-gold-400" aria-hidden />
                    <span className="text-[1.02rem] leading-relaxed text-white/95">{c}</span>
                  </Reveal>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* FOR FAMILIES ---------------------------------------------------- */}
        <section id="families" aria-labelledby="families-title" className="scroll-mt-20 bg-canvas">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-end">
              <div>
                <p className="eyebrow">For families</p>
                <h2 id="families-title" className="mt-3 font-serif text-4xl leading-tight text-ink sm:text-5xl">Built for the way Indian families look for a match</h2>
              </div>
              <p className="max-w-xl text-lg leading-relaxed text-ink-2 lg:pb-2">
                Parents, siblings and close relatives often help, and that is welcome here. The person getting married always decides who to talk to.
              </p>
            </div>
            <div className="mt-14 grid gap-10 lg:grid-cols-[1.25fr_1fr]">
              <Reveal className="relative aspect-[16/10] overflow-hidden rounded-[1.75rem] lg:aspect-auto lg:min-h-[28rem]">
                <Image src={gardenImg} alt="A newly married couple in a silk saree and sherwani standing together in a garden" placeholder="blur" sizes="(min-width: 1024px) 55vw, 100vw" className="h-full w-full object-cover" />
              </Reveal>
              <div className="divide-y divide-line border-y border-line">
                {[
                  { t: 'Create a profile for your son or daughter', b: 'Choose “for my daughter” or “for my son” when you register. The wording changes throughout, and they can take over the account whenever they like.' },
                  { t: 'Invite family to help', b: 'Share access with a parent or sibling, choosing exactly what they can do: view suggestions, shortlist, suggest someone, or help plan a meeting.' },
                  { t: 'Decisions stay with the person getting married', b: 'Family can suggest and discuss. Only the member can send interest, accept or start a conversation.' },
                ].map((r, i) => (
                  <Reveal key={r.t} delay={i * 0.06} className="py-6">
                    <h3 className="font-serif text-2xl text-ink">{r.t}</h3>
                    <p className="mt-2 leading-relaxed text-ink-2">{r.b}</p>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SAFETY --------------------------------------------------------- */}
        <section id="safety" aria-labelledby="safety-title" className="scroll-mt-20 border-y border-line bg-surface">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:gap-20 lg:px-8 lg:py-24">
            <div>
              <p className="eyebrow">Safety and privacy</p>
              <h2 id="safety-title" className="mt-3 font-serif text-4xl leading-tight text-ink sm:text-5xl">You decide who sees what</h2>
              <div className="relative mt-10 hidden aspect-[3/2] overflow-hidden rounded-2xl lg:block">
                <Image src={mehendiImg} alt="A bride’s hand decorated with mehendi and rings" placeholder="blur" sizes="30vw" className="h-full w-full object-cover" />
              </div>
            </div>
            <dl className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
              {[
                { t: 'Photos on your terms', b: 'Show photos to all members, only to people you connect with, or keep them blurred until you accept an interest.' },
                { t: 'Contact details stay private', b: 'Your phone number and email are never shown on your profile. Talk inside 2K Marriage until you are ready to share more.' },
                { t: 'Badges mean something', b: 'A verified badge is only added after we check that specific detail, such as ID, photo or employment. Everything else is labelled as the member’s own words.' },
                { t: 'Block or report in one tap', b: 'Blocking hides you from each other everywhere. Reports are read by a person on our team, and serious action is always a human decision.' },
                { t: 'Your data, your choice', b: 'Download a copy of your data or delete your account from Settings at any time. We follow India’s Digital Personal Data Protection Act.' },
                { t: 'Gentle with AI', b: 'Our matchmakers use smart tools to shortlist. They never read your private messages and never write to anyone on your behalf.' },
              ].map((r) => (
                <div key={r.t} className="border-t-2 border-gold-200 pt-4">
                  <dt className="font-serif text-xl text-ink">{r.t}</dt>
                  <dd className="mt-2 text-[0.97rem] leading-relaxed text-ink-2">{r.b}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* SUCCESS STORIES (only real, consented CMS stories) -------------- */}
        {stories.length > 0 && (
          <section aria-labelledby="stories-title" className="bg-canvas">
            <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
              <p className="eyebrow">Shared with permission</p>
              <h2 id="stories-title" className="mt-3 font-serif text-4xl text-ink sm:text-5xl">Couples who met here</h2>
              <div className="mt-10 grid gap-10 md:grid-cols-2">
                {stories.map((s) => (
                  <figure key={s.id} className="border-t border-line pt-6">
                    <blockquote className="font-serif text-2xl leading-snug text-ink">“{s.body}”</blockquote>
                    <figcaption className="mt-4 text-sm text-muted">{s.title}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* BROWSE ---------------------------------------------------------- */}
        <section aria-labelledby="browse-title" className="bg-canvas">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <h2 id="browse-title" className="font-serif text-3xl text-ink sm:text-4xl">Looking within your community?</h2>
            <p className="mt-3 max-w-2xl text-ink-2">Browse members by mother tongue or city once you have a profile. Your matchmaker will keep these preferences in mind too.</p>
            <div className="mt-10 grid gap-10 md:grid-cols-2">
              <nav aria-label="Browse by mother tongue">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-600">By mother tongue</h3>
                <ul className="mt-4 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
                  {BROWSE_TONGUES.map((t) => (
                    <li key={t}><Link className="block border-b border-line py-3 text-ink-2 transition-colors hover:border-emerald-500 hover:text-emerald-700" href={discoverHref({ motherTongues: [t] }, signedIn)}>{t} matrimony</Link></li>
                  ))}
                </ul>
              </nav>
              <nav aria-label="Browse by city">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-600">By city</h3>
                <ul className="mt-4 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
                  {BROWSE_CITIES.map((c) => (
                    <li key={c}><Link className="block border-b border-line py-3 text-ink-2 transition-colors hover:border-emerald-500 hover:text-emerald-700" href={discoverHref({ cities: [c] }, signedIn)}>{c}</Link></li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
        </section>

        {/* FAQ ------------------------------------------------------------- */}
        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 border-t border-line bg-surface">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_2fr] lg:gap-16 lg:px-8 lg:py-24">
            <div>
              <p className="eyebrow">Questions</p>
              <h2 id="faq-title" className="mt-3 font-serif text-4xl leading-tight text-ink">Before you register</h2>
              <p className="mt-4 text-ink-2">
                Something else on your mind? Write to <a className="text-emerald-600 underline underline-offset-4" href={`mailto:${brand.support_email}`}>{brand.support_email}</a>.
              </p>
            </div>
            <Faq items={allFaqs} />
          </div>
        </section>

        {/* FINAL CTA ------------------------------------------------------- */}
        <section aria-labelledby="cta-title" className="bg-canvas">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="relative overflow-hidden rounded-[2rem] bg-emerald-600 px-6 py-16 text-center sm:px-12">
              <div aria-hidden className="mx-auto mb-8 flex items-center justify-center gap-3 text-gold-400">
                <span className="h-px w-12 bg-gold-400/70" /><span className="h-2 w-2 rotate-45 bg-gold-400" /><span className="h-px w-12 bg-gold-400/70" />
              </div>
              <div className="relative mx-auto max-w-2xl">
                <h2 id="cta-title" className="font-serif text-4xl leading-tight text-white sm:text-5xl">Your family’s search can start today</h2>
                <p className="mt-4 text-lg text-emerald-100">Create a free profile in about ten minutes. We will take it from there, together with you.</p>
                <Link href={startHref} className="group mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 font-semibold text-emerald-700 transition-colors hover:bg-gold-50">
                  {signedIn ? 'Go to my matches' : 'Find Your Match'}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter brand={brand} signedIn={signedIn} />
    </>
  );
}

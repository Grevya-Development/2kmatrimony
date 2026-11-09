# BUILD STATUS — 2K Marriage

_Last updated: 2026-11-10. All 12 milestones are implemented. Everything listed as ✅ has passed automated tests on a database rebuilt from scratch._

Legend: ✅ done & tested · ⚙️ built, needs credentials or provider setup · 🟡 partial · ⛔ not done

## Verification summary (latest run)
| Check | Result |
|---|---|
| Migrations from scratch (`supabase db reset`, 21 files) | ✅ all apply; `db lint` clean (1 informational warning: unused variable in `billing_activate_payment`) |
| TypeScript (shared, matching, web, mobile) | ✅ 0 errors |
| Unit tests | ✅ 121 passed (shared 12 · matching 17 · web 67 · mobile 25) |
| API integration tests (route handlers against local Supabase) | ✅ 179 passed (26 files; 1 opt-in perf test skipped by default) |
| E2E in Chrome against a production build (Playwright) | ✅ 10 passed: full journey + every member/admin page renders without errors |
| Production build (Next.js 16) | ✅ |
| Mobile bundles (`expo export` iOS + Android), `expo-doctor` | ✅ (last run by the mobile workstream) |
| Performance (2,000 profiles, local) | ✅ p95: search 59 ms · recommendations 80 ms · profile view 24 ms |
| Independent security audit | ✅ no IDOR found; every high, medium and fixable low finding fixed with tests (see Security) |

Commands: `npm test` · `npm run test:integration -w @2k/web` · `npm run build && npm run test:e2e -w @2k/web` · `PERF=1 npx vitest run --config vitest.integration.config.ts tests/perf` (after seeding `tests/perf/seed.sql`).

## Brand
✅ **2K Marriage — "Tradition Meets AI"** (Brand DNA, Emerald Edition) applied across web and mobile:
supplied logo artwork (horizontal, stacked, reverse, rings mark), favicon / apple icon / PWA manifest,
Expo app icon + adaptive icon + splash, Royal Emerald / Marigold Gold / Ivory palette, Newsreader +
Montserrat typography, branded emails and invoices. Source kit: `2K_Marriage_Brand_DNA_Emerald/`.
Verified: web + mobile typecheck, production build, 10/10 E2E, iOS/Android bundles.

## Free, curated, hand-picked (2026-11-10)
✅ **Live on 2kmarriage.com.**
- **Free:** every member gets every feature. Paid plans are hidden and the `payments` flag is off; billing code is kept dormant. `/pricing` redirects to `/` with a 308.
- **Human screening:** completed profiles go to `in_review` and appear in Admin → Screening. Reviewers approve or request changes, and members are notified either way. Target: 24 hours (setting `curation`).
- **Hand-picked introductions:** in Admin → Introductions (permission `matchmaker.curate`), a matchmaker picks a candidate and writes a personal note. Members see these first under "Hand-picked for you".
- **Website redesign:** structure and tone inspired by Shaadi.com and Tamil Matrimony.
  - Photography-led, using 6 Unsplash photos credited in `public/images/CREDITS.md`.
  - A quick-start card ("I'm looking for…") that pre-fills onboarding preferences.
  - Honest trust band, how curation works, families, safety, browse by mother tongue and city, FAQ.
  - No fabricated numbers, testimonials or pricing.
- **Support contact:** `2kmatrimonysupport@gmail.com`.
- **Verified:**
  - 187 integration and 11 E2E tests pass; all unit tests and typechecks pass.
  - Hosted migrations applied and checked.
  - Live: the quick-start flow, sign-in → onboarding, and the `/pricing` redirect.

## Production deployment (Vercel)
✅ **Live: https://2kmarriage.com** (also https://2k-matrimony.vercel.app; `www.2kmarriage.com` redirects to the apex with a 308 once its DNS record exists)
- Team "Grevya's projects" (Hobby), project `2k-matrimony`, root directory `apps/web`, Node 24.
- Functions run in `icn1` (Seoul), the same region as Supabase.
- Connected to GitHub: every push to `main` deploys to production.
- Env vars set for production and preview; the service role key and cron secret are stored as secrets.
- Daily cron at 21:00 UTC. Hobby allows daily crons only, so the daily run also abandons stale checkouts.
- **Verified live:**
  - Pages and APIs return 200; health reports the database OK.
  - Sign in → onboarding → profile created, through the real UI on the live URL (temporary user deleted).
  - `/me` works with the session cookie; 0 page errors; 0 runtime errors or 5xx in logs.
- ✅ **Domain & email (2026-11-10):**
  - **Domain:** `2kmarriage.com` (DNS at GoDaddy) is verified on Vercel and serves the app. `NEXT_PUBLIC_APP_URL=https://2kmarriage.com` in production.
  - **Resend:** `updates.2kmarriage.com` is verified (DKIM + SPF). App notifications send from `2K Marriage <hello@updates.2kmarriage.com>`; `RESEND_API_KEY` is a Vercel secret.
  - **Supabase Auth email:** routed through Resend SMTP (`smtp.resend.com:465`), with the limit raised from 2 to 100 emails per hour. Verified: a Supabase password-reset email was delivered through Resend.
  - **Safety:** the email provider never sends to reserved test domains (`.test`, `.example`, `.invalid`, `localhost`).
- ✅ **Supabase Auth URLs set** (2026-11-10, applied as a minimal `supabase config push` from a pulled copy of the hosted config; re-diff shows 0 differences).
  - Site URL: `https://2kmarriage.com`.
  - Redirect allow-list: `2kmarriage.com`, `www.2kmarriage.com`, `2k-matrimony.vercel.app`, and `twokmatrimony://auth/callback`.
  - Minimum password length raised to 8, matching the app.
- ✅ **Login fixed (2026-11-10).** Sign-in was failing because the page offered methods the project hasn't set up.
  - **Root causes:** Mobile showed but there is no SMS provider ("Unsupported phone provider"). Google and Apple buttons showed but those providers are off ("provider is not enabled"). Emails had no code and the code length was 8.
  - **Fix:** web and mobile now read the project's enabled methods from Supabase and show only those. Today that is email, either a 6-digit code or a password. Google, Apple or Mobile appear automatically once they are switched on.
  - **New members:** `POST /api/v1/auth/email-start` creates the account first, so everyone gets the same sign-in email with a code.
  - **Branded auth emails:** all six Supabase templates (`supabase/templates/`) use the logo, the code and the support address. They send as `2K Marriage <hello@updates.2kmarriage.com>` with "2K Marriage" subjects and a 6-digit code.
  - **Verified live:** a new member on 2kmarriage.com received the branded code email, entered it and landed in onboarding. The sign-up confirmation and sign-in emails were also checked through Resend. Test users were deleted.
- **Pending (owner actions):**
  - **Google sign-in:** create a Web OAuth client in Google Cloud Console. Set the authorised redirect URI to `https://ohhxeljnssgfkugbeixx.supabase.co/auth/v1/callback` and provide the Client ID and Secret.
  - **Apple sign-in:** Apple Developer Services ID, Key ID, Team ID and the .p8 key.
  - **www:** add CNAME `www` → `cname.vercel-dns.com` at GoDaddy (the apex `2kmarriage.com` is already live on Vercel).
  - **Phone login:** an SMS provider.
  - **Plan:** upgrade to Vercel Pro before commercial launch (Hobby is non-commercial; Pro also restores the hourly cron and longer log retention).

## Hosted Supabase (production project)
✅ **Project `ohhxeljnssgfkugbeixx` (Seoul) linked; all 20 migrations pushed.**
- **Verified on hosted:** 79 tables, all with row-level security; no client write grants; 5 private buckets; realtime publication; full default configuration; signup trigger; pgvector 0.8.2.
- **Hosted E2E** (`npm run test:e2e:hosted`): **8/8 passed**.
  - Health and config; public pages.
  - Two members signing up and onboarding through the real UI.
  - Storage upload and signed read.
  - Recommendations, search, explanation, interest → accept.
  - Messages over hosted Realtime with RLS checks (outsider gets nothing; private channel authorised).
  - Admin API and panel.
  - The test deletes its users; the hosted project was left with 0 users.
- **Network note:** from the development Mac, new TLS connections to Supabase took 1–10 s (packet loss or throttling on that network), so hosted UI runs are slow from there. Deploy the web tier in the database's region.
- **Before production:**
  - In Auth settings: SMS provider and Google/Apple credentials. Site URL, redirects, SMTP and email templates are done.
  - Regenerate the service-role key, since it was shared in chat, and update the env var.
  - Run the `create-super-admin` script once.

## Product analytics (PostHog)
✅ Integrated on web, server and mobile; **consent-gated** (DPDP opt-in `product_analytics`, revocable in Settings).
- **No SDK traffic before opt-in.** Verified in Chrome: 0 requests before a decision and after "No thanks". After "Allow", `$opt_in` and `$pageview` flow through the first-party `/ingest` proxy, with profile IDs scrubbed from URLs.
- **What's tracked:** 17 server events (signup, activation, search, interests, connections, messages, insights, checkout, subscription…). They are always written to the first-party `analytics_events` table, and forwarded to PostHog only for members who opted in.
- **What's never sent:** autocapture, session replay, PII, profile text and message content.
- **Tests:** `tests/integration/analytics.test.ts` (3) and shared sanitizer tests (3).
- **Wizard:** the `@posthog/wizard` CLI needs an interactive PostHog login, so this integration was done manually. Add the project key (`phc_…`) to enable it.

## Milestones
| # | Milestone | Status | Notes / evidence |
|---|---|---|---|
| 1 | Architecture, design system, repository | ✅ | `docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`, design tokens + Radix components |
| 2 | Database, backend, authentication | ✅ ⚙️ | 60+ tables, RLS on every table, private storage, realtime; phone OTP / email OTP & magic link / password / Google / Apple / TOTP MFA. Google, Apple and production SMS need provider setup |
| 3 | Onboarding & profiles | ✅ | Conversational 9-step wizard with resume, consents (opt-in), all sections, photos/video, verification submission, settings, export, deletion |
| 4 | Discovery & search | ✅ ⚙️ | Daily curated recommendations, Browse filters (plan-gated), sorting, natural-language smart search; semantic ranking needs `VOYAGE_API_KEY` (falls back to full-text search) |
| 5 | Relationship DNA & matchmaking | ✅ | Two-way engine, non-negotiables, confidence, admin-configurable weights, explanations; DNA visualisation + AI suggestions that the member confirms |
| 6 | Compatibility analysis & Before You Meet | ✅ ⚙️ | Gap Analysis, Before You Meet, Vision Board themes. AI versions need `ANTHROPIC_API_KEY`; rule-based versions work without it |
| 7 | Interests, connections & messaging | ✅ | Full interest lifecycle, connections, realtime chat (two-way verified in E2E), read receipts, typing, presence, images, block/report |
| 8 | Admin & Super Admin | ✅ | 67 admin API routes, 18 admin pages, MFA-gated, audited; RBAC editor, plans/pricing, flags, analytics + CSV |
| 9 | Payments & subscriptions | ✅ ⚙️ | Razorpay checkout, verify (captured-only), webhook, GST invoices (CGST/SGST/IGST), coupons, refunds. Needs Razorpay keys and seller GST details |
| 10 | Android & iOS apps | ✅ 🟡 | Native Expo app covering the core features; typechecks, bundles, unit-tested. Not yet built with EAS or tested on devices |
| 11 | Security, testing, optimisation | ✅ | Audit + fixes, perf fix for large ID lists, E2E suite |
| 12 | Deployment readiness | ✅ ⚙️ | `docs/DEPLOYMENT.md`, `docs/INTEGRATIONS.md`, `vercel.json` crons; production accounts/credentials required |

## Feature checklist (spec sections)
| Spec | Status |
|---|---|
| §4 Auth & onboarding (who it's for, progressive, skippable, editable) | ✅ |
| §5 Relationship DNA (self-described, editable, member corrects AI suggestions) | ✅ |
| §6 Matching engine + mutual compatibility + explanations | ✅ |
| §7 AI personal matchmaker (clarify → filters → results → refine; 6 reply languages; voice input behind flag) | ✅ ⚙️ (rule-based mode without an AI key replies in English only) |
| §8 Smart search (reviewable, editable filters; plan-gated) | ✅ ⚙️ |
| §9 Gap Analysis · §10 Before You Meet · §11 Readiness · §12 Vision Board · §13 Compatibility journal | ✅ ⚙️ |
| §14 Discovery (curated + traditional; view/shortlist/interest/pass/report/block) | ✅ |
| §15 Video introductions (15–60 s, moderation queue, visibility) | ✅ |
| §16 Family collaboration (permissions; owner stays in control; invite bound to the invited contact) | ✅ |
| §17 Verification (phone/email automatic; ID/photo/employment/education reviewed by admins; badges revoked on identity edits) | ✅ (manual review; third-party KYC providers not integrated) |
| §18 Interests & connections lifecycle | ✅ |
| §19 Messaging (text, images, receipts, typing, unread, presence, push, block/report) | ✅ (audio/video calls are a later phase per the spec) |
| §20 Trust & safety (duplicate/spam/mass-interest signals, reports, human review, rate limits) | ✅ |
| §21–22 Admin & Super Admin (all listed sections) | ✅ |
| §23 Subscriptions & monetisation | ✅ ⚙️ (one-off plan purchases; Razorpay auto-renew not built) |
| §24 Notifications (in-app, email, SMS, push, WhatsApp; member preferences) | ✅ in-app · ⚙️ email/SMS/push/WhatsApp providers |
| §25 Mobile apps (camera, uploads, push, deep links, secure storage, biometrics, sharing, offline cache) | ✅ code · 🟡 device QA |
| §26 Database · §27 Security & privacy (DPDP: consent, export, deletion, retention) | ✅ |
| §28 Analytics (filters, charts, date ranges, CSV) | ✅ |
| §29 Landing page (exact hero, sections; success stories only from consented CMS entries) | ✅ |
| §30 QA (unit, integration, API, E2E, mobile, security, payment, AI, perf) | ✅ (AI tests use a mocked model; no live-model evaluation yet) |

## Security
Audit (read-only, every finding traced in code) found **no IDOR or raw-row leaks**. Fixed with tests:
- **H1:** match explanations could reveal hidden religion or income → viewer-relative masking in the engine, scoring, search and explanations.
- **H2:** a regular admin could disable admin MFA → security flags are super-admin-only, and super admins always require MFA.
- **M1/M2:** admin privilege escalation and lock-out paths → grant checks, no self-edits, last-super-admin guard, no suspension bypass.
- **M3:** open redirect after login → shared `safeNextPath`.
- **M4:** verification badges survived identity/photo edits → revoked automatically and the member is asked to re-verify.
- **M5:** search filters could probe hidden fields → the SQL only filters on fields visible to all members.
- **L1–L3, L5–L8:** active profile required for browsing; blocks separate the pair in API, RLS and realtime; block lookup RPC revoked; prompt-injection-safe escaping; family invites bound to the invited contact; only captured payments activate a plan; CSP; minimal public health endpoint.

Integration fixes found by E2E and performance runs: realtime subscribing before auth was ready (messages silently hidden), account deletion failing for members with conversations, a server/client boundary crash on `/pricing`, `URI too long` at scale, landing content hidden before JavaScript loaded, and AI consent pre-ticked (now opt-in).

**Residual / accepted risks**
- L4: a conversation's other participant's internal user id is visible to the client via RLS reads (an opaque UUID; low risk).
- A member's own religion/income *preferences* still shape mutual results, so a determined user could probe someone's preference by editing their own attributes. Inherent to mutual matching; needs a product decision.
- `match_scores` stores the masked view of whichever viewer computed it last, so admin score analytics are approximate.
- Rate limiter fails open if Postgres is unavailable.

## Unconfigured integrations (code complete; credentials needed)
| Service | Env / setup | Behaviour when missing |
|---|---|---|
| Anthropic (AI) | `ANTHROPIC_API_KEY` | Rule-based explanations, insights, smart search and matchmaker; readiness chat and DNA suggestions return "unavailable" |
| Voyage (embeddings) | `VOYAGE_API_KEY` | Full-text search only; soft preferences don't affect ranking |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`; seller legal name, GSTIN, state and address in the `gst` platform setting | Checkout returns `service_unconfigured` |
| Email (Resend) | `RESEND_API_KEY`, `EMAIL_FROM` on a verified domain | Deliveries recorded as `skipped_unconfigured` |
| SMS (MSG91) | `MSG91_AUTH_KEY`, `MSG91_SENDER_ID`, DLT template ids on SMS templates | Skipped |
| WhatsApp (Meta) | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, approved templates, flag on | Skipped |
| Push (Expo) | EAS project id (`eas init`); `EXPO_ACCESS_TOKEN` optional | Mobile skips token registration |
| Auth providers | Supabase dashboard: SMS provider/hook, Google, Apple; enable email confirmations in production | Only local test phone numbers work |
| PostHog (product analytics) | Web `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST`; mobile `EXPO_PUBLIC_POSTHOG_KEY` / `EXPO_PUBLIC_POSTHOG_HOST` | No banner, no SDK, zero PostHog traffic; first-party `analytics_events` still recorded |
| Cron | `CRON_SECRET` | Cron endpoints return 401 |

## Not done / pending
- ⛔ EAS native builds, store submission, on-device QA; real domains for deep links (`app.example.com` placeholders).
- ⛔ App Store / Play Store payment policy decision (mobile opens web checkout).
- ⛔ UI translations: the interface is English only. AI replies support 6 languages; other languages are configured but disabled.
- ⛔ Third-party identity verification providers (DigiLocker/IDfy); manual admin review works.
- ⛔ Razorpay auto-renewing subscriptions; web push for browsers; retrying failed notifications; audio/video calls (spec: later phase).
- 🟡 Mobile matchmaker reply arrives all at once (React Native fetch doesn't stream).
- 🟡 Live-model AI evaluation set (prompts tested with a mocked model only; run with a real key before launch).
- 🟡 Legal pages are drafts marked "review with counsel before launch".
- 🟡 Analytics "searches tracked" stays empty until search events are written to `analytics_events`.

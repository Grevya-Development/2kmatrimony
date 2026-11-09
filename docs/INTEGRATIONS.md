# Third-party integrations

Every integration is optional except Supabase. When an integration is not configured the app keeps working and reports it as unconfigured (`GET /api/v1/health` → `integrations`, and Super Admin → System).

| Integration | Purpose | Env vars | When unconfigured | How to test |
|---|---|---|---|---|
| **Supabase** | DB, Auth, Storage, Realtime | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | App cannot run | `npx supabase start`; `npm run test:integration -w @2k/web` |
| **Anthropic (Claude)** | Matchmaker chat, smart search, explanations, briefings, readiness, DNA interpretation | `ANTHROPIC_API_KEY` | AI features return engine/rule-based output or `503 service_unconfigured` (chat) | Set key; use AI features; check Admin → AI operations |
| **Voyage AI** | Embeddings for semantic search | `VOYAGE_API_KEY` | Search uses Postgres full-text only | Set key; daily cron fills missing embeddings |
| **Razorpay** | Payments, refunds, webhooks | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Checkout returns `503 service_unconfigured`; billing page shows "payments not available"; webhook returns 503 | Test keys + Razorpay test cards/UPI; `tests/integration/billing.test.ts` (mocked SDK) |
| **Resend** | Transactional email | `RESEND_API_KEY`, `EMAIL_FROM` | Email deliveries recorded as `skipped_unconfigured` | `tests/integration/notifications-providers.test.ts`; send a test via Admin → Notifications |
| **MSG91** | SMS notifications (DLT) | `MSG91_AUTH_KEY`, `MSG91_SENDER_ID` + `provider_template_id` per SMS template | `skipped_unconfigured`; templates without an id → `failed` with reason | Provider tests; MSG91 dashboard reports |
| **Meta WhatsApp Cloud API** | WhatsApp notifications | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, flag `whatsapp_notifications`, member consent `whatsapp` | `skipped_unconfigured` | Provider tests; Meta test number |
| **Expo Push** | Mobile push | `EXPO_ACCESS_TOKEN` (optional) | Works without token; members without tokens → `failed: no_push_tokens` | Register a device from the app; Expo push tool |
| **PostHog** | Product analytics (web, mobile, server events) — consent-gated | Web: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`; mobile: `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`; flag `product_analytics` | No banner, no SDK traffic; first-party `analytics_events` still recorded for admin dashboards | `tests/integration/analytics.test.ts` (mocked SDK); set key, allow analytics in the banner, watch PostHog Live events |
| **Google / Apple sign-in** | OAuth | Configured in Supabase Auth (see DEPLOYMENT.md) | Buttons show "not configured yet" | Sign in from web and mobile |
| **SMS OTP (Auth)** | Phone login | Supabase Auth phone provider / Send SMS hook | Local: test numbers `+91 90000 00001–3`, code `123456` | Sign in with a test number locally |

## Notification delivery flow
`notify()` (server/notify/index.ts) creates the in-app notification, then for each channel with a template it checks the member's preferences (defaults per category) and whether the provider is configured, sends, and records a row in `notification_deliveries` (`sent`, `failed`, `skipped_preference`, `skipped_unconfigured`). Template bodies use `{{variable}}` placeholders and are edited in Admin → Notifications.

## Payments flow
1. `POST /api/v1/billing/checkout` → payment row (`created`) + Razorpay order.
2. Razorpay Checkout (web: checkout.js; mobile: opens the web billing page).
3. `POST /api/v1/billing/verify` (signature + server-side payment fetch) **or** the `payment.captured` webhook → `billing_activate_payment()` (atomic, idempotent): subscription, coupon redemption, GST invoice.
4. Refunds: admin approves → `processRefund()` → Razorpay refund → `refund.processed` webhook reconciles.

## Product analytics (PostHog)
Privacy design (DPDP): analytics is **non-essential** and runs only after an explicit, revocable
opt-in recorded as consent type `product_analytics` (Settings → Consents, web banner, mobile prompt).
- **Web** (`apps/web/src/lib/analytics.ts`): `posthog-js` starts opted out; no autocapture, no session
  recording, no surveys; `person_profiles: identified_only`; DNT respected; events go through the
  first-party proxy `/ingest` (Next rewrites → PostHog region), so the CSP stays `'self'`. Every URL
  property is scrubbed (UUIDs → `:id`, emails/phones removed) in `before_send`.
- **Server** (`apps/web/src/server/analytics/track.ts`): business events (`ANALYTICS_EVENTS` in
  `packages/shared/src/analytics.ts`) are written to `analytics_events` (first-party, sanitized) and
  forwarded to PostHog only if configured + flag on + member consented. Runs after the response.
- **Mobile** (`apps/mobile/src/lib/analytics.ts`): `posthog-react-native`, `defaultOptIn: false`, no
  touch autocapture, no session replay, scrubbed screen names, one-time native consent prompt.
- **Identity**: distinct id = internal user id (pseudonymous). Never name, email, phone, profile text,
  religion/community, income, message content or search text (`sanitizeAnalyticsProps` drops them).
- **Kill switch**: feature flag `product_analytics` (Admin → Configuration).
- **Region**: set `*_POSTHOG_HOST` to `https://eu.i.posthog.com` for the EU cloud if preferred.

**Configured project:** US Cloud, project ID `723053` — dashboard https://us.posthog.com/project/723053.
The project API key (`phc_…`) is public by design (it ships in the browser bundle); it lives in
`apps/web/.env.local` / `apps/mobile/.env` locally (gitignored) and must be added to Vercel (web) and
EAS secrets (mobile) for deployed builds. Dead clicks, heatmaps, rage clicks, web vitals, exception
capture, surveys, experiments and replay are disabled in code, so enabling them in PostHog project
settings has no effect until the code is changed deliberately.

Setup: create a PostHog project → copy the project API key (`phc_…`) into the env vars above for web
(Vercel) and mobile (EAS secrets) → deploy. The `npx @posthog/wizard` CLI is not required (it needs an
interactive login); this integration was implemented manually to respect the consent model above.

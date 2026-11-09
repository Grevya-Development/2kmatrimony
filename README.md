# 2K Marriage

AI-assisted, privacy-first matrimony platform: mutual compatibility matching, transparent
explanations, relationship intelligence (Relationship DNA, Gap Analysis, Before You Meet,
Readiness, Vision Board), family collaboration, verification, real-time messaging,
subscriptions with GST invoices, and full Admin / Super Admin consoles — on web, iOS and Android.

> “Don’t just help people find profiles. Help them discover people with whom they can build a meaningful life.”

## Repository
| Path | What |
|---|---|
| `apps/web` | Next.js 16 — landing, member web app, admin, **and the REST API** (`/api/v1`) |
| `apps/mobile` | Expo SDK 58 (React Native) app for iOS & Android |
| `packages/shared` | Constants, Zod request schemas, API response types, DB types |
| `packages/matching` | Deterministic mutual-compatibility engine + explanations |
| `supabase` | Postgres schema, RLS, storage, realtime, auth config (migrations) |
| `docs` | Architecture, database, API, AI, deployment, integrations, mobile |
| `BUILD_STATUS.md` | What is done, tested, unconfigured and pending |

## Quick start (local)
Prerequisites: Node 22+, Docker (OrbStack/Docker Desktop).
```bash
npm install
npx supabase start                 # local stack on ports 56321–56324
npx supabase status -o env         # copy ANON_KEY / SERVICE_ROLE_KEY
cp apps/web/.env.example apps/web/.env.local   # fill Supabase values + CRON_SECRET
npm run dev                        # http://localhost:3000
```
Sign in locally with the test phone numbers in `supabase/config.toml` (`9000000001`–`9000000003`, OTP `123456`)
or with email (magic links/OTP appear in Mailpit at http://127.0.0.1:56324).

Create the first super admin (after signing up once):
```bash
node --experimental-strip-types scripts/create-super-admin.ts --email you@example.com --name "Your Name"
```

Mobile: `cd apps/mobile && cp .env.example .env && npx expo start` (see `docs/MOBILE.md`).

## Tests
```bash
npm test                                         # unit tests (shared, matching, web, mobile)
npm run test:integration -w @2k/web              # API integration tests against local Supabase
npm run build && npm run test:e2e -w @2k/web     # Playwright E2E (uses local Google Chrome)
```

## Optional integrations
AI (Anthropic), embeddings (Voyage), payments (Razorpay), email (Resend), SMS (MSG91),
WhatsApp, push (Expo). Every one is optional locally and reported as unconfigured — see
`docs/INTEGRATIONS.md`. Production setup: `docs/DEPLOYMENT.md`.

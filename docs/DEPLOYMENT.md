# Deployment

> **Current hosted project:** Supabase `ohhxeljnssgfkugbeixx` (region **ap-northeast-2, Seoul**), linked with
> `npx supabase link --project-ref ohhxeljnssgfkugbeixx`; all migrations pushed with `npx supabase db push --remote`.
> Credentials live only in `apps/web/.env.hosted.local` (gitignored). Build/run/test against it locally with
> `npm run build:hosted`, `npm run start:hosted` (port 3300) and `npm run test:e2e:hosted` (creates and deletes its own users).
> Deploy the web app **in the same region as the database** (e.g. Vercel `icn1` for Seoul) — every API request makes
> several database round-trips. For lowest latency to Indian members, consider a Mumbai (`ap-south-1`) project instead.

 guide

Production topology: **Supabase** (Postgres + Auth + Storage + Realtime, India region) · **Next.js web/API** on Vercel (or any Node 22+ host) · **Expo/EAS** for iOS and Android.

---

## 1. Supabase project

1. Create a project in **ap-south-1 (Mumbai)** to keep personal data in India (DPDP Act). Choose the Pro plan or higher (MFA, PITR, daily backups).
2. Link and push the schema from the repo root:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push            # applies supabase/migrations/* (schema, RLS, buckets, config, search functions)
   ```
   Migrations include default configuration (roles, permissions, plans, onboarding questions, flags, templates). No sample users are created.
3. **Auth → Providers**
   - **Phone**: enable; configure Twilio *or* use the **Send SMS hook** to deliver OTPs via MSG91 (DLT-registered OTP template required in India). Do **not** copy the local `[auth.sms.test_otp]` numbers.
   - **Email**: enable; set **confirm email = ON**; configure custom SMTP (Resend SMTP works) and brand the templates (magic link, OTP, recovery).
   - **Google**: OAuth client (Web) with redirect `https://<project-ref>.supabase.co/auth/v1/callback`.
   - **Apple**: Services ID + key; same callback; also enable "Sign in with Apple" capability in the iOS app.
   - **URL configuration**: Site URL `https://<your-domain>`; additional redirect URLs: `https://<your-domain>/auth/callback`, `twokmatrimony://auth/callback`, `exp+2k-matrimony://auth/callback` (dev builds).
   - **MFA**: enable TOTP (admins are forced to AAL2 while the `require_admin_mfa` flag is on).
   - Password policy: minimum 8, letters + digits. Enable leaked-password protection.
4. **Storage**: buckets (`profile-photos`, `profile-videos`, `verification-docs`, `chat-media`, `data-exports`) are created by migration as **private**. Leave them private.
5. **Realtime**: the migration adds `messages`, `notifications`, `interests`, `conversations`, `conversation_participants` to the `supabase_realtime` publication and creates private-channel policies. In Realtime settings, enable **"Allow private channels only"** if available.
6. Copy the project URL, anon key and service-role key for the web environment.
7. First Super Admin: sign up through the app, then run `npm run create-super-admin -w @2k/web -- <email>` (see `docs/ADMIN.md`) or insert into `admin_users` from the SQL editor. Enrol TOTP on first admin login.

## 2. Web + API (Vercel)

1. Import the repository; **Root Directory = `apps/web`**; framework Next.js; install command `npm install` (workspace root is detected).
2. Environment variables (Production and Preview) — see `apps/web/.env.example`:

   | Variable | Required | Notes |
   |---|---|---|
   | `NEXT_PUBLIC_APP_URL` | yes | `https://<your-domain>` |
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | from Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | yes | server only — never expose |
   | `CRON_SECRET` | yes | ≥ 32 random chars; Vercel sends it as `Authorization: Bearer` |
   | `ANTHROPIC_API_KEY` | optional | AI features fall back to engine output when unset |
   | `VOYAGE_API_KEY` | optional | semantic search; falls back to full-text |
   | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | optional | payments disabled when unset |
   | `RESEND_API_KEY`, `EMAIL_FROM` | optional | transactional email |
   | `MSG91_AUTH_KEY`, `MSG91_SENDER_ID` | optional | SMS notifications |
   | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` | optional | WhatsApp notifications |
   | `EXPO_ACCESS_TOKEN` | optional | Expo push "enhanced security" |
3. **Crons** are declared in `apps/web/vercel.json`:
   - `/api/cron/daily` at `0 21 * * *` (02:30 IST): subscription expiry + renewal reminders, interest expiry, scheduled account deletions, daily recommendations, retention (exports 7 days, verification docs 90 days after decision, AI/analytics logs 13 months), counter cleanup, missing embeddings.
   - `/api/cron/hourly` at `15 * * * *`: prompt subscription expiry, abandon unpaid checkouts > 24 h.
   - On other hosts, call them with `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/daily`. Responses are JSON summaries (HTTP 207 when any job failed).
4. Custom domain + HTTPS. Security headers (HSTS, frame-deny, nosniff) are set in `next.config.ts`.
5. Smoke test: `GET /api/v1/health` → `{ status: "ok", database: "ok", integrations: {...} }`.

## 3. Razorpay

1. Complete KYC; obtain live **Key ID / Key Secret** (Settings → API Keys).
2. Webhook (Settings → Webhooks): URL `https://<domain>/api/v1/webhooks/razorpay`, secret = `RAZORPAY_WEBHOOK_SECRET`, events: `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`.
3. In Super Admin → Configuration → `gst`: set `seller_legal_name`, `seller_gstin`, `seller_state` (state code, e.g. `KA`), `seller_address`. Invoices print these values.
4. Test with Razorpay test keys first: purchase a plan, confirm the subscription activates, the invoice renders, and the webhook delivery shows 200.

## 4. Messaging providers

- **Resend**: verify your sending domain (SPF/DKIM), set `EMAIL_FROM="2K Marriage <no-reply@your-domain>"`.
- **MSG91**: register sender ID and **DLT templates** for each SMS template; put the MSG91 flow/template id into `notification_templates.provider_template_id` (Admin → Notifications). Templates without an id are reported as failed deliveries.
- **WhatsApp Cloud API**: create approved templates (one body variable `{{1}}`), store the template name in `provider_template_id`, then enable the `whatsapp_notifications` flag. Messages are only sent to members who granted WhatsApp consent.
- **Expo push**: works without credentials; set `EXPO_ACCESS_TOKEN` if you enable enhanced security. Configure FCM (Android) and APNs (iOS) credentials in EAS.

## 5. Mobile (Expo / EAS)

1. `npm i -g eas-cli && eas login`, then in `apps/mobile`: `eas init` (sets the project id).
2. Create `apps/mobile/eas.json`:
   ```json
   {
     "cli": { "appVersionSource": "remote" },
     "build": {
       "development": { "developmentClient": true, "distribution": "internal" },
       "preview": { "distribution": "internal", "env": { "EXPO_PUBLIC_API_URL": "https://staging.<domain>" } },
       "production": { "autoIncrement": true, "env": { "EXPO_PUBLIC_API_URL": "https://<domain>" } }
     },
     "submit": { "production": { "ios": { "ascAppId": "<id>" }, "android": { "track": "internal" } } }
   }
   ```
3. Set production `extra.apiUrl`, `extra.supabaseUrl`, `extra.supabaseAnonKey` (or `EXPO_PUBLIC_*` env) and the Android App Links host in `app.json`.
4. `eas build -p ios --profile production`, `eas build -p android --profile production`, then `eas submit`.
5. Store listings: privacy nutrition labels / Data safety form must match `docs/` privacy policy (contact info, photos, user content, identifiers; no data sold).

## 6. Backups, monitoring, logging

- Enable **PITR** (point-in-time recovery) on Supabase; daily backups are automatic on Pro. Test a restore into a staging project quarterly.
- Storage objects are not covered by DB backups — enable bucket replication or periodic export if required.
- Logs: Vercel function logs (API, crons), Supabase logs (Postgres, Auth, Storage, Realtime). Send both to a central sink (Vercel Log Drains → Datadog/Better Stack; Supabase log drains).
- Uptime: monitor `GET /api/v1/health` every minute; alert on non-200 or `degraded`.
- Admin → AI operations shows AI cost/latency/errors; Admin → Payments shows failed payments and webhook errors (`payment_webhook_events.error`).

## 7. Security checklist (before launch)

- [ ] Service-role key only in server env; never in mobile or `NEXT_PUBLIC_*`.
- [ ] `npx supabase db lint` clean; review RLS: clients have **SELECT-only** on own rows; all writes via API.
- [ ] Storage buckets private; no public URLs.
- [ ] Admin MFA flag on; every admin has TOTP enrolled; least-privilege roles assigned.
- [ ] Rate limits reviewed (`platform_settings.safety`); Supabase Auth rate limits configured.
- [ ] Razorpay webhook secret set; signature verification confirmed (tests in `tests/integration/billing.test.ts`).
- [ ] OWASP: input validation (Zod on every route), output encoding (React), CSP for invoice HTML, no secrets in logs, dependency audit (`npm audit`).
- [ ] Remove local test OTP numbers; email confirmations ON.

## 8. DPDP Act checklist

- [ ] Privacy notice and terms finalised by counsel (the in-app drafts are marked "Draft").
- [ ] Consent captured at onboarding (terms, privacy, AI processing) and withdrawable in Settings; marketing/WhatsApp consents separate.
- [ ] Data principal rights: export (Settings → Download my data), correction (profile editing), deletion (14-day grace, then executed by the daily cron), grievance contact published.
- [ ] Appoint a **Grievance Officer**; publish name and contact in the privacy policy; respond within statutory timelines.
- [ ] Retention jobs enabled (daily cron) and documented in `docs/DATABASE.md`.
- [ ] Processor agreements (DPAs) with Supabase, Anthropic, Voyage, Razorpay, Resend, MSG91, Meta, Expo.
- [ ] Breach response runbook: detect → contain → assess → notify the Data Protection Board and affected members without delay → post-mortem. Audit logs (`audit_logs`) support investigation.
- [ ] Verification documents restricted to roles with `sensitive_data.read`; access audited.

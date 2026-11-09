# API reference — index

Base path `/api/v1`. JSON envelope: `{ "data": … , "nextCursor"?: string|null }` on success,
`{ "error": { "code", "message", "details"? } }` on failure.

**Auth:** `Authorization: Bearer <Supabase access token>` (mobile/API clients) or the Supabase
session cookie (web). Mobile also sends `x-client-platform: ios|android`.
**Errors:** `unauthorized` 401 · `forbidden` 403 (incl. admin MFA required) · `not_found` 404 ·
`conflict` 409 · `profile_incomplete` 409 · `entitlement_required` 402 · `validation_failed` 422 ·
`rate_limited` 429 · `feature_disabled` 403 · `service_unconfigured` 503 · `internal_error` 500.
**Types:** request schemas `packages/shared/src/schemas.ts`; responses `packages/shared/src/api.ts`.

| Area | Document |
|---|---|
| Session, health, config | below |
| Profile, onboarding, DNA, media, verification, settings, privacy (export/deletion), devices | [api/profile-onboarding-settings.md](api/profile-onboarding-settings.md) |
| Recommendations, search, profile view, shortlist/pass/block/report, interests, connections, messaging, notifications | [api/discovery-interests-messaging.md](api/discovery-interests-messaging.md) |
| AI explanation, smart search, matchmaker, connection insights, vision board, journal, meetings, readiness, family | [api/ai-and-connections.md](api/ai-and-connections.md) |
| Plans, checkout, verify, history, invoices, Razorpay webhook, cron | [api/billing.md](api/billing.md) |
| Support tickets (member) | [api/support.md](api/support.md) |
| Admin & super admin (`/api/v1/admin/*`) | [api/admin.md](api/admin.md) |

## Session & config
| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/me` | required (allowed when suspended) | `MeResponse` — user, profile summary, plan + entitlements, admin role, family links, unread count, consents required, feature flags |
| GET | `/health` | none | `{ status, database, dbLatencyMs, integrations }` |
| GET | `/config` | none | public platform settings + languages |

## Scheduled jobs
`GET|POST /api/cron/daily` and `/api/cron/hourly` with `Authorization: Bearer $CRON_SECRET`
(schedules in `apps/web/vercel.json`). See [api/billing.md](api/billing.md#cron).

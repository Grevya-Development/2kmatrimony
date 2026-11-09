# 2K Matrimony — Architecture

## Overview

```
apps/web        Next.js 16 (App Router) — landing, member web app, admin + super admin,
                AND the REST API (/api/v1/*) used by web and mobile.
apps/mobile     Expo (React Native) app for iOS + Android. Talks to /api/v1 with a
                Supabase access token; uses Supabase directly only for auth + realtime.
packages/shared Single source of truth: allowed values (constants.ts), request
                validation (schemas.ts, Zod), response contracts (api.ts), DB types.
packages/matching  Pure, deterministic mutual-compatibility engine + explanations.
supabase/       Postgres schema (migrations), RLS, storage buckets, realtime, config.
```

**Infrastructure: Supabase** — Postgres 17 + pgvector (DB), Supabase Auth (phone OTP,
email OTP/magic link/password, Google, Apple, TOTP MFA), Storage (private buckets,
signed URLs), Realtime (messages, notifications, typing/presence channels).

### Deviations from the original stack proposal (and why)
| Proposed | Chosen | Reason |
|---|---|---|
| NestJS service | Next.js route handlers as a modular monolith (`apps/web/src/server/*`) | Supabase already provides auth, realtime and storage; a second server adds deploy/ops cost without new capability. Domain modules keep boundaries clean and could be lifted into a service later. |
| Prisma | Supabase SQL migrations + generated types | RLS policies, triggers, pgvector and SQL functions are first-class in SQL; generated types give end-to-end type safety. |
| Redis | Postgres (rate-limit counters, usage counters, caches) | Fewer moving parts at launch; swap in Redis/Upstash behind `server/rate-limit.ts` if load requires. |
| WebSockets server | Supabase Realtime | Managed, RLS-aware, works identically on web and mobile. |

## Security model (read before writing any API)
- **All writes go through the API** using the service-role client `db()` from
  `@/lib/supabase/admin`. Clients have **no** INSERT/UPDATE/DELETE grants.
- **RLS** allows clients to SELECT only their own rows (for realtime and quick reads).
- **Other members' data** is only ever returned via the privacy projection
  `server/profiles/projection.ts` (`buildViewerContext` → `toCards` / `toDetail`).
  Never return raw profile rows of another member.
- **Storage** buckets are private. Uploads: `createUpload()` → signed upload URL →
  client PUT → confirm endpoint calls `assertUploaded()`. Reads: `signedUrls()`.
- **Blocks** hide both sides everywhere (search SQL, projection `canView`, interests, messaging).
- **Admin** endpoints use `route({ admin: 'permission.key' }, …)`; MFA (AAL2) is
  enforced when the `require_admin_mfa` flag is on. Every admin mutation calls `audit()`.
- **AI** never reads private messages without explicit consent, never sends messages as a
  user, never infers sensitive traits. Prompts go through `server/ai/prompts.ts`
  (safety preamble is always prepended). Member text is wrapped with `untrusted()`.

## API conventions
- Location: `apps/web/src/app/api/v1/<resource>/route.ts`.
- Wrap every handler with `route(options, handler)` from `@/server/http`:
  auth (Bearer token or cookie), profile requirement, admin permission, rate limit,
  consistent errors. Return plain data (wrapped as `{ data }`) or `ok(data, { nextCursor })`.
- Validate bodies with `parseJson(req, schema)` and queries with `parseQuery(req, schema)`
  using schemas from `@2k/shared` (add new schemas there, not inline).
- Errors: throw `errors.*` from `@/server/http` (unauthorized, forbidden, notFound,
  conflict, validation, rateLimited, entitlement, featureDisabled, unconfigured, profileIncomplete).
- Feature flags: `requireFlag('key')` / `isEnabled('key')` from `@/server/config`.
- Plans: `getPlanState(userId)`, `consumeDailyQuota(...)`, `requireEntitlement(...)` from `@/server/entitlements`.
- After any profile edit call `refreshProfileDerived(profileId)` (completion %, search text,
  auto-activation) and, best-effort, `refreshProfileEmbedding(profileId)`.
- Notifications: `notify({ userId, category, templateKey, vars, data })` from `@/server/notify`.
- Audit: `audit(auth, { action, entityType, entityId, before, after })` from `@/server/audit`.

## Shared server modules
| Module | Purpose |
|---|---|
| `server/http.ts` | `route`, `ok`, `errors`, `parseJson`, `parseQuery`, `cursor` |
| `server/auth.ts` | `getAuthContext(req)`, `getServerAuth()` for server components |
| `server/me.ts` | `buildMe(auth)` → `MeResponse`, `touchActivity` |
| `server/config.ts` | feature flags + platform settings (cached) |
| `server/entitlements.ts` | plan state, daily quotas |
| `server/media.ts` | signed upload/read URLs, upload verification |
| `server/profiles/load.ts` | `loadBundles(ids)` full profile bundles (batched) |
| `server/profiles/projection.ts` | privacy projection to `ProfileCard`/`ProfileDetail` |
| `server/profiles/match-profile.ts` | bundle → engine `MatchProfile` |
| `server/profiles/completion.ts` | completion %, search text, activation |
| `server/matching/service.ts` | config, pair scoring, explanations, recommendations |
| `server/search/service.ts` | filtered + semantic search with compatibility ranking |
| `server/ai/client.ts` | `runStructured` (Zod structured output), `streamChat`, usage logging, cost |
| `server/ai/prompts.ts` | prompt registry (`registerPrompt`) + DB overrides + safety preamble |
| `server/ai/embeddings.ts` | Voyage embeddings (optional) |
| `server/notify/*` | notification fan-out + channel providers |
| `server/audit.ts` | append-only audit log |

## Database
See `docs/DATABASE.md`. Migrations live in `supabase/migrations`. After adding one:
`npx supabase migration up --local && npm run db:types`.

## Testing
- Unit: `vitest` in each package (`npm test`).
- API integration: `apps/web/tests/integration/*.test.ts` — call route handlers directly
  against local Supabase (`npm run test:integration -w @2k/web`). Helpers: `createTestUser`,
  `makeAdmin`, `request`, `call`, `cleanupTestUsers`.
- E2E: Playwright (`apps/web/tests/e2e`).

## Design system
Tokens in `apps/web/src/app/globals.css` (`@theme`): canvas `#faf7f2`, surface, ink
(charcoal), burgundy accent, champagne highlights, Cormorant Garamond display + Inter UI.
Components in `apps/web/src/components/ui` (Radix-based, accessible). Mobile mirrors the
tokens in `apps/mobile/src/theme`.

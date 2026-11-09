# BUILD STATUS — 2K Matrimony

_Last updated: 2026-11-09 (Milestone 1–2 foundation complete; Milestones 3–10 in progress in parallel workstreams)._

Legend: ✅ done & tested · 🟡 in progress · ⛔ blocked · ⚙️ built, needs credentials (unconfigured)

## Environment
| Item | Status |
|---|---|
| Monorepo (npm workspaces): `apps/web`, `apps/mobile`, `packages/shared`, `packages/matching` | ✅ |
| Local Supabase (Postgres 17, Auth, Storage, Realtime) on ports 563xx | ✅ running |
| Migrations 0001–0009 apply cleanly; `supabase db lint` clean | ✅ |
| Next.js 16 production build | ✅ (foundation) |
| Expo SDK 58 app skeleton, single React 19.3.0 across workspace | ✅ |

## Milestone 1 — Architecture, design system, repository
| Deliverable | Status | Evidence |
|---|---|---|
| Architecture doc + stack deviations | ✅ | `docs/ARCHITECTURE.md` |
| API contract & ownership map | ✅ | `docs/API_CONTRACT.md` |
| Database doc (relationships, ownership, retention) | ✅ | `docs/DATABASE.md` |
| Design tokens (ivory/charcoal/burgundy/champagne, Cormorant + Inter) | ✅ | `apps/web/src/app/globals.css` |
| Accessible UI components (Radix) | ✅ | `apps/web/src/components/ui/*` |
| Member + admin shells, navigation | ✅ | `components/shell/*` |

## Milestone 2 — Database, backend, authentication
| Deliverable | Status | Evidence |
|---|---|---|
| Normalised schema: 60+ tables, constraints, indexes, FKs | ✅ | `supabase/migrations/*` |
| RLS on every table; client write privileges revoked | ✅ | integration test `RLS: a member cannot read another member's account row` |
| Private storage buckets; realtime publication + private channel policies | ✅ | migration 0006 |
| Default configuration (roles/permissions, plans, entitlements, flags, AI routing, templates, FAQs, question bank) | ✅ | migrations 0007–0008 |
| Search + candidate SQL functions | ✅ | migration 0009, smoke-tested |
| API framework: auth (Bearer/cookie), validation, errors, rate limit, admin+MFA gate, audit | ✅ | `apps/web/src/server/*` |
| Auth UI: phone OTP, email OTP/magic link, password + recovery, Google, Apple | ✅ built · ⚙️ Google/Apple/SMS need provider credentials in prod | `/login`, `/auth/*` |
| Admin MFA (TOTP, AAL2) gate | ✅ | `components/admin/mfa-gate.tsx` |
| `/api/v1/me`, `/health`, `/config` | ✅ | 6/6 integration tests |
| Matching engine (mutual, non-negotiables, confidence, configurable weights, explanations) | ✅ | 14/14 unit tests |
| Shared contracts (constants, Zod schemas, API types) | ✅ | 9/9 unit tests |
| AI orchestration core (structured outputs, streaming, refusal fallback, usage/cost logging, prompt registry) | ✅ built · ⚙️ needs `ANTHROPIC_API_KEY` | `server/ai/client.ts` |
| Embeddings (Voyage) with full-text fallback | ✅ built · ⚙️ needs `VOYAGE_API_KEY` | `server/ai/embeddings.ts` |

## Milestones 3–10 — feature workstreams
| Milestone | Workstream | Status |
|---|---|---|
| 3 Onboarding & profiles, DNA, media, verification (member), settings & privacy ops | A | 🟡 |
| 4 Discovery & search, 7 interests/connections/messaging, notifications center | B | 🟡 |
| 5–6 AI matchmaker, smart search, explanations, gap analysis, Before You Meet, readiness, vision board, journal, family mode | C | 🟡 |
| 8 Admin & Super Admin, support | D | 🟡 |
| 9 Payments & subscriptions (Razorpay, GST), notification providers, landing, cron, deployment docs | E | 🟡 |
| 10 Android & iOS app (Expo) | F | 🟡 |
| 11 Security, testing, optimisation | coordinator | pending |
| 12 Deployment readiness | coordinator + E | pending |

## Unconfigured integrations (code paths built; need credentials)
| Service | Env vars | Behaviour when unset |
|---|---|---|
| Anthropic (AI) | `ANTHROPIC_API_KEY` | AI features fall back to engine/rule output or return `service_unconfigured` |
| Voyage (embeddings) | `VOYAGE_API_KEY` | search uses Postgres full-text only |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | checkout returns `service_unconfigured` |
| SMS OTP (auth) | Supabase dashboard SMS provider / hook | only local test numbers work |
| Google / Apple sign-in | Supabase dashboard provider config | buttons show "not configured" |

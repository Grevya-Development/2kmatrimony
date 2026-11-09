# API Contract (v1) — endpoint map and ownership

All endpoints: `apps/web/src/app/api/v1/...`, JSON, `{ data }` / `{ error: { code, message, details } }`.
Auth: `Authorization: Bearer <supabase access token>` (mobile) or Supabase session cookie (web).
Mobile also sends `x-client-platform: ios|android`.
Types: request schemas in `packages/shared/src/schemas.ts`, responses in `packages/shared/src/api.ts`.

Legend — owner workstream: **F** foundation (done), **A** onboarding/profile/settings,
**B** discovery/interests/messaging/notifications, **C** AI/connection intelligence/family,
**D** admin/support, **E** billing/notifications providers/landing/cron.

## Session & config (F)
| Method | Path | Notes |
|---|---|---|
| GET | `/me` | `MeResponse` |
| GET | `/health` | public |
| GET | `/config` | public settings + languages |

## Profile & onboarding (A)
| Method | Path | Body / Response |
|---|---|---|
| POST | `/profile` | `startProfileSchema` → creates draft profile + consent records |
| GET | `/profile` | own full profile: `{ detail: ProfileDetail, raw sections, completion: CompletionReport }` |
| PUT | `/profile/basics` `/profile/education` `/profile/career` `/profile/family` `/profile/lifestyle` `/profile/values` `/profile/dna` `/profile/preferences` `/profile/privacy` | respective schemas → `{ completion }` |
| GET | `/onboarding/questions` | active questions (localized) |
| POST | `/onboarding/answers` | `questionAnswersSchema` → maps to fields |
| POST | `/profile/dna/interpret` | `{ dimension?, text }` → AI-suggested DNA entries (user must confirm via PUT `/profile/dna`) |
| POST | `/uploads` | `uploadRequestSchema` → `{ bucket, path, signedUrl, token }` |
| POST | `/profile/photos` | `confirmPhotoSchema` |
| PATCH/DELETE | `/profile/photos/[id]` | `updatePhotoSchema` |
| POST/DELETE | `/profile/video` | `confirmVideoSchema` |
| GET/POST | `/verification` | list own / `verificationSubmitSchema` |
| PATCH | `/account` | `accountUpdateSchema` |
| GET/PUT | `/settings/notifications` | `notificationPreferencesSchema` |
| GET/POST | `/settings/consents` | `consentUpdateSchema` |
| GET/POST | `/devices` | list / `registerDeviceSchema` (push tokens) |
| DELETE | `/devices/[id]` | revoke |
| POST | `/privacy/export` | queue + build JSON export → signed link |
| GET | `/privacy/requests` | own data requests |
| POST/DELETE | `/privacy/deletion` | `deleteAccountSchema` schedule / cancel |

## Discovery, interests, messaging, notifications (B)
| Method | Path | Notes |
|---|---|---|
| GET | `/recommendations` | today's `RecommendationItem[]` (generates if needed) |
| POST | `/recommendations/[id]` | `recommendationActionSchema` |
| POST | `/search` | `searchRequestSchema` → `ProfileCard[]` + nextCursor |
| GET | `/profiles/[id]` | `ProfileDetail` (records a view) |
| GET | `/profiles/viewers` | who viewed me (`see_who_viewed`) |
| POST | `/match-feedback` | `matchFeedbackSchema` |
| GET/POST | `/shortlist` ; DELETE `/shortlist/[profileId]` | |
| POST | `/passes` ; DELETE `/passes/[profileId]` | |
| GET/POST | `/blocks` ; DELETE `/blocks/[profileId]` | |
| POST | `/reports` | `reportSchema` |
| GET/POST | `/interests` | `?direction=received|sent&status=` / `sendInterestSchema` |
| POST | `/interests/[id]` | `respondInterestSchema` (accept creates connection + conversation) |
| GET | `/connections` ; POST `/connections/[id]/close` | `ConnectionItem[]` |
| GET | `/conversations` | `ConversationItem[]` |
| GET/POST | `/conversations/[id]/messages` | paginated `MessageItem[]` / `sendMessageSchema` |
| POST | `/conversations/[id]/read` | mark read |
| PATCH | `/conversations/[id]` | `{ muted?, archived? }` |
| GET | `/notifications` ; POST `/notifications/read` | `{ ids? }` (none = all) |

## AI & connection intelligence & family (C)
| Method | Path | Notes |
|---|---|---|
| GET | `/profiles/[id]/explanation` | `MatchExplanation` (engine; AI-enriched when available) |
| POST | `/search/smart` | `smartSearchRequestSchema` → `SmartSearchInterpretation` |
| GET | `/matchmaker/threads` ; GET `/matchmaker/threads/[id]` | |
| POST | `/matchmaker` | `matchmakerMessageSchema` → streamed text (`text/plain`), headers `x-thread-id`; final structured payload persisted on the thread message |
| GET/POST | `/connections/[id]/insights?kind=gap_analysis|before_you_meet` | `InsightEnvelope<GapAnalysis|BeforeYouMeetBriefing>` |
| GET/POST | `/connections/[id]/vision` ; PATCH/DELETE `/connections/[id]/vision/[itemId]` ; POST `/connections/[id]/vision/themes` | |
| GET/POST | `/connections/[id]/journal` ; PATCH/DELETE `/connections/[id]/journal/[entryId]` | private to author |
| GET/POST | `/connections/[id]/meetings` ; PATCH `/connections/[id]/meetings/[meetingId]` | |
| GET | `/connections/[id]` | connection overview (other profile card, conversation id) |
| GET/PUT | `/readiness` (notes) ; POST `/readiness/chat` (streamed) | |
| GET/POST | `/family` (owner: list/invite) ; PATCH/DELETE `/family/[memberId]` | |
| POST | `/family/accept` | `familyAcceptSchema` |
| GET | `/family/of/[profileId]` | member view: owner's recommendations/shortlist (per permissions) |
| GET/POST | `/family/suggestions` ; PATCH `/family/suggestions/[id]` | |
| GET/POST | `/family/discussions?targetProfileId=` | |
| POST | `/ai/feedback` | `aiFeedbackSchema` |

## Billing & cron (E)
| Method | Path | Notes |
|---|---|---|
| GET | `/plans` | public `PlanItem[]` |
| POST | `/billing/coupon-preview` | `couponPreviewSchema` |
| POST | `/billing/checkout` | `checkoutSchema` → `CheckoutOrder` |
| POST | `/billing/verify` | `verifyPaymentSchema` → activates plan |
| GET | `/billing/history` | payments + invoices + subscription |
| GET | `/billing/invoices/[id]` | invoice JSON; `?format=html` printable |
| POST | `/webhooks/razorpay` | signature-verified, idempotent (no auth) |
| GET/POST | `/api/cron/daily`, `/api/cron/hourly` | `Authorization: Bearer CRON_SECRET` |

## Support (D, member side)
| Method | Path |
|---|---|
| GET/POST | `/support/tickets` ; GET/POST `/support/tickets/[id]` (messages) |

## Admin (D) — `/api/v1/admin/*`, permission-gated, audited
overview, users (+ `/[id]`, `/[id]/suspend`, `/[id]/reactivate`, `/[id]/delete`, `/[id]/subscription`),
profiles, media moderation queue, verification queue (`/[id]/decision`), reports (`/[id]`),
moderation actions, risk signals, support tickets, matching (stats, configs CRUD/activate),
ai (usage, feature configs, prompts), analytics (+ CSV), subscriptions, payments, refunds
(`/[id]/approve` → `processRefund` from E), coupons, plans/prices/entitlements, cms,
notification templates + broadcast, feature flags, settings, regions, languages,
onboarding questions, audit logs, admins, roles/permissions, system/integrations.

## Cross-workstream module contracts
| Export | File | Owner | Used by |
|---|---|---|---|
| `<SmartSearch onApply={(filters, softPreferences) => void} />` | `components/ai/smart-search.tsx` | C | B (discover page) |
| `<MatchExplanationPanel profileId={string} />` | `components/ai/match-explanation.tsx` | C | B (profile page) |
| `processRefund(refundId, auth): Promise<void>` | `server/billing/refunds.ts` | E | D |
| `executeDueDeletions(): Promise<{ deleted: number }>` | `server/privacy/deletion.ts` | A | E (cron) |
| `expireInterests(): Promise<number>` | `server/interests/lifecycle.ts` | B | E (cron) |
| `<ProfileCardView card={ProfileCard} />` | `components/profile/profile-card.tsx` | B | C, D |

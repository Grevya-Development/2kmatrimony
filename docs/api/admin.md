# Admin API (`/api/v1/admin/*`) — Workstream D

All endpoints require an **active admin** (`admin_users`) and, when the `require_admin_mfa` flag is on and the
admin row has `mfa_required = true`, an **AAL2 session** (TOTP verified). Missing MFA → `403 forbidden` with
`details.mfaRequired = true`. Each endpoint checks one permission (below); `super_admin` holds all.
Every mutation writes an `audit_logs` row with before/after. Lists accept `page` and `limit` (≤100) and return
`{ items, total, page, limit, pages }`. Ranges accept `from`/`to` (`YYYY-MM-DD`, `to` inclusive; default last 30 days).

Sensitive data (contact details, identity documents) needs `sensitive_data.read`; every view writes
`admin.sensitive.view` to the audit log. Lists always return **masked** email/phone.

## Overview & analytics
| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/admin/overview?from&to` | any admin | `{ current, previous, series }` — headline metrics for the range and the previous equal-length range, daily series (signups, revenue, interests, connections, messages) |
| GET | `/admin/analytics?report=&from&to[&format=csv]` | `analytics.read` (+ `analytics.export` for CSV) | Reports: `acquisition, funnel, completion, search, matching, engagement, subscriptions, revenue, retention` → `{ reports, report: { title, columns, rows } }`. CSV is formula-injection safe and audited. |

## Users
| Method | Path | Permission | Body |
|---|---|---|---|
| GET | `/admin/users?q&status&plan&verified&from&to` | `users.read` | `q` matches name/email/phone or a profile code (`TK…`) |
| GET | `/admin/users/[id]` | `users.read` | account, profile summary, subscriptions, payments, reports by/against, moderation, risk signals, audit activity, verifications, data requests |
| GET | `/admin/users/[id]/contact` | `sensitive_data.read` | unmasked email/phone/sign-up IP (audited) |
| POST | `/admin/users/[id]/suspend` | `users.manage` | `{ reason (≥5), until? ISO }` — also bans the Supabase Auth session for the period and hides the profile |
| POST | `/admin/users/[id]/reactivate` | `users.manage` | `{ reason }` |
| POST | `/admin/users/[id]/delete` | `users.manage` | `{ reason, confirm: "DELETE" }` — schedules deletion via `data_requests` (grace period from `privacy.deletion_grace_days`); executed by the privacy job |
| POST | `/admin/users/[id]/subscription` | `subscriptions.manage` | `{ action: "grant", planCode, days, reason }` · `{ action: "extend", days, reason }` · `{ action: "cancel", reason }` |

## Profiles & media
| Method | Path | Permission | Body |
|---|---|---|---|
| GET | `/admin/profiles?q&status` | `profiles.read` | |
| GET | `/admin/profiles/[id]` | `profiles.read` | full data incl. fields hidden from members, all media with moderation status |
| PATCH | `/admin/profiles/[id]` | `profiles.moderate` | `{ action: "hide" \| "unhide", reason }` |
| GET | `/admin/media?kind=photo\|video&status=pending` | `profiles.moderate` | oldest first, signed URLs |
| POST | `/admin/media/[id]` | `profiles.moderate` | `{ kind, decision: "approved" \| "rejected", reason? }` (reason required to reject; member notified) |

## Verification
| Method | Path | Permission | Body |
|---|---|---|---|
| GET | `/admin/verification?status=open\|pending\|…&kind` | `verification.review` | includes `ageHours` for SLA |
| GET | `/admin/verification/[id]` | `verification.review` | documents (10-minute signed URLs) only with `sensitive_data.read` (audited); photo checks include the primary photo |
| POST | `/admin/verification/[id]/decision` | `verification.review` | `{ decision: "approved" \| "rejected" \| "resubmission_required" \| "in_review", reason? }` — sets `is_identity_verified` (government ID) / `is_photo_verified` (photo), writes `verification_events`, notifies the member |

## Trust & safety
| Method | Path | Permission | Body |
|---|---|---|---|
| GET | `/admin/reports?status=open\|actioned\|dismissed\|all&priority&mine` | `reports.manage` | |
| GET | `/admin/reports/[id]` | `reports.manage` | target profile, reporter, **only** the reported message (never the conversation), reported photo, prior report count, actions |
| PATCH | `/admin/reports/[id]` | `reports.manage` | `{ status?, priority?, assignToMe?, unassign?, resolution? }` (closing requires a resolution) |
| GET | `/admin/moderation` | `reports.manage` | action history |
| POST | `/admin/moderation` | `moderation.act` | `{ action, reason, targetProfileId?, reportId?, photoId?, videoId?, messageId?, expiresAt? }` — actions: `warn, hide_profile, suspend, reinstate, ban, remove_photo, remove_video, remove_message, clear_flag`. Closes the linked report as `actioned`. |
| GET | `/admin/risk?status` | `risk.review` | automated signals — never auto-enforced |
| PATCH | `/admin/risk/[id]` | `risk.review` | `{ status: "reviewed_ok" \| "actioned" \| "dismissed" }` |

## Support (staff)
| Method | Path | Permission | Body |
|---|---|---|---|
| GET | `/admin/support/tickets?status=active\|…&category&mine` | `support.read` | |
| GET | `/admin/support/tickets/[id]` | `support.read` | includes internal notes |
| PATCH | `/admin/support/tickets/[id]` | `support.respond` | `{ status?, priority?, assignToMe?, unassign? }` |
| POST | `/admin/support/tickets/[id]` | `support.respond` | `{ body, internal? }` — replies set status `pending_user` and notify the member (`support_reply`); internal notes are staff-only |

## Matchmaking intelligence
| Method | Path | Permission | Body |
|---|---|---|---|
| GET | `/admin/matching/stats?from&to` | `matching.read` | score histogram, averages, recommendation & interest funnels, feedback by reason, dimension averages |
| GET | `/admin/matching/configs?region=default` | `matching.read` | version history |
| POST | `/admin/matching/configs` | `matching.configure` | `{ region, weights{9 dims}, thresholds{min_recommend_mutual, min_direction, max_asymmetry, min_confidence, daily_batch_size, candidate_pool}, notes, activate }` → new version (activated atomically w.r.t. the previous one) |
| POST | `/admin/matching/configs/[id]/activate` | `matching.configure` | roll back / forward |
| POST | `/admin/matching/test` | `matching.read` | `{ codeA, codeB }` → engine breakdown in both directions + explanation (nothing persisted) |

## AI operations
| Method | Path | Permission | Body |
|---|---|---|---|
| GET | `/admin/ai/usage?from&to` | `ai.read` | totals, by feature/model (tokens, cost USD, p50/p95 latency, errors/refusals), daily series, feedback, recommendation acceptance |
| GET | `/admin/ai/configs` | `ai.read` | |
| PATCH | `/admin/ai/configs/[feature]` | `ai.configure` | `{ provider?, model?, effort?, maxTokens?, enabled?, dailyUserLimit?, promptKey? }` |
| GET | `/admin/ai/prompts` | `ai.read` | safety preamble, code defaults, DB versions per key |
| POST | `/admin/ai/prompts` | `ai.configure` | `{ key, systemPrompt, notes?, activate }` |
| PATCH | `/admin/ai/prompts/[id]` | `ai.configure` | `{ isActive }` (one active version per key; deactivating reverts to the code default) |

## Billing
| Method | Path | Permission | Body |
|---|---|---|---|
| GET | `/admin/subscriptions?status&plan` | `subscriptions.read` | |
| GET | `/admin/payments?status&from&to` | `payments.read` | |
| GET | `/admin/payments/[id]` | `payments.read` | payment, invoice, refunds |
| GET | `/admin/refunds?status` | `payments.read` | |
| POST | `/admin/refunds` | `refunds.manage` | `{ paymentId, amountPaise, reason }` (≤ refundable amount) |
| POST | `/admin/refunds/[id]/approve` | `refunds.manage` | records approval then calls `processRefund()` (billing workstream). Returns `{ approved, processing: { ok, status, message } }` — `ok:false` when Razorpay is unconfigured/unavailable |
| POST | `/admin/refunds/[id]/reject` | `refunds.manage` | `{ reason }` |
| GET / POST | `/admin/coupons` | `payments.read` / `coupons.manage` | `{ code, discountType, discountValue, maxRedemptions?, perUserLimit, planCodes[], validFrom?, validUntil?, isActive }` |
| PATCH / DELETE | `/admin/coupons/[id]` | `coupons.manage` | delete deactivates coupons that were redeemed |
| GET / POST | `/admin/plans` | `plans.manage` | plans with prices & entitlements + entitlement key catalogue |
| PATCH | `/admin/plans/[id]` | `plans.manage` | meta, `isPublic`, `isActive` (Free cannot be deactivated) |
| POST | `/admin/plans/[id]/prices` | `plans.manage` | `{ interval, amountPaise, razorpayPlanId?, isActive }` (upsert) |
| PUT | `/admin/plans/[id]/entitlements` | `plans.manage` | `{ values: { key: value } }` — type-checked against `DEFAULT_ENTITLEMENTS` |

## Content, notifications, configuration
| Method | Path | Permission | Body |
|---|---|---|---|
| GET / POST | `/admin/cms[?kind]` | `cms.manage` | success stories need `consentReference` to publish |
| PATCH / DELETE | `/admin/cms/[id]` | `cms.manage` | |
| GET / POST | `/admin/notifications/templates` | `notifications.manage` | `{ key, channel, locale, subject?, body, providerTemplateId?, isActive }` |
| PATCH / DELETE | `/admin/notifications/templates/[id]` | `notifications.manage` | |
| POST | `/admin/notifications/preview` | `notifications.manage` | `{ subject?, body, vars }` → rendered text + variables |
| POST | `/admin/notifications/broadcast` | `notifications.manage` (10/h) | `{ title, body, href?, audience: { planCode?, country?, city? }, dryRun }` — in-app only, capped at 10,000 |
| GET | `/admin/flags` | any admin | |
| PATCH | `/admin/flags/[key]` | `feature_flags.manage` | `{ enabled?, rolloutPercent?, description? }` |
| GET | `/admin/settings` | `settings.manage` | |
| PUT | `/admin/settings/[key]` | `settings.manage` | `{ value, description?, isPublic? }` — known keys (`brand, policy_versions, limits, interests, privacy, gst, safety`) are schema-validated |
| GET | `/admin/regions` | `regions.manage` | regions + languages |
| PATCH | `/admin/regions/[code]` · `/admin/languages/[code]` | `regions.manage` | `{ isEnabled?, matchingConfigRegion? }` · `{ isEnabled?, aiSupported? }` (English cannot be disabled) |
| GET / POST | `/admin/questions` | `onboarding.manage` | onboarding question bank |
| PATCH / DELETE | `/admin/questions/[id]` | `onboarding.manage` | keys are immutable; delete = deactivate |
| GET | `/admin/audit?action&actor&actorType&entityType&entityId&from&to` | `audit.read` | `action` is a prefix match; `actor` = email fragment or user id |

## Super admin
| Method | Path | Permission | Body |
|---|---|---|---|
| GET / POST | `/admin/admins` | `admins.manage` | `{ identifier (email or phone of an existing account), roleId, displayName, mfaRequired }` |
| PATCH | `/admin/admins/[userId]` | `admins.manage` | `{ roleId?, isActive?, mfaRequired?, displayName? }` — cannot deactivate yourself or the last active super admin |
| GET / POST | `/admin/roles` | `roles.manage` | `{ key, name, description?, permissions[] }` |
| PATCH / DELETE | `/admin/roles/[id]` | `roles.manage` | Super Admin role is immutable; system roles cannot be deleted; roles with members cannot be deleted |
| GET | `/admin/system` | `settings.manage` | DB health/latency, integration status, queue sizes, recent AI errors, notification delivery stats, last payment webhook |

## Bootstrapping the first super admin
1. Sign up once in the app (phone OTP, email, Google or Apple).
2. `node --experimental-strip-types scripts/create-super-admin.ts --email you@example.com --name "Your Name"`
   (or `--phone +91…`; `--role admin` for another role; `--no-mfa` only for local development).
   Reads `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the environment or `apps/web/.env.local`.
3. Visit `/admin` — with MFA required you will enrol an authenticator app (TOTP) on first visit.

Admin accounts should be **deactivated, not deleted**: their actions are referenced by audit and moderation records.

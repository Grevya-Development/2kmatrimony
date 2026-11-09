# Database

PostgreSQL 17 on Supabase with `pgvector`, `pg_trgm`, `citext`, `pgcrypto`.
Schema lives in `supabase/migrations` (apply: `npx supabase migration up --local`;
production: `npx supabase db push`). Types: `npm run db:types` →
`packages/shared/src/database.types.ts`.

## Conventions
- UUID primary keys (`gen_random_uuid()`), `timestamptz` audit columns, `updated_at` triggers.
- Allowed values are `CHECK` constraints mirrored in `packages/shared/src/constants.ts`.
- Order-independent pairs (`match_scores`, `connections`) store `profile_a < profile_b`.
- Money in **paise** (integers). Prices are GST-inclusive.
- RLS is enabled on every table. Clients have SELECT on their own rows only; all writes
  go through the API with the service role (see `docs/ARCHITECTURE.md`).

## Domains, tables and data ownership

| Domain | Tables | Owner of a row | Notes |
|---|---|---|---|
| Identity | `app_users` (1:1 `auth.users`), `user_devices`, `consent_records` (+ view `current_consents`) | the user | `app_users` auto-created by trigger on signup; phone/email synced from auth |
| Admin RBAC | `admin_roles`, `admin_permissions`, `admin_role_permissions`, `admin_users` | platform | helpers `is_admin()`, `has_permission()` |
| Audit | `audit_logs` | platform | append-only (trigger blocks UPDATE/DELETE) |
| Profile | `profiles`, `profile_education`, `profile_career`, `profile_family`, `profile_lifestyle`, `profile_values`, `relationship_dna`, `question_responses`, `partner_preferences`, `profile_photos`, `profile_videos` | profile owner (`profiles.owner_user_id`) | one profile per account (v1); `profiles.embedding vector(1024)` + `search_tsv` for search |
| Matching | `matching_configs`, `match_scores`, `match_explanations`, `recommendations`, `match_feedback`, `profile_views` | platform / viewer | one active config per region |
| Interactions | `shortlists`, `passes`, `blocks`, `interests`, `connections` | acting profile | one pending interest per direction; connection on mutual interest |
| Messaging | `conversations`, `conversation_participants`, `messages` | participants | realtime; insert guard trigger; conversation locked on close/block |
| AI | `ai_feature_configs`, `ai_prompts`, `ai_usage_logs`, `ai_feedback`, `ai_threads`, `ai_thread_messages` | platform / user | threads private to the user |
| Connection features | `connection_insights`, `vision_board_items`, `connection_journal`, `meeting_plans`, `readiness_notes` | connection members / author | journal & readiness notes private to author; vision items private until shared |
| Family | `family_members`, `family_suggestions`, `family_discussions` | profile owner | permissions array; invite token stored hashed |
| Trust & safety | `verifications`, `verification_events`, `reports`, `moderation_actions`, `risk_signals`, `rate_limit_counters` | platform | ID docs in private `verification-docs` bucket; no full ID numbers stored |
| Billing | `plans`, `plan_prices`, `plan_entitlements`, `subscriptions`, `payments`, `coupons`, `coupon_redemptions`, `invoice_counters`, `invoices`, `refunds`, `payment_webhook_events`, `usage_counters` | user / platform | invoice numbers sequential per financial year (`next_invoice_number`) |
| Notifications | `notifications`, `notification_preferences`, `notification_templates`, `notification_deliveries` | user / platform | templates editable per channel & locale |
| Platform | `feature_flags`, `platform_settings`, `regions`, `languages`, `onboarding_questions`, `cms_entries` | platform | `platform_settings.is_public` exposed via `/api/v1/config` |
| Support & privacy | `support_tickets`, `support_messages`, `data_requests`, `analytics_events` | user / platform | internal notes hidden from members |

## Key relationships
```
auth.users 1─1 app_users 1─1 profiles ─┬─ profile_* sections (1:1 / 1:n)
                                        ├─ relationship_dna (10 rows max)
                                        ├─ partner_preferences (1:1)
                                        ├─ interests (sender/receiver) ──> connections ─1─1 conversations ─< messages
                                        ├─ recommendations / match_scores (pairs)
                                        └─ family_members ─< family_suggestions / discussions
app_users ─< subscriptions ─< payments ─1─1 invoices ; payments ─< refunds
```

## SQL functions (service-role only unless noted)
| Function | Purpose |
|---|---|
| `search_profile_ids(viewer, filters jsonb, text, embedding, limit, offset, exclude_passed)` | filtered + ranked search honoring visibility & blocks |
| `recommendation_candidates(viewer, seeking[], age_min, age_max, limit)` | coarse candidate pool (mutual gender preference, excludes connected/passed/blocked/pending) |
| `rate_limit_hit(bucket, window_seconds, limit)` | fixed-window limiter |
| `increment_usage(user, key, period, limit)` | atomic daily quota |
| `next_invoice_number(fy)` | GST invoice sequence |
| `is_admin()`, `has_permission(p)`, `owns_profile(id)`, `my_profile_id()`, `family_can(id, perm)`, `is_connection_member(id)`, `is_conversation_participant(id)`, `is_blocked_between(a,b)` | RLS helpers (authenticated) |

## Storage buckets (all private)
`profile-photos` (10 MB images), `profile-videos` (100 MB), `verification-docs` (10 MB, images/PDF),
`chat-media` (10 MB images), `data-exports` (JSON/zip). Access only via signed URLs from the API.

## Realtime
Publication `supabase_realtime`: `messages`, `notifications`, `interests`, `conversations`,
`conversation_participants`. Private broadcast/presence channels `conversation:<uuid>`
authorised by RLS on `realtime.messages`.

## Retention policy
| Data | Retention |
|---|---|
| Account & profile | until deletion; deletion executes after `privacy.deletion_grace_days` (default 14) |
| Messages | until either party deletes their account (then sender reference is nulled) |
| Payments, invoices | retained 8 years (Indian tax law) — user references anonymised on deletion |
| Audit logs | retained 3 years minimum (immutable) |
| `rate_limit_counters` | 2 days; `usage_counters` 90 days (daily cron cleanup) |
| `ai_usage_logs`, `analytics_events` | 13 months (aggregate before purge) |
| Verification documents | deleted 90 days after a final decision, or on account deletion |
| Data exports | signed link valid `privacy.export_link_hours`; object purged after 7 days |

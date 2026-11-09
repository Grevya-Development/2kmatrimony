# Profile, onboarding, media, verification, settings & privacy (workstream A)

Base path `/api/v1`. Auth: Bearer Supabase access token (mobile) or session cookie (web).
Responses `{ data }`; errors `{ error: { code, message, details } }`. Schemas live in
`packages/shared/src/schemas.ts`, response types in `packages/shared/src/api.ts`.

"Profile required" endpoints return `409 profile_incomplete` until `POST /profile` has run.

## Profile

| Method | Path | Auth | Body | Response | Notes / errors |
|---|---|---|---|---|---|
| POST | `/profile` | user | `startProfileSchema` `{ createdFor, managedByRelation?, consents: { terms: true, privacy: true, aiProcessing } }` | `{ profileId, created }` (201 new / 200 existing) | Records consent rows with current `policy_versions`. Rate limit 10/h. 422 if terms/privacy false. |
| GET | `/profile` | profile | — (`?preview=1` for stranger view) | `OwnProfileResponse` | `detail` = privacy projection (own view, or stranger view in preview), `form` = editable values in request-schema shapes, `photos` incl. pending, `completion`, `limits`. |
| PATCH | `/profile` | profile | `profilePatchSchema` `{ onboardingStep }` | `{ onboardingStep }` | Saves wizard progress. |
| PUT | `/profile/basics` | profile | `basicsSchema` | `{ completion }` | 422 if under 18. |
| PUT | `/profile/education` | profile | `educationSchema` `{ items[] }` | `{ completion }` | Replaces the set; first item becomes highest if none marked. |
| PUT | `/profile/career` | profile | `careerSchema` | `{ completion }` | |
| PUT | `/profile/family` | profile | `familySchema` | `{ completion }` | |
| PUT | `/profile/lifestyle` | profile | `lifestyleSchema` | `{ completion }` | |
| PUT | `/profile/values` | profile | `valuesSchema` | `{ completion }` | Also writes `core_values` / `personality_traits`. |
| PUT | `/profile/dna` | profile | `dnaSaveSchema` `{ entries[{ dimension, selfScore, partnerTarget, importance, flexible, statement?, origin }] }` | `{ completion }` | `origin`: `explicit` → source `explicit`; `ai_accepted` → `ai_suggested`; `ai_corrected` → `user_corrected`. Editing an AI-sourced row → `user_corrected`. Sets `confirmed_at`. |
| POST | `/profile/dna/interpret` | profile | `dnaInterpretSchema` `{ text, dimension? }` | `{ suggestions: DnaSuggestion[], note }` | Suggestions only — nothing saved. 403 without `ai_processing` consent; 503 `service_unconfigured` without `ANTHROPIC_API_KEY`; rate limit 20/h. |
| PUT | `/profile/preferences` | profile | `partnerPreferencesSchema` | `{ completion }` | |
| PUT | `/profile/privacy` | profile | `privacySchema` | `CompletionReport` | Audited (`profile.privacy.update`). |

Every section save: upsert → `refreshProfileDerived` (completion %, search text, auto-activation draft→active when required sections are complete) → best-effort embedding refresh → audit `profile.update`.

## Onboarding questions

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/onboarding/questions` | user | `?section=values|dna|…` | `OnboardingQuestion[]` (localised by `preferred_locale`, with current `answer`) | |
| POST | `/onboarding/answers` | profile | `questionAnswersSchema` `{ answers[{ questionKey, answer }] }` | `{ completion }` | Answers validated against the question type/options. `maps_to` `dna:<dim>` → relationship_dna (`dnaAnswerSchema`), `<table>.<column>` → whitelisted columns only. 422 unknown question / invalid option. |

## Media

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| POST | `/uploads` | profile | `profileUploadSchema` `{ kind: photo|video|verification, contentType, sizeBytes }` | `{ bucket, path, token, signedUrl }` (201) | Client then `PUT`s the file to `signedUrl`. Photo count limited by `limits.max_photos`. Chat uploads are not handled here. |
| POST | `/profile/photos` | profile | `confirmPhotoSchema` `{ path, width?, height? }` | `{ id, completion }` (201) | Verifies the object exists under the caller's profile prefix (403 otherwise, 422 if missing). First photo becomes primary; status `pending` until moderated. |
| PATCH | `/profile/photos/[id]` | profile | `updatePhotoSchema` `{ isPrimary?, visibility?, sortOrder? }` | `{ ok }` | 404 if not owner. |
| DELETE | `/profile/photos/[id]` | profile | — | `{ completion }` | Removes storage object; promotes next photo to primary. |
| POST | `/profile/video` | profile | `confirmVideoSchema` `{ path, durationSeconds, visibility }` | `{ id }` (201) | Flag `video_intros`. Duration must be within `limits.video_min_seconds..video_max_seconds`. Replaces any existing video. |
| DELETE | `/profile/video` | profile | — | `{ ok }` | |

## Verification (member side)

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/verification` | profile | — | `VerificationItem[]` (one per kind, latest attempt) | Phone/email rows are auto-created as `approved` from Supabase Auth confirmations. |
| POST | `/verification` | profile | `verificationSubmitSchema` `{ kind, documentType, documentPaths[], submittedData }` | `{ id, status: 'pending' }` (201) | Documents uploaded via `/uploads` (`kind: verification`, private bucket). 409 if pending/in review or already approved; 422 for unsupported document type or anything resembling a full ID number. Resubmission increments `attempt` and logs a `verification_events` row. Rate limit 10/day. |

## Account & settings

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| PATCH | `/account` | user | `accountUpdateSchema` `{ fullName?, preferredLocale? }` | `{ ok }` |
| GET | `/settings/notifications` | user | — | `{ category, channel, enabled, locked }[]` (stored values over defaults) |
| PUT | `/settings/notifications` | user | `notificationPreferencesSchema` | same as GET |
| GET | `/settings/consents` | user | — | `ConsentState[]` |
| POST | `/settings/consents` | user | `consentUpdateSchema` `{ consentType, granted }` | `ConsentState[]` — 422 when withdrawing `terms`/`privacy` (requires account deletion) |
| GET | `/devices` | user | — | `DeviceItem[]` (active) |
| POST | `/devices` | user | `registerDeviceSchema` | `{ id, created }` — push tokens are unique per device and move between accounts; a new device triggers `security_new_device` |
| DELETE | `/devices/[id]` | user | — | `{ ok }` (404 if not owner) |

Phone/email changes and passwords use Supabase Auth directly from the client (`auth.updateUser`, `verifyOtp type=phone_change`).

## Privacy operations (DPDP)

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| POST | `/privacy/export` | user | — | `{ requestId, url, expiresAt }` (201) | Builds a JSON export of the member's data into the private `data-exports` bucket; signed link valid `privacy.export_link_hours`; emails `data_export_ready`. Rate limit 3/day. |
| GET | `/privacy/requests` | user | — | `DataRequestItem[]` | |
| POST | `/privacy/deletion` | user | `deleteAccountSchema` `{ confirm: 'DELETE', reason? }` | `{ requestId, scheduledFor }` (201) | Account → `pending_deletion`, profile hidden, email `account_deletion_scheduled`. Idempotent. |
| DELETE | `/privacy/deletion` | user | — | `{ ok }` | Cancels; account active, profile re-activates if complete. 404 if none scheduled. |

`executeDueDeletions()` (`server/privacy/deletion.ts`, run by the daily cron): for each due request, removes storage objects (photos, video, verification docs, chat media sent, exports), blanks messages the member sent, then
- **no payments/invoices** → deletes the auth user (cascades all member data);
- **has payments/invoices** (GST retention) → deletes the profile, scrubs `app_users` PII, bans and anonymises the auth identity, keeps payment/invoice rows.

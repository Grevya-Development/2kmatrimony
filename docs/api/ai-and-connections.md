# API — AI, connection intelligence, readiness, family (Workstream C)

All paths are under `/api/v1`. Auth: Bearer token or session cookie. Responses use `{ data }` /
`{ error: { code, message } }`. Types live in `packages/shared/src/api.ts` (`// ---- Workstream C additions ----`
section plus `MatchExplanation`, `SmartSearchInterpretation`, `GapAnalysis`, `BeforeYouMeetBriefing`,
`InsightEnvelope`, `VisionThemes`); request schemas in `packages/shared/src/schemas.ts`.

## Match explanation
| | |
|---|---|
| `GET /profiles/{id}/explanation` | `MatchExplanation`. 404 if the viewer may not see the profile (blocked, hidden, inactive, own). 409 if the caller has no profile. Engine output for everyone; AI-enriched when the plan's `ai_insights` is `basic` (starters only) or `full` (copy rewrite), flag `ai_explanations` is on, AI is configured and the viewer granted `ai_processing`. Cached in `match_explanations` by a fingerprint of the engine result + both profiles' `updated_at` + tier. Rate limit 120/h. |

## Smart search
| | |
|---|---|
| `POST /search/smart` `{ query }` | `SmartSearchInterpretation` `{ filters, softPreferences, clarifyingQuestions, summary, generator: 'ai'|'rules' }`. Quota `smart_search_per_day`. Advanced filters not in the plan are removed, kept as soft preferences, and explained in `summary`. Flag `smart_search`. Apply the result with `POST /search` (`filters`) — soft preferences only affect ranking. |

## Personal matchmaker
| | |
|---|---|
| `GET /matchmaker/threads` | `{ threads: MatchmakerThreadSummary[], status: MatchmakerStatus }` |
| `POST /matchmaker` `{ threadId?, message, locale? }` | **Streams `text/plain`** (the assistant reply). Header `x-thread-id`. Quota `ai_matchmaker_messages_per_day` and consent checks happen before streaming (JSON errors: 402 quota, 403 consent, 422 validation). After the stream ends, call `GET /matchmaker/threads/{id}`: the last assistant message carries `structured` (`MatchmakerStructured`: intent, filters, softPreferences, clarifyingQuestions, resultIds, generator, notice) and `results` (projected `ProfileCard[]`). Without an AI key the matchmaker runs in rules mode (keyword parsing + search). |
| `GET /matchmaker/threads/{id}` | `{ id, title, filters, softPreferences, messages: MatchmakerMessage[] }` (results re-projected on every read; profiles that became invisible drop out) |
| `POST /matchmaker/threads/{id}/apply` `{ filters, softPreferences }` | Re-runs the search with member-edited filters (no AI, no quota) and records an assistant message. Returns `MatchmakerMessage`. |
| `DELETE /matchmaker/threads/{id}` | Deletes the thread. |

## Connections (members only; 404 for anyone else)
| | |
|---|---|
| `GET /connections/{id}` | `ConnectionOverview` (other `ProfileCard`, conversation id, engine `MatchExplanation`, feature availability) |
| `GET /connections/{id}/insights?kind=gap_analysis|before_you_meet` | Latest `InsightEnvelope` or `null` (both members can read) |
| `POST /connections/{id}/insights?kind=…` | Generate. Requires active connection, flag, and the caller's plan entitlement (`gap_analysis` / `before_you_meet`, else 402). AI is used only when configured **and both members** granted `ai_processing`; otherwise the deterministic builder output is stored (`generator: 'engine'`). 10/day. |
| `GET /connections/{id}/vision` | `{ items: VisionItem[], themes: InsightEnvelope<VisionThemes> | null }` — your items + the other member's shared items |
| `POST /connections/{id}/vision` | `visionItemSchema` → `VisionItem` (private unless `isShared`) |
| `PATCH/DELETE /connections/{id}/vision/{itemId}` | Author only |
| `POST /connections/{id}/vision/themes` | `InsightEnvelope<VisionThemes>` from shared items only |
| `GET/POST /connections/{id}/journal` ; `PATCH/DELETE …/journal/{entryId}` | Private compatibility-evolution journal (`JournalEntry`). Never reads messages, never changes scores. Flag `compatibility_journal`. |
| `GET/POST /connections/{id}/meetings` ; `PATCH …/meetings/{meetingId}` `{ status }` | `MeetingPlan`. Members, or family members with `coordinate_meetings`. Accept/decline: a member other than the proposer; cancel: proposer or member; complete: members. Proposals must be in the future. |

## Readiness assistant (flag `readiness_assistant`)
| | |
|---|---|
| `GET /readiness` | `{ notes: ReadinessNote[] (all 11 topics), aiAvailable, consentGranted }` |
| `PUT /readiness` | `readinessNoteSchema` → `ReadinessNote` (private) |
| `GET /readiness/chat?topic=` | Topic discussion history |
| `POST /readiness/chat` `{ topic, message }` | Streams `text/plain`; persisted on completion. 503 `service_unconfigured` without an AI key; 403 without `ai_processing` consent. |

## Family collaboration (flag `family_mode`)
| | |
|---|---|
| `GET /family` | Owner: `{ members: FamilyMemberItem[], suggestions: FamilySuggestionItem[], discussions }` |
| `POST /family` | `familyInviteSchema` → `{ member, inviteLink, delivered }`. Token = 32 random bytes (only its SHA-256 is stored), valid 7 days. Delivered via email/SMS provider when configured; the link is always returned so the owner can share it. Records `family_access` consent. Max 10 members. |
| `PATCH /family/{memberId}` | `{ permissions?, regenerateInvite? }` (returns a fresh `inviteLink` when regenerated) |
| `DELETE /family/{memberId}` | Revoke |
| `POST /family/accept` | `{ token, acceptTerms? }` → `{ profileId, ownerName }`. Invitee needs an account, not a profile. Records terms/privacy consent when `acceptTerms`. |
| `GET /family/of/{profileId}` | Member view, projected from the **owner's** perspective: recommendations, shortlist, own suggestions, active connections (only with `coordinate_meetings`) |
| `POST /family/of/{profileId}/shortlist` | Needs `shortlist`; sets `added_by_user_id` |
| `GET /family/suggestions` ; `POST /family/suggestions` `{ profileId, targetProfileId, note? }` ; `PATCH /family/suggestions/{id}` `{ status }` | Members suggest (`suggest_matches`); owners decide |
| `GET /family/discussions?targetProfileId=&profileId=` ; `POST /family/discussions` | Owner or members with `discuss` |

Family members can never send interests, accept connections or message anyone — those endpoints require the caller's own profile.

## AI feedback
`POST /ai/feedback` `aiFeedbackSchema` → stored in `ai_feedback` (shown in AI operations).

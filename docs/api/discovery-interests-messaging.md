# Discovery, interests, messaging & notifications API (Workstream B)

All paths are under `/api/v1`. Auth: Supabase Bearer token (mobile) or session cookie (web).
Errors use the standard `{ error: { code, message, details } }` shape (see `packages/shared/src/api.ts`).
"active profile" = caller's profile `status = 'active'` (otherwise `409 profile_incomplete`).

## Recommendations
| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/recommendations` | – (active profile) | `RecommendationItem[]` — today's finite batch, generated on first request of the day. Size = min(plan `daily_recommendations`, matching config `daily_batch_size`). Passed items are omitted. |
| POST | `/recommendations/[id]` | `{ action: 'viewed' \| 'passed' \| 'shortlisted' }` | `{ id, status }`. `passed` also records a pass; `shortlisted` adds to shortlist. `viewed` never downgrades a stronger state. |
| POST | `/match-feedback` | `matchFeedbackSchema` | `{ saved: true }` (stores mutual score + config version at the time, for weight evaluation) |

## Search & profiles
| Method | Path | Body / query | Response |
|---|---|---|---|
| POST | `/search` | `searchWithPreferencesSchema` = `searchRequestSchema` + `softPreferences: string[]` (ranking only) | `{ data: { items: ProfileCard[], total }, nextCursor }`. Advanced filters (see `ADVANCED_FILTER_KEYS`) without the plan → `402 entitlement_required`. Rate limit 60/min. |
| GET | `/profiles/[id]` | `?source=recommendation\|discover` (optional analytics tag) | `ProfileDetail` via privacy projection. `404` when blocked/not viewable. Records one `profile_views` row per viewer/viewed per 24h and marks a `new` recommendation as viewed. Own id returns own detail (incl. pending media). |
| GET | `/profiles/viewers` | – | `ProfileViewersResponse` — last 30 days. Without `see_who_viewed`: `{ count, locked: true, items: [] }`. |

## Shortlist, passes, blocks, reports
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/shortlist` | – | `ShortlistItem[]` (`addedByFamily` when a family member added it) |
| POST | `/shortlist` | `shortlistSchema` | `{ shortlisted: true }` (target must be viewable) |
| DELETE | `/shortlist/[profileId]` | – | `{ shortlisted: false }` |
| POST | `/passes` | `passSchema` | `{ passed: true }` |
| DELETE | `/passes/[profileId]` | – | undo → `{ passed: false }` |
| GET | `/blocks` | – | `BlockedItem[]` |
| POST | `/blocks` | `blockSchema` | `{ blocked: true }` — hides both members everywhere, withdraws pending interests both ways, closes any connection and locks its conversation, removes from shortlist. Audited. |
| DELETE | `/blocks/[profileId]` | – | `{ blocked: false }` (does not reopen connections). Audited. |
| POST | `/reports` | `reportSchema` | `{ reportId, received: true }`. Priority: `urgent` for underage/safety_concern, `high` for harassment/scam/fake. A message report must come from a participant and flags the message. ≥3 distinct open reporters → `risk_signals.reported_repeatedly` (human review; no automatic enforcement). Rate limit 20/h. |

## Interests & connections
| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/interests` | `?direction=received\|sent\|all&status=&cursor=&limit=` | `InterestItem[]` + `nextCursor` (items whose profile is no longer viewable are skipped) |
| POST | `/interests` | `sendInterestSchema` | `201 SendInterestResult`. Rules: receiver active + discoverable, not blocked, gender preference respected (`403`), not already connected / no pending interest from you (`409`). If the receiver already sent you a pending interest → auto-accepted (`autoAccepted: true`, connection created, no quota used). Hourly velocity limit from `platform_settings.safety.max_interests_per_hour` (raises `mass_interests` risk signal, `429`). Daily quota = plan `interests_per_day` (`402`). Notifies receiver (`interest_received`). |
| POST | `/interests/[id]` | `{ action: 'accept' \| 'decline' \| 'withdraw' }` | `{ status, connectionId, conversationId }`. Accept/decline: receiver only; withdraw: sender only; pending + unexpired only. Accept creates connection (ordered pair) + conversation + participants + system greeting and notifies the sender (`interest_accepted`). Decline is silent. |
| GET | `/connections` | `?status=active\|closed\|all` | `ConnectionItem[]` with unread counts, sorted by latest activity |
| POST | `/connections/[id]/close` | `closeConnectionSchema` | `{ status: 'closed' }` — conversation becomes read-only, system note added. Audited. |

Cron helper: `expireInterests()` in `server/interests/lifecycle.ts` (wired by the daily cron).

## Messaging
| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/conversations` | `?archived=1` to include archived | `ConversationItem[]` |
| GET | `/conversations/[id]` | – | `ConversationItem` |
| PATCH | `/conversations/[id]` | `conversationUpdateSchema` `{ muted?, archived? }` | `{ ok: true }` |
| GET | `/conversations/[id]/messages` | `?cursor=&limit=` (newest first) | `{ data: { items: MessageItem[], otherLastReadAt }, nextCursor }` |
| POST | `/conversations/[id]/messages` | `sendMessageSchema` | `201 MessageItem`. Idempotent by `clientId`. `409` when locked/connection closed; `403` when the recipient accepts only ID-verified senders; rate limit `safety.max_messages_per_minute`. Heuristics flag links/phone numbers in early messages, payment language and repetition (`spam_messaging` risk signal; message still delivered); 5+ identical messages in 10 min are rejected. Images: `kind: 'image'` + `mediaPath` from `/chat-uploads` (flag `chat_images`). Push to recipient (`new_message`) unless muted. |
| POST | `/conversations/[id]/read` | – | `{ lastReadAt }` |
| POST | `/chat-uploads` | `chatUploadSchema` `{ conversationId, contentType, sizeBytes }` | `ChatUploadTicket` (signed upload URL under `chat-media/<conversationId>/…`) |

### Realtime (clients subscribe directly with Supabase)
- `postgres_changes` INSERT on `messages` filtered `conversation_id=eq.<id>` (RLS: participants only).
- `postgres_changes` UPDATE on `conversation_participants` (read receipts via `last_read_at`) and `conversations` (lock state, previews).
- Private channel `conversation:<id>` (`config: { private: true }`, RLS on `realtime.messages`): broadcast event `typing` `{ profileId }`, presence keyed by profile id for online status.
- `postgres_changes` INSERT on `notifications` filtered `user_id=eq.<uid>` for live badges.

## Notifications
| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/notifications` | `?cursor=&limit=&unread=1` | `NotificationItem[]` + `nextCursor` |
| POST | `/notifications/read` | `{ ids?: uuid[] }` (omit = all) | `{ updated }` |

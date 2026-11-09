# AI design

## Principles
- AI helps people understand each other; it never decides for them, never promises outcomes,
  never diagnoses personality, never infers sensitive traits, never reads private messages,
  and never communicates as a member.
- Every feature works — in a reduced, deterministic form — without an AI provider.
- Compatibility **scores always come from the matching engine** (`packages/matching`). AI only
  phrases explanations, briefings and conversation starters from engine facts.

## Architecture
| Layer | File |
|---|---|
| Client, structured output, streaming, usage + cost logging, refusal fallback | `apps/web/src/server/ai/client.ts` |
| Prompt registry (code v1 defaults, DB overrides in `ai_prompts`, safety preamble always prepended) | `apps/web/src/server/ai/prompts.ts` |
| Feature modules (each registers its prompt) | `apps/web/src/server/ai/features/*`, `server/connection-insights/service.ts` |
| Model routing per feature (model, effort, max tokens, enable) | table `ai_feature_configs` (Super Admin editable) |
| Embeddings (Voyage, optional) | `apps/web/src/server/ai/embeddings.ts` |

Default model: `claude-opus-5-5` for all text features, with server-side refusal fallbacks
(`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`). Structured features use
`client.beta.messages.parse` with Zod output formats; model output is re-validated
(`sanitizeFilters`, `cleanList`, `safeList`) before use, and phrases that promise outcomes or
label people incompatible are filtered out (`isSafeCopy`).

## Features
| Feature key | What it does | Without AI |
|---|---|---|
| `match_explanation` | Warm rewrite of engine explanation + 5 tailored starters (tier `basic` = starters only, `full` = rewrite) | Engine explanation + rule-based starters |
| `smart_search` | Natural language → validated `SearchFilters` + soft preferences + clarifying questions | Rules parser (`smart-search-rules.ts`) |
| `matchmaker_chat` | Per turn: reply + intent + filters (+ title), then search | Rules parser + deterministic reply ("simple mode") |
| `gap_analysis` | Alignments, differences with compromises, unanswered questions, conversations | `buildGapAnalysis` |
| `before_you_meet` | Shared interests/values, areas, differences, 5 starters, questions, meeting ideas | `buildBeforeYouMeet` |
| `vision_board_themes` | Common themes / open questions from shared items | `buildVisionThemes` |
| `readiness_assistant` | Streamed private reflection per topic | Notes-only mode |

## Privacy & consent
- **Consent:** AI is used only for members who granted `ai_processing`. Features that process two
  people's data (gap analysis, before you meet, vision themes) require **both** members' consent;
  otherwise the deterministic version is produced.
- **Grounding data** (`server/ai/features/common.ts → groundingFrom`) is built only from the
  privacy projection (`toDetail`), i.e. exactly what the other person is allowed to see. Sensitive
  fields hidden by a member's settings (religion/community, income, family details) never reach a
  prompt (covered by an integration test). Values/DNA answers are included only for connected
  members or the member themself. Contact details, exact DOB and photos are never sent.
- Member text is wrapped in tags with `untrusted()` and the safety preamble instructs the model to
  treat tagged content as data, not instructions.
- AI never receives message contents. The compatibility journal is private and not used by AI.

## Cost & limits
- Quotas from plan entitlements: `ai_matchmaker_messages_per_day`, `smart_search_per_day`; per-route
  rate limits on all AI endpoints. Explanations are cached by fingerprint.
- Every call is logged in `ai_usage_logs` (tokens incl. cache, USD micros, latency, status, prompt
  version) for the AI Operations dashboard. Stable system prompts use prompt caching.

## Configuration
Set `ANTHROPIC_API_KEY` (and optionally `VOYAGE_API_KEY`). Without them, `/health` reports the
integrations as unconfigured and the features above run in their deterministic modes
(readiness chat returns 503 `service_unconfigured` and the UI explains notes-only mode).

## Evaluation
Unit tests cover the rules parser, deterministic builders, output sanitisation and tier merging;
integration tests run the AI paths with a mocked model (`ai-explanation-mocked.test.ts`) to verify
grounding inputs, caching, consent gating and failure fallback against the real database.

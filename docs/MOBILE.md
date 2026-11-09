# Mobile apps (iOS + Android) — Expo

Real native apps built with Expo SDK 58 + React Native 0.88 + Expo Router (typed routes).
Not a WebView wrapper: every screen is native and talks to the same backend as the web app.

## Architecture
| Concern | Implementation |
|---|---|
| Routing | `apps/mobile/app/` (Expo Router). Tabs: For you, Discover, Matchmaker, Interests, Messages. Stacks: `member/[id]`, `chat/[id]`, `me/*`, `connections/*` (overview, gap analysis, before you meet, vision board, journal, meetings), `readiness/*` (private notes + discussion), `family/of/[profileId]` (family helper view), `support/*` (help & support tickets), `settings/*`, `verification`, `billing`, `shortlist`, `notifications`, `family/*`, `onboarding`, `(auth)/sign-in`, `auth/callback`. |
| Data | REST `/api/v1` via `src/lib/api.ts` (Bearer Supabase access token + `x-client-platform`), one refresh-and-retry on 401. Contracts from `@2k/shared`. |
| Supabase direct | **Auth and Realtime only** (`src/lib/supabase.ts`). |
| Session storage | Expo SecureStore (Keychain / Android Keystore, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`) with chunking for >2 KB values (`src/lib/secure-storage.ts`). PKCE flow; auto-refresh paused in background. |
| Offline | React Query cache persisted to AsyncStorage on background and restored on launch (`src/lib/query.ts`, 24 h max age, list screens only). Offline banner driven by API network failures (`src/lib/network.ts`). |
| AI conversations | Matchmaker (`POST /matchmaker`) and Readiness chat (`POST /readiness/chat`) stream `text/plain`; React Native's fetch buffers the body, so the app shows a typing indicator and reads the full reply, then loads the structured result (`GET /matchmaker/threads/{x-thread-id}` → filters, soft preferences, clarifying questions, result cards; `GET /readiness/chat?topic=`). Edited filters re-run via `POST /matchmaker/threads/{id}/apply` (no AI call). |
| Realtime chat | `postgres_changes` on `messages` (new messages) and `conversation_participants` (read receipts); private channel `conversation:<id>` for typing (broadcast) and online status (presence). Optimistic sends with idempotent `clientId` + retry. |
| Family helpers | Invitees accept via `family/accept?token=` and land on `family/of/[profileId]`: the owner's recommendations and shortlist (as the owner sees them), add to shortlist, suggest with a note, per-profile discussion threads, and meeting coordination — each gated by the permissions the owner granted. Helpers don't need a profile of their own; the router sends them to this view instead of onboarding. Owners see family discussions on `family/`. |
| Video intro | Optional 15–60 s video (limits from `GET /profile`), recorded with the front camera or picked from the library (`expo-image-picker`, `videoMaxDuration`), length checked client-side (`src/lib/video.ts`) and server-side, uploaded via `POST /uploads {kind:'video'}` → signed PUT → `POST /profile/video`; removable via `DELETE /profile/video`. Hidden when the `video_intros` flag is off. |
| Help & support | Ticket list, new request (category, subject, body) and thread with staff replies via `/support/tickets` (internal staff notes are never returned). Closed tickets can't be replied to; replying to a resolved ticket reopens it. Reachable from My profile and from `support_reply` notifications (`data.href = /app/support/:id`). **Suspended members** are routed to Help & support (Settings & privacy stays reachable for data rights) so they can contact the team or appeal. |
| Push | `expo-notifications` → Expo push token → `POST /devices`. Tapping a notification deep-links using `data.href` (`src/lib/deeplinks.ts`). |
| Biometrics | Optional Face ID / fingerprint lock on cold start and after 5 min in background (`src/components/app/LockScreen.tsx`). |
| Design | Tokens mirror web (`src/theme`), Cormorant Garamond + Inter, accessible components in `src/components/ui` (roles, labels, adjustable slider, dynamic type cap 1.6×). Icons are inline SVG (no icon font). |

## Configuration
Copy `apps/mobile/.env.example` to `.env`:
```
EXPO_PUBLIC_API_URL=http://<LAN-IP>:3000        # physical device; Android emulator: http://10.0.2.2:3000
EXPO_PUBLIC_SUPABASE_URL=http://<LAN-IP>:56321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```
`app.json → expo.extra` provides fallbacks. Never put secrets (service role, Razorpay secret) in the app.

### Supabase Auth redirect URLs
Add to Supabase Auth → URL configuration (already in `supabase/config.toml` for local):
`twokmatrimony://auth/callback`, and for Expo Go development `exp://<LAN-IP>:8081/--/auth/callback`.

### Deep links / universal links
- Custom scheme: `twokmatrimony://` (e.g. `twokmatrimony://profile/<id>`, `messages/<id>`, `family/accept?token=…`).
- HTTPS app links: replace `app.example.com` in `app.json` (`android.intentFilters`, `ios.associatedDomains`) with the production web domain, and host `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` on the web app.
- Incoming links are rewritten in `app/+native-intent.tsx` using the same mapping as notification links.

### Push notifications
Requires an EAS project: `npx eas-cli@latest init` writes `extra.eas.projectId` to app config. Without it the app skips push registration (logged warning). Configure APNs key and FCM credentials with `eas credentials`. The server sends via Expo push (`apps/web/src/server/notify/providers/push.ts`).

## Running
```
npm run db:start              # repo root: local Supabase
npm run dev                   # repo root: web + API on :3000
cd apps/mobile && npx expo start
```
Expo Go works for most screens; biometric/Face ID prompts and push need a development build:
`npx eas-cli@latest build --profile development --platform ios|android` (or `npx expo run:ios|android` with Xcode/Android Studio). Local test phone numbers with OTP `123456`: `+91 9000000001`–`003`.

## Building & releasing (EAS)
`apps/mobile/eas.json` defines `development` (dev client, internal), `preview` (internal; Android APK), `production` (store, auto-increment, `production` channel). Fill in `submit.production.ios.ascAppId`, then:
```
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --profile production --platform all
```
OTA updates: `npx eas-cli@latest update --channel production`.

## Payments on mobile
Razorpay's React Native SDK needs a native module that is not bundled, so **Plans & billing** shows plans natively and opens the secure web billing page (`/app/billing`) in an in-app browser; the plan refreshes on return. The in-app browser does not share the app's session, so members sign in on the web page (same account) before paying.
**Store policy note:** Apple App Store and Google Play generally require their in-app purchase systems for digital subscriptions consumed in-app (with regional exceptions, e.g. user-choice/alternative billing programs and reader-app rules). Before store submission, choose one: (a) integrate StoreKit / Play Billing (e.g. `react-native-iap` + server receipt validation) for in-app purchases, (b) qualify for an alternative-billing program in India, or (c) remove purchase entry points from the app and manage subscriptions on the web only. This is a business/legal decision; the current build is suitable for development and internal testing.

## Verification (this milestone)
- `cd apps/mobile && npx tsc --noEmit` — 0 errors
- `cd apps/mobile && npx vitest run` — unit tests for API envelope/errors/refresh, SecureStore chunking, deep links, filters
- `npx expo export --platform ios|android` — both bundles build
- `npx expo-doctor` — 20/20 checks pass
Native device builds (EAS) and on-device QA are not yet performed.

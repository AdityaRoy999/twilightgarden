# Twilight Garden: project audit and upgrade plan

> This is the historical baseline. Read [the repair status](REPAIR_STATUS_2026-10-25.md)
> for subsequent code fixes, live database/function changes, validation and open work.

**Audit date:** October 25, 2026 (Asia/Kolkata). **Scope:** existing checkout, web setup, frontend, Supabase integration and Edge Functions, SQL, encryption, notifications, games, release scripts, and desktop/mobile configuration.

## What is running

The development app runs at **http://localhost:3000** using `npm run dev:local`. Dependencies were restored with `npm ci`: 694 packages installed. A separate build preview was checked on port 3001 and stopped after verification. The frontend connects to the already configured hosted Supabase project; a local database and local Edge Functions were not started.

Welcome and login render in the browser. The production build also renders its welcome screen. Hosted Supabase health and auth-settings endpoints return HTTP 200; email and Google auth are enabled. These checks establish reachability, not successful login, successful writes, or correct authorization.

### Verification baseline

| Check | Result | Evidence |
| --- | --- | --- |
| Clean dependency installation | Pass | `npm ci`, 694 packages; installed dependency tree resolves |
| Local development server | Pass | Vite 7.3.1; HTTP 200 at localhost:3000; welcome/login inspected |
| Production build | Pass with warning | 3,604 modules; 38–47 seconds across baseline/final builds; mixed static/dynamic encryption import warning |
| Production browser startup | Pass for public welcome | Built application inspected on localhost:3001 |
| TypeScript baseline | **Fail: 39 diagnostics** | [Full output](audit/typecheck.txt) |
| Unused-code diagnostics | **167 additional unused diagnostics** | 128 outside Remotion, 39 inside it; [full output](audit/unused.txt) |
| npm audit | **33 findings** | 6 critical, 18 high, 7 moderate, 2 low; [machine-readable report](audit/dependencies.json) |
| Supabase schema probes | Mixed | `daily_logs` exists; `logs` and `cycles` return 404/PGRST205; [results](audit/backend.json) |
| Encryption cache reproduction | **Fail** | New-recipient decryption fails with cached key and succeeds after clearing it; [result](audit/encryption-repro.json) |
| Authenticated user journeys | Not exercised | No account sign-in or health-data writes performed |
| Deployed RLS/webhooks/cron/secrets | Not established | Repository SQL reviewed; active database policies and deployed function configuration were not inspected |
| Android/desktop packaging | Not built | Configurations and release code inspected only |

Schema probes used the configured anon key and **`limit=0`**, returning no user records. They confirm API resource availability, not data isolation. No production data, schema, credentials, notifications, or cloud configuration were changed.

### Setup changes made

- Added `dev:local`, `typecheck`, and the Vite-compatible Node engine declaration to `package.json`; refreshed lockfile metadata without dependency upgrades.
- Added `.env.example` and corrected README setup, backend requirements, port, directory layout, and license statement.
- Renamed local `VITE_SUPABASE_SERVICE_ROLE_KEY` to `SUPABASE_SERVICE_ROLE_KEY`, and `VITE_SERPER_API` to `SERPER_API_KEY`, without printing values. Updated the four CLI scripts consuming the old service-key name, including `setup-bucket.js`. These variables are no longer browser-prefixed. A transformed development module was checked and contains neither the unsafe variable names nor those secret values.
- Added ignore patterns for environment variants, Firebase admin JSON, and private signing keys. **Ignore rules do not untrack files or remove historical commits.**
- Preserved the pre-existing modification to the Firebase administrator JSON. No feature refactor, visual redesign, dependency upgrades, credential rotation, or remote changes are included in this setup pass.

The project does not use Catalyst; its native Vite setup is the applicable local runtime.

## Findings that should lead the upgrade

**P0** means a release-blocking security/configuration exposure. **P1** means a significant privacy, data-integrity, or broken-feature issue. **P2** means important maintainability, performance, or UX work. **P3** means cleanup. A source defect is not automatically proof that the deployed application is exploitable; deployment-dependent risks are explicitly marked.

### S01 — P0: administrator and signing material is tracked

`git ls-files` includes `twilight-d25bb-firebase-adminsdk-fbsvc-f8af469968.json` and `twilight.key`. The former is administrator credential material; the latter is used by `scripts/release-desktop.js` as the updater signing key. Signing-key encryption/password strength and credential validity were not evaluated. Firebase's browser configuration in `lib/firebase.ts` is a separate, public configuration and should not be confused with an admin service account.

**Fix:** establish where these files have been shared; rotate/revoke exposed administrator credentials and plan signing-key rotation with the installed updater trust chain. Move private files outside the checkout/into a secret store, then remove tracking and address history. Adding `.gitignore` alone does not remediate past exposure. No keys were rotated during this audit.

### S02 — P0: service-role secret was browser-prefixed (setup mitigation applied)

The root `.env` contained `VITE_SUPABASE_SERVICE_ROLE_KEY`, and release scripts depended on that name. Vite exposes `VITE_` configuration to browser modules in development and can include referenced values in client bundles. This gives an administrator secret the wrong trust boundary even when application code does not explicitly import it. Search-provider secret configuration had the same issue.

**Fix applied locally:** server-only names and matching CLI consumers. Verify hosted build settings, older builds, development access, and repository sharing separately; rotation may still be necessary. See [Vite environment guidance](https://vite.dev/guide/env-and-mode).

### S03 — P0 if applied: FCM repair SQL opens token access

`supabase/repair_user_fcm_tokens.sql` defines a policy named “Service role can select fcm tokens” with `FOR SELECT USING (true)` and **no `TO service_role` restriction**. A policy's name does not constrain its role. Another policy permits inserts based only on `auth.role() = 'authenticated'`, without requiring `auth.uid() = user_id`. The regular migration contains stricter ownership checks, so applying the repair can weaken the schema.

**Fix:** replace conflicting policies with explicit, least-privilege ownership policies and inspect the live `pg_policies`/grants. Make token ownership unique as appropriate and handle device account switches. Active policy exposure was not tested by retrieving tokens.

### S04 — P1, deployment-dependent: privileged Edge Functions trust request payloads

`supabase/functions/push-notifications/index.ts` accepts caller-supplied `userId`, `record`, `noteId`, `message`, and `url`, then reads and updates data using the service role. It never verifies that the caller owns the message or belongs to the target relationship. `check-reminders` similarly runs an administrator-wide job without an in-handler cron/service authorization check. No checked-in `supabase/config.toml` documents deployed JWT requirements. A generic valid JWT would still not establish authority to notify an arbitrary user.

**Fix:** distinguish authenticated user requests from trusted webhooks/cron, verify the caller, derive target IDs server-side, and authorize before using an admin client. Test cross-user rejection and forged webhook bodies. Validate deployed gateway settings rather than assuming handlers are public. See [Supabase Edge Function security](https://supabase.com/docs/guides/functions/auth).

### C01 — P1: reproducible encryption shared-key cache collision

`lib/encryption.ts`, `deriveSharedSecret`, uses:

```ts
const cacheKey = `${ownPrivateKeyB64.slice(-20)}:${partnerPublicKeyB64.slice(-20)}`;
```

The serialized public JWK ends in common metadata. Three distinct newly generated keys produced one identical public-key suffix. A reproduction using the actual module established:

```json
{"differentPartnerKeys":true,"cacheIdentifiersCollide":true,"secondRecipientDecryptsWithCache":false,"secondRecipientDecryptsAfterCacheClear":true}
```

This can select an old derived secret after partner/device-key changes, explaining ciphertext that works only after reset/reload. **Fix:** key the cache by a digest of the complete public key and an unambiguous identity/key-version identifier; clear entries on rotation. Add regression coverage for multiple recipients, key rotation, and device restoration. [Reproduction source](audit/encryption-repro.mjs).

### S05 — P1: health data remains readable alongside encrypted payloads

`contexts/DataContext.tsx`, `addLog` and `updateSettings`, writes moods, symptoms, notes, flow, sleep, energy, and cycle settings into ordinary database columns as well as `encrypted_payload`. Its local cache stores decrypted logs/settings, and `CouplesContext` caches decrypted notes. Encryption is conditional on a partner key and decryption falls back to raw fields.

**Fix:** define the intended privacy model before migration. If health records should be end-to-end encrypted, use a user-owned record-key strategy, remove unnecessary plaintext copies, and handle exports, reminders, search, pairing changes, and recovery explicitly. If the backend must read selected fields, describe that boundary accurately. Merely adding an encrypted copy does not conceal the original.

### S06 — P1: public media plus fail-open encryption

`supabase_setup.sql` creates `chat-media` with `public=true` while claiming SELECT policies protect downloads. `CouplesContext.uploadMedia` obtains a public URL and uploads the original file when no partner key is available. `SecureMedia` falls back to displaying raw media when decryption fails. If that setup is active, unencrypted uploads are publicly retrievable by URL. Public download access does not become private because SELECT policies also exist; see [Supabase storage access control](https://supabase.com/docs/guides/storage/security/access-control).

**Fix:** require an encryption key before uploading private chat media; use a private bucket and authorized/signed access; record encryption version/MIME metadata; present a clear locked/error state when decryption fails. Confirm the live bucket configuration before migration.

### F01 — P1: the save flow hides failed writes

`pages/LogDetails.tsx`, `handleSave`, invokes asynchronous `addLog` without awaiting it and immediately calls `navigate(-1)`. `DataContext.addLog` catches errors, rolls state back, and resolves without reporting failure. `updateSettings` does the same, affecting onboarding and settings callers. The screen therefore cannot distinguish a successful save from a rollback.

**Fix:** propagate a typed result/error, await persistence, disable duplicate submissions, retain a draft, and stay on the form with a retry action on failure. Test server rejection, offline mode, and concurrent edits—not just the happy path.

## Security, privacy, and identity backlog

| ID / Priority | Evidence and consequence | Required change |
| --- | --- | --- |
| S07 / P1 | `lib/encryption.ts` exports private JWKs and stores them in Capacitor Preferences; `lib/storageAdapter.ts` uses an ordinary Tauri store file for sessions. Neither implementation provides the OS-backed encrypted credential storage claimed in `pp.md`. | Select secure storage per platform, threat-model browser storage separately, and migrate keys without silently losing history. |
| S08 / P1 | `lib/sync.ts:createSyncSession` uses `Math.random()` for a key-transfer token. `sendSyncPayload` selects only by token/status, with no expiration predicate or explicit same-user check in the client operation. Server-side policies/expiry enforcement are absent from checked-in migrations. | Use cryptographic tokens, short expiry, single use, same-account authorization, and rate limiting. Verify live RLS before assuming cross-account exploitability. |
| S09 / P1 | `pages/Settings.tsx:confirmUnlinkDevice` deletes a `user_keys` row and reports “Session removed successfully.” It does not revoke the device's Supabase session or erase a previously synchronized identity key. | Define actual device revocation; revoke sessions and rotate/restrict future key access. Do not promise revocation after a directory-row deletion alone. |
| S10 / P1 | `CouplesContext` uses unscoped `tw_cached_couple`/`tw_cached_notes`; auth trusts `twilight-cached-user` for immediate verified state. Cached data can appear before account/session reconciliation. | Scope caches by account, validate identity before private rendering, clear in-memory state on account changes, and test direct account switching. |
| S11 / P1 | `Insights` continually reuses a public health-card share code; `SharedCard` checks only the code, with no expiry check. Updating an existing card ignores the update error. Old links may expose newer health snapshots, or a failed update may share stale data. | Make sharing explicit, snapshot-based, expiring/revocable, and server-authorized; check persistence before revealing a link. Inspect public table policies for enumeration resistance. |
| S12 / P2 | `pp.md` and the rendered `pages/legal/PrivacyPolicy.tsx` describe different levels of detail. The rendered page claims account deletion via settings; no corresponding complete account-deletion flow was found in Settings/PartnerProfile. The static policy also calls AI data anonymized while code sends dated symptoms/history to an external model. | Align the served policy with actual data flows and retention/deletion features; verify consent and minimize the AI payload. This is an implementation consistency finding, not a legal compliance determination. |
| S13 / P2 | `lib/encryption.ts` uses static ECDH identities and AES-GCM; the checked-in Signal/pre-key SQL is not a ratchet implementation. PIN backups use PBKDF2, and the complete encrypted backup is downloadable by its owner. | Document the protocol accurately; review recovery strength, key confirmation, rotation, and forward-secrecy requirements with a suitable audited design. Do not call unused pre-key tables a working Signal protocol. |
| S14 / P2 | `CallContext` hardcodes shared public TURN credentials and exposes configured static TURN credentials to browsers. | Issue limited-lifetime TURN credentials from an authorized backend and monitor quotas. Public fallback entries do not guarantee connectivity. |
| S15 / P2 | Deep-link handlers in `index.tsx` and `App.tsx` log full incoming URLs, which can contain OAuth codes/tokens. Other console output includes push tokens and generated text. | Log event/status metadata only; redact authentication material and private content in all environments. |
| S16 / P1 | `scripts/test_push.cjs` embeds a VAPID private key and a concrete push subscription with authorization material. It sends a real notification when run. | Remove hardcoded private material from source, assess exposure/rotation, and use explicitly supplied test subscriptions and server-only environment values. The script was inspected, not executed. |

## Backend, schema, and API backlog

| ID / Priority | Evidence and consequence | Required change |
| --- | --- | --- |
| B01 / P1 | `supabase/functions/check-reminders/index.ts` queries `logs` and `cycles`; live zero-row probes returned 404 for both. The app writes `daily_logs` and `user_settings`. Query errors are ignored in several branches. | Rewrite reminders around the actual schema and handle query errors. Establish one prediction source. |
| B02 / P1 | Setup files ALTER core tables that they never create. The repo lacks a complete base migration and definitions for important RPCs such as `join_couple` and `unlock_love_notes`; `supabase/config.toml` is absent. | Recover the real schema, policies, triggers, indexes, storage rules, and functions into ordered migrations; prove a fresh database reset works. |
| B03 / P1 | `ai-generate` consumes `await req.json()` and then, in places mode, calls `req.clone().json()`. Cloning a consumed body throws before its `.catch()` can recover. Pharmacy lookup therefore fails before its upstream request. | Parse once, validate/destructure the body, and pass latitude/longitude from that object. |
| B04 / P1 if this SQL is deployed | `supabase/webhook_setup.sql` calls `net.http_post(url, body, '{}'::jsonb, 1000::integer)`. In the documented signature, argument four is JSON headers, not an integer timeout. It also omits webhook authorization. | Use named arguments and a trusted webhook credential; test the trigger in an isolated database. See [pg_net signature](https://supabase.github.io/pg_net/api/). |
| B05 / P2 | `ai-generate` receives an AI mood, but builds the prompt from only `customPrompt || search_query || ''`. A preset love-note mood without a custom prompt sends an empty prompt. | Resolve each supported mood to a controlled prompt and reject unsupported/empty modes. |
| B06 / P2 | All three Edge Functions lack a consistent method/body schema, payload-size validation, request budget, and structured failure contract. AI/search upstream calls have no server timeout. Raw upstream errors are returned to clients. | Validate inputs and lengths, restrict methods, enforce per-user quotas, use deadlines, and map internal errors to stable client-safe codes. CORS alone is not authorization. |
| B07 / P2 | The reminders job hardcodes IST and a separate schedule from mobile reminders. It reads two opt-in flags but does not apply the master `notifications_enabled` setting. Cycle-length sampling uses unordered `limit(5)` from the wrong table. | Store user timezone/preferences, use shared domain rules, and honor the full permission/preference contract. |
| B08 / P2 | Reminder deduplication uses only an in-memory Set during a single invocation. Retrying or overlapping hourly jobs can send the same reminder again. | Persist an idempotency key per user/reminder/date, use unique constraints, and record delivery attempts. |
| B09 / P2 | `check-reminders` deletes all notifications older than 24 hours on every run, regardless of type or whether they were read. | Separate retention cleanup from delivery, make retention explicit, and avoid deleting unrelated notification history. |
| B10 / P1 | `push-notifications` marks a note delivered after the send loop even if FCM has no tokens or all sends fail; several errors are logged before returning `{success:true}`. | Distinguish accepted, pushed, delivered, read, and failed states; do not claim device receipt from a failed provider attempt. |
| B11 / P2 | The FCM migration and `repair_user_fcm_tokens.sql` define different constraints, timestamps, deletion behavior, and policies. Repair-created tables may lack the `(user_id, token)` unique constraint required by frontend upsert. Realtime setup also blindly re-adds publication tables. | Consolidate into versioned migrations with explicit invariants and predictable re-run behavior. |
| B12 / P2 | `AdminContext` fetches all non-admin profiles and today's full health logs. It derives totals from the returned arrays, subject to the API's row cap, and provides no pagination/aggregate query. | Use paginated lists, server aggregates, minimal selected columns, and verified admin-only policies. Restrict access to health details according to the intended admin role. |

## Frontend behavior and data integrity backlog

| ID / Priority | Evidence and consequence | Required change |
| --- | --- | --- |
| F02 / P1 | `AuthContext` initializes `sessionVerified=true` from localStorage and preserves cached users on session errors. It is optimistic UI presented as verified authentication. | Separate cached display data from session verification and server-validated authorization. RLS must enforce access independently of router guards. |
| F03 / P1 | `AuthContext.onAuthStateChange` awaits `fetchProfile`, which performs another Supabase query while handling an auth event. A separate `initAuth` fetch runs too. This matches Supabase's documented async-callback deadlock hazard and can cause duplicate profile fetches/timeouts. | Keep the listener synchronous; schedule profile work outside it with cancellation/versioning. See [Supabase troubleshooting](https://supabase.com/kb/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0). |
| F04 / P1 | `PartnerForgotPassword` sends a link to `/#/partner/reset-password`, but no route handles it. The general recovery screen is under `PublicOnlyRoute`, which redirects once recovery OTP verification logs the user in. | Add a dedicated recovery route/state that survives the recovery auth event and completes password update; verify email-link and OTP variants. |
| F05 / P2 | `PartnerAuthCallback` changes any regular account visiting that callback into a partner, using a client profile update and auth metadata. | Represent role selection explicitly and validate permitted role transitions server-side; never rely on editable metadata to enforce privileged roles. |
| F06 / P1 | `DataContext` optimistically appends a new log, then its realtime INSERT handler appends the saved row without reconciling by `(user_id,date)` or ID. The pending optimistic object lacks the server ID. | Reconcile returned rows and realtime events using a stable mutation ID/unique date key; verify one log stays one row in the UI. |
| F07 / P2 | `DataContext` snapshot rollback can overwrite newer optimistic edits when concurrent writes finish out of order. Incoming realtime changes update state without consistently updating the cached logs/settings. | Serialize or version mutations, roll back only the failed operation, and centralize cache updates. |
| F08 / P2 | `LogDetails` initializes from `existingLog` but resets only when the date changes. If data arrives after mount, the form can keep empty/stale values. Its Reset button has no click handler. | Hydrate only untouched fields when data arrives, preserve dirty edits, and implement/reset-test the button. |
| F09 / P2 | `DataContext` maps and persists `sleep_hours` using `||`, losing a valid zero. `LogDetails` combines physical and digestion selections that both contain “Bloating” and “Nausea”, allowing duplicate symptom IDs. | Use nullish handling and normalize/deduplicate symptom arrays at the data boundary. |
| F10 / P1 | `cycleUtils.calculateCyclePhase` wraps elapsed days modulo average cycle length indefinitely. After a missed expected period it starts a new predicted cycle despite no new recorded start. Future start dates also wrap. | Track actual recorded cycle starts, distinguish prediction from observation, expose overdue/unknown states, and validate dates/settings. |
| F11 / P2 | `Dashboard`, `LogDetails`, `Insights`, `DataContext`, and other screens use `new Date().toISOString().split('T')[0]` as local “today”. This is the previous date before 05:30 in India. | Centralize local-calendar-date handling; test midnight, timezone changes, and app resume. Do not replace every date with UTC indiscriminately. |
| F12 / P2 | `useWidgetSync` separately hardcodes 28-day cycles and day-14 phase logic, reads nonexistent `cycleSettings.cycleLength` and `partnerData.current_mood/status/last_note/activity_streak`, and fabricates a seven-day streak fallback. The actual partner data shape is `{profile,settings,logs}`. | Use the canonical calculation and actual domain data; remove fabricated activity and define a typed widget payload. |
| F13 / P1 | `CallContext` registers handlers/cleanup in an effect depending on user/couple. Those functions capture render-time `callStatus` and `localStream`; later stream state is absent from the captured cleanup. Calls can retain media tracks or process offers using stale busy state. | Store live stream/call state in refs or stable event handlers; stop every acquired track on failures, hangup, route changes, and unmount. Test overlapping offers and interrupted calls. |
| F14 / P1, deployment-dependent | Call/game broadcast channels do not request private-channel authorization; payloads lack robust sender/session checks. A channel name containing a UUID is not an authorization mechanism. | Use private authorized channels, verify membership, and bind each signal to a call/game session. Inspect deployed Realtime policies. |
| F15 / P1 | Games such as TicTacToe read state, broadcast an optimistic next state, then update by `id` only. No version/current-turn conditional protects the mutation. A failed DB update leaves the other browser with a state already broadcast. Find-then-create session initialization also races. | Move legal transitions to an atomic server operation with an expected version; publish committed state or reconcile failed mutations. Enforce one active session with a database invariant. |
| F16 / P2 | Game errors are often ignored (`ConnectFour` initialization ignores returned errors); `lib/gameSessions.endSession` awaits a query without checking Supabase's `{error}` result. Catching only thrown exceptions misses database failures. | Check every result and use one typed mutation/error wrapper. |
| F17 / P2 | `CouplesContext.addReaction`, `toggleStar`, `togglePin`, and per-user deletion replace whole JSON arrays from local snapshots. Two clients can overwrite each other's changes. | Use normalized rows or atomic RPC/JSON operations with authorization and concurrency checks. |
| F18 / P2 | `disconnectCouple` performs message deletion, relationship deletion, and key-directory edits in separate client requests, with some errors ignored. Media blobs are not removed by this function. | Define retention and deletion semantics, perform related database operations transactionally, and handle storage cleanup/retry without leaving half-disconnected state. |
| F19 / P2 | Chat media and avatar uploads lack size/type validation in the inspected handlers. `EditProfile` deletes the old avatar before a replacement upload succeeds. | Enforce server limits, validate client inputs, upload/commit the replacement first, then clean up the previous object. |
| F20 / P2 | `Insights` hardcodes a production share origin when running on localhost; push defaults use `/love-lock` although the app routes are `/notes`, `/partner/notes`, and `/admin/notes`. | Centralize route generation and configured public origins; preserve role-specific navigation. |

## Notifications backlog

| ID / Priority | Evidence and consequence | Required change |
| --- | --- | --- |
| N01 / P1 | `lib/notifications.ts` calls `PushNotifications.register()` before attaching its registration listener, so a fast token event can be missed. The permission-denied mobile return leaves `pushRegistrationInProgress=true`. | Attach listeners first, always release the registration guard, and handle retry paths. |
| N02 / P1 | `pushRegistrationDone` is process-global rather than scoped to user/device. Auth logout does not reset it or remove the previous user's FCM association. Signing into another account in the same runtime can skip registration or leave old-account notifications active. | Make registration ownership explicit and perform account-change cleanup; test A → logout → B on the same device. |
| N03 / P2 | Native listeners are added by both push initialization and NotificationSettings without a shared cleanup contract; the Firebase `onMessage` unsubscribe is not retained. StrictMode/remounts and retries can accumulate handlers. | Provide one lifecycle owner with cleanup and per-user state. |
| N04 / P2 | Notifications are fetched/subscribed separately in `DataContext` and `useNotifications`, with different limits, field naming, and decryption behavior. The latter renders placeholder message text without decrypting `encrypted_payload`. | One typed notification repository/store, shared unread count, consistent decryption and delivery behavior. |
| N05 / P2 | `useNotifications.markAsRead` decrements unread count even for an already-read item and does not check update errors. NotificationSettings updates similarly ignore `{error}`. | Derive counts from state and reconcile failed persistence. |
| N06 / P2 | `scheduleDailyReminder(hour,minute)` ignores both arguments and schedules six daily reminders, while comments/settings suggest a single 8 PM reminder and the server uses a different schedule. | Make scheduling a preference-driven contract; remove misleading legacy parameters and comments. |
| N07 / P2 | `firebase-messaging-sw.js` focuses the first existing window without navigating it to the notification destination. New-window URLs also do not encode HashRouter routes. Both `sw.js` and the Firebase worker implement overlapping push/click handling. | Standardize on one worker, communicate the intended route to existing tabs, and construct correct hash URLs. |

## Frontend presentation, accessibility, and performance

### U01 — P2: onboarding gives decoration priority over the action

At a measured **390 × 844** viewport, the primary Track My Cycle button begins at **y=832**, Join as Partner at **y=908**, and login at **y=992**. The main action is almost entirely below the fold. The large carousel displays a mostly empty gradient; text, tags, and indicators consume additional stacked height. This is directly observed, not inferred from the screenshot alone.

![Mobile welcome screen showing the oversized carousel and clipped primary action](audit/welcome-mobile.png)

**Upgrade:** show a clear product promise and primary action immediately; give the illustration less height; make partner entry secondary and login easy to find. Use a deliberate desktop composition instead of stretching the mobile welcome stack.

| ID / Priority | Evidence and consequence | Required change |
| --- | --- | --- |
| U02 / P1 | `index.html` runs Tailwind Play CDN; Tailwind is not installed in package.json. `index.css` contains `@tailwind`/`@apply` directives but there is no build compiler for them. The browser warns about production use. Styles depend on runtime network/compilation. | Install a real CSS build pipeline, migrate the current config/tokens, and verify output with the CDN removed. See [Tailwind guidance](https://v3.tailwindcss.com/docs/upgrade-guide). |
| U03 / P2 | Browser inspection of Login found neither email nor password input has an associated label or autocomplete hint. Icon buttons expose names such as `visibility_off`/`arrow_back_ios` instead of meaningful action labels. | Link labels and fields, set appropriate autocomplete values, name icon controls, and expose status/errors to assistive technology. |
| U04 / P2 | Main mobile navigation in Layout has seven destinations. Many labels use 10–12px text, and the settings interface implements clickable div rows around read-only switches. Carousel dots are clickable divs. | Reduce primary navigation to a small set, move secondary features to More/sections, and use semantic keyboard-operable buttons/switches with adequate targets. |
| U05 / P2 | `Insights` globally removes chart/SVG focus outlines; modals such as LogDetailsModal lack dialog semantics, focus trapping/restoration, and Escape handling. Some other components do handle Escape, so this is not a claim that none do. | Restore visible focus, use accessible dialog primitives, and test keyboard-only navigation. |
| U06 / P2 | `ThemeContext` forces `MotionConfig reducedMotion="never"` while animations are enabled, overriding system reduced-motion preference. Welcome auto-advances every three seconds without a pause control. | Respect system preferences and pause animation/carousel motion on request, focus, or interaction. |
| U07 / P2 | Color decisions are spread across CSS variables, inline Tailwind config, raw hex values, global `.text-white` light-mode overrides, and separate theme checks. Autofill CSS forces white text even on a light surface. Config references tokens such as primary-dim/primary-glow/amber that are not defined in index.css. | Introduce semantic surface/text/status tokens and component states; remove global overrides that change unrelated content. Verify light/dark/autofill and custom accent contrast. |
| U08 / P2 | Manual chunks group PDF/canvas/date utilities and chart/animation UI into large shared bundles. Baseline build: vendor-utils **610.26 kB**, vendor-ui **511.80 kB**, two index chunks **334.64/337.59 kB** (uncompressed). Root providers and global overlays remain eager despite route lazy loading. | Measure initial requests, lazy-load export/map/tutorial/native features, and split by actual usage rather than an oversized shared bucket. Do not call all build chunks initial payload without measuring. |
| U09 / P2 | `public/` contains approximately **30.38 MB** of tracked files, including tutorial videos and large game JSON. Vite copies them into builds even if not used. Images/fonts/icons also depend on external hosts. | Inspect per-feature downloads, compress/host/lazy-load tutorial media and datasets, and bundle essential icons locally. Static assets are deployment weight, not automatically downloaded on first paint. |
| U10 / P2 | `public/manifest.json` points to `/icons/*.webp` with `image/png` MIME declarations. `icons/` is outside public and absent from `dist`; development serves these paths, hiding a build discrepancy. `sw.js` defaults to nonexistent `/pwa-192x192.png`. | Put install assets in public, correct formats/paths, and validate the production manifest/worker with the built preview. |
| U11 / P2 | `src-tauri/tauri.conf.json` ships a remote frontend URL and leaves `beforeBuildCommand` empty. Web UI changes can therefore arrive independently of the signed desktop binary; advertised version and loaded frontend can diverge. CSP allows broad connections and unsafe script modes. | Decide explicitly between bundled and remote UI, then align versioning, trust, offline behavior, capabilities, and security policy. A binary signature alone does not version a remote webpage. |

## Redundant, duplicated, and unnecessary code

The source inventory examined **117 app TypeScript/TSX files, 35,757 lines**, with **356 `as any` casts** and **336 console log/warn/error calls**. These are measured maintenance signals, not 692 independent defects. [Inventory](audit/inventory.json), [import graph](audit/graph.json).

### D01 — P2: TypeScript does not provide a dependable safety net

`npm run build` only runs Vite. The baseline has 39 TypeScript errors, but build passes. Root devDependencies omit `@types/react` and `@types/react-dom`; the handwritten Database schema omits generated relationship/type information expected by the installed Supabase client and omits some used RPC contracts. Several operations collapse to `never`. `DailyLog` requires server IDs even where callers construct new-log inputs without them. Root tsconfig also checks the separate Remotion project, whose React 18 setup differs from the app's React 19 setup. Strict checking and unused checks are not enabled by default.

**Upgrade:** separate application, Node scripts, Deno functions, and Remotion TypeScript projects; add the correct React typings; regenerate DB types from the real schema; introduce input/row models; fix baseline diagnostics before turning stricter checks into required CI gates. Avoid fixing these by adding more `any` casts. The full 39 diagnostics are supplied rather than duplicated here.

### D02 — P3: unused-code diagnostics

Enabling `--noUnusedLocals --noUnusedParameters` surfaces **167 unused diagnostics**, including 128 outside Remotion. Examples include unused `JoinPartner` and `PartnerNotifications` lazy declarations in App, layout animation definitions, and chart imports/state. This count includes intentionally unused parameters/imports and does not mean 167 removable components. Review [unused.txt](audit/unused.txt) before deletion; removing a reference does not necessarily reduce bundle size because production tree shaking already eliminates some unused code.

### D03 — P3: unused app modules

The import graph found no web-entry path to these modules, and a cross-check found no Remotion/script references:

- `components/RelationshipWeather.tsx`
- `components/tutorials/GamePreviews.tsx`
- `components/ui/Button.tsx`
- `components/ui/Card.tsx`
- `components/ui/ModernIcons.tsx`

`pages/JoinPartner.tsx` and `pages/partner/PartnerNotifications.tsx` are imported lazily but never mounted by a route. `GamePreviews` and `ModernIcons` are substantial implementations. Decide whether to adopt the shared primitives or delete them; keeping unused shared components while pages reimplement the same patterns compounds drift. Treat dynamic/string-based references and future product intent as a final deletion check.

### D04 — P2: repeated application scaffolding

| Repeated area | Evidence | Refactor boundary |
| --- | --- | --- |
| Game session lifecycle | 19 game screens repeat session lookup/create/join, realtime/broadcast subscription, ring cooldown, toast state, exit/restart, and status handling; game boards themselves differ. | One typed session hook/repository and shared shell, with game-specific rules/state kept separate. |
| Game route declarations | App manually declares every game under user/admin/partner prefixes. | Route metadata plus a clear role-aware wrapper. |
| Account flows | Separate Login/SignUp/ForgotPassword variants and partner callbacks have already drifted in recovery behavior. | Shared forms and an explicit role-selection/authentication flow. |
| Layouts | Layout, PartnerLayout, AdminLayout duplicate responsive navigation, sidebar storage, and presentation. | Shared shell with role-specific navigation definitions. |
| Notification state | DataContext, useNotifications, native notifications, Firebase foreground/background handlers overlap. | One delivery/state abstraction with platform adapters. |
| AI API clients | `lib/ai.ts` and `lib/wellnessAI.ts` duplicate session retrieval, headers, errors, and timeout setup. Search/places paths do not inherit the same timeout. | One authenticated bounded request client and typed mode-specific methods. |
| Cycle calculations | cycleUtils, widget sync, reminder function, and insight/history views implement different approximations. | One domain module with explicit observed/predicted dates and reusable tests. |
| Theme/styles | index.html and index.css repeat body/scrollbar styles; pages embed independent colors/styles. | Compiled styles, semantic tokens, shared components. |

### D05 — P2: oversized components and provider coupling

`CouplesContext.tsx` is 1,877 lines and combines pairing, chat persistence, cryptography, identity backup, device management, partner health data, realtime events, and polling. `LoveLock.tsx` is 1,692 lines. AnimatedIcons is 1,165 lines; Insights is 869; PartnerInsightsView is 764. App eagerly mounts auth, couples, calls, health data, tutorials, update/security overlays, and other global behavior even for public routes.

Split by domain/lifecycle, introduce service/repository modules, keep page components focused on rendering, and use stable/memoized context values or targeted stores. The aim is clear ownership and testable boundaries, not arbitrary file-length limits.

### D06 — P3: dependency cleanup candidates

- `motion` and `framer-motion` are both declared, while app imports use `framer-motion`; choose one direct API. They can share underlying packages, so this is not proof of two bundled animation engines.
- `react-is` has no direct web import but can be required transitively; check direct dependency necessity.
- `@types/leaflet` belongs with development typings, not application runtime dependencies.
- `dotenv` is used by CLI scripts; absence from app imports does not make it unused.
- Capacitor Android/SplashScreen packages have native configuration/tooling uses; do not delete them just because a browser import scan does not find them.
- `web-push` is a dev dependency used by a test script while the production delivery path uses FCM; archive/remove only if that workflow is retired.
- `vite.config.ts` still defines Gemini `process.env` substitutions even though AI now calls NVIDIA through Supabase. Remove this stale provider bridge after checking deployment expectations.
- The global minimatch override pins a 3.x range across dependent tooling; check each consumer's required API before changing overrides. `npm audit fix --force` is not an upgrade strategy.

### D07 — P3: assets and repository debris

`assets/icon.png`, `assets/splash.png`, and `public/twilight.png` are byte-identical (167,354 bytes each). Several native iOS icons are also identical, sometimes legitimately because asset slots share dimensions. Centralize source assets and generate required target sizes; do not blindly delete native target slots. A `(1)` phone SVG is another filename cleanup candidate, not a proven byte-identical duplicate.

Root files include old `ts_errors*.txt`, `errors.txt`, `tmp_diff*`, git-log dumps, Serper experiments/output files, `singed`, duplicate legal content, and multiple audit/marketing documents. Classify them as supported source, archived evidence, or disposable scratch. Check contents for secrets before any publication. No bulk deletion was performed.

### D08 — P2: no enforced quality workflow

No tracked CI workflow, lint configuration, or meaningful automated app test suite was found. The storage/push scripts are manual service exercises and may mutate cloud state; they are not an isolated regression suite. Edge Functions are excluded from root tsc without their own checked-in checking/test configuration. Existing production/part-two audit documents repeat claims that no longer match the code.

`scripts/cleanup_user.cjs` is particularly risky maintenance code: it hardcodes a specific account ID/email and immediately runs destructive database cleanup. It selects a service-role key if available and otherwise falls back to an anon key. Replace it with an explicit target argument, dry-run default, target/environment checks, and a deliberate execution gate; never include it in setup or routine verification. It was not executed.

Introduce focused domain/integration checks, an isolated test database, required typecheck/build/lint gates, and a maintained issue list. Preserve useful historic evidence but supersede stale claims.

## Dependency findings: how to interpret them

The registry audit was run against this lockfile on October 25, 2026. Counts include transitive and build/native dependencies, not just browser runtime vulnerabilities. They are severity labels from npm advisories, not proof that all paths are exploitable in this product.

Direct packages flagged include `@capacitor/android` (critical), `jspdf` (critical), `react-router-dom` (high), `vite` (high), and `@capacitor/assets` (high). The machine-readable report contains advisory URLs, affected dependency paths, and `fixAvailable` information for every finding. Several findings have no npm-suggested fix on their current path, including native asset tooling. Resolve in small compatible groups and verify web/native build behavior after each group; do not suppress findings with a broad override or force-upgrade the entire tree.

## Findings in older audits that should not be repeated unchanged

- Shared health-card codes currently use `crypto.getRandomValues`; the old claim that this code uses `Math.random()` is stale. The still-current `Math.random()` problem is the **identity sync token** in `lib/sync.ts`.
- Auth logout currently clears `tw_`/`twilight` localStorage keys and the in-memory encryption cache; a blanket claim that no auth cache cleanup exists is wrong. Native key retention, token ownership, and account-switch state still need review.
- The Insights injected stylesheet is guarded by an ID, so it does **not** add a new duplicate on every mount. Its global removal of focus outlines is the actual current problem.
- The UI already has lazy route imports; calling the entire router eagerly loaded is inaccurate. Global providers/overlays and chunk grouping still need work.
- React escapes ordinary interpolated text. Missing length validation is not automatically an XSS finding.
- Native confirmations do not universally fail on every WebView. Verify actual platform behavior before labeling all uses critical.
- The Rust desktop wrapper already installs a single-instance plugin. Do not report it missing based on old comments.
- `cycleUtils` uses `Math.round` across local-midnight dates; a broad claim of inevitable DST corruption is not established. The UTC/local “today” mix and modulo overdue behavior are direct, reproducible problems.

## Upgrade order and acceptance criteria

### Phase 1: recover a secure, reproducible foundation

1. Handle tracked administrator/signing material and hosted environment exposure; inspect live RLS, FCM policies, storage, RPC permissions, and function authorization.
2. Fix the encryption cache collision and preserve compatibility with existing encrypted history.
3. Capture the deployed schema into complete migrations and generate accurate database types. Make app/Remotion/Deno type projects independent and resolve the 39 baseline diagnostics.
4. Add compiled Tailwind, correct production assets, and require typecheck/build. Upgrade vulnerable dependencies in validated groups.

**Acceptance:** a fresh checkout installs deterministically; a fresh test database boots from migrations; no private secret is browser-prefixed; nonmembers cannot access or mutate test users' data; public pages work without Tailwind CDN; build and required checks pass.

### Phase 2: repair core tracking and identity flows

1. Fix authentication reconciliation, role selection, recovery routes, logout/account switching, and device revocation semantics.
2. Make log/settings saves awaitable and recoverable; reconcile optimistic/realtime events and avoid lost concurrent changes.
3. Centralize date/cycle rules, add overdue/unknown states, and align widgets/reminders/insights with actual recorded data.
4. Fix reminders' schema, places parsing, AI prompts, notification preferences, idempotency, and delivery-status semantics.

**Acceptance:** signup → verify → onboarding → save log → refresh preserves data; failed writes retain the draft; recovery completes; A/B account switching shows no stale private state; timezone/resume scenarios are consistent; one action produces one intended reminder/event.

### Phase 3: simplify the architecture

Extract couples/identity/chat/data repositories, shared layouts/auth forms, typed notification state, and the game-session lifecycle. Remove confirmed dead modules and scratch artifacts only after reference checks. Make game moves atomic and validate relationship/turn ownership on the server. Define the supported web, Android, and desktop feature matrix.

**Acceptance:** shared fixes propagate across roles; game clients converge after failures; key restoration/device changes preserve history; realtime subscriptions have identifiable owners and cleanup.

### Phase 4: redesign the experience

Keep a recognizable rose accent but use a calmer surface system, clearer typography, fewer decorative gradients, readable labels, and consistent interaction states. Prioritize **Welcome, Login/SignUp, Today dashboard, Log Details, Calendar, and Settings**, then extend to partner/chat/wellness/games. Put Today, Calendar, Insights, and a small number of core destinations in mobile navigation; secondary entertainment/account features can live behind a clear More section. Provide useful empty/error/offline states before animation.

Build reusable Button, Field, Card, Dialog/Sheet, navigation, and feedback primitives rather than maintaining unused primitives next to one-off markup. Verify keyboard, screen-reader labels, reduced motion, light/dark modes, narrow/mobile widths, and desktop layouts. Use the supplied mobile evidence as the current baseline, not as a target design.

**Acceptance:** the primary action is visible on a normal mobile viewport; forms and dialogs work by keyboard; no unexpected horizontal scroll; date/data labels remain readable; charts have accessible descriptions; optional heavy features do not inflate the entry experience unnecessarily.

## Limits of this audit

This is a deep source/configuration audit with targeted live checks, not a guarantee that every defect is enumerated. Protected dashboard/chat/games/admin screens were reviewed in source but not exercised with signed-in accounts. OAuth redirects, email recovery, FCM delivery, microphone/camera, native builds, cloud deployment settings, and live database authorization need controlled account-based testing. No external AI/provider request containing health data was made. The report distinguishes confirmed behavior, source-level defects, maintenance candidates, and deployment-dependent security risks so upgrades can proceed without treating assumptions as facts.

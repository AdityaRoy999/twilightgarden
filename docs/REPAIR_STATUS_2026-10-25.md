# Concrete repairs and remaining work

This is the current status; [the original audit](PROJECT_AUDIT_2026-10-25.md) records
the baseline before these changes. The broad redesign has been deferred.

## Implemented

- Reproducible npm lockfile, React 19 types, generated live Supabase types, separate
  web/Deno/Remotion type boundaries, and a build that runs TypeScript validation.
- Compiled Tailwind and plugins replace the production CDN script. Theme opacity,
  dark surfaces, focus indicators, reduced-motion preferences and public app icons
  work with the compiled stylesheet. The welcome actions fit a 390×844 viewport.
- Compatible dependency upgrades, narrow patched transitive dependencies, removal
  of unused `motion` and obsolete `@capacitor/assets`: **npm audit reports zero
  vulnerabilities**, including development dependencies, on the repaired lockfile.
- Browser configuration no longer consumes administrator/provider secrets.
  Administrator JSON and updater signing material have been removed from Git's
  index, preserving the local files. Removed obsolete push-test credentials,
  hardcoded account-deletion script, checked-in debug dumps and five unreferenced
  UI modules. Production console/debugger calls are stripped.
- Auth waits for the authoritative profile, rejects editable metadata as a source
  of privileges, handles stale account responses, fails closed on profile errors,
  and routes password recovery to its own screen. Account changes remount private
  provider state. Callback visits no longer change existing account roles.
- Daily-log/settings saves persist before reporting success. Failed saves retain
  the draft and expose errors. Reset works; symptom duplicates are removed; zero
  sleep hours survive mapping. Local dates and midnight/resume updates are shared.
  Overdue predictions no longer invent a new recorded cycle; progress is bounded
  and overdue labels are explicit. Historical calendar cells do not invent a
  menstrual phase before the known cycle start.
- Encryption's shared-secret cache hashes both complete keys, fixing reproducible
  recipient collisions. Logout cancels stale identity initialization. Device keys
  are no longer silently deleted when another device signs in. Sync codes use
  cryptographic randomness; their QR codes render locally. Sync responses carry
  the actual sender key, restore both identity keys, and release subscriptions.
- Chat uploads require encryption and validate type/size. Notes persist storage
  references; short-lived signed URLs open the private bucket. Decryption failure
  shows a locked state instead of displaying/downloading raw encrypted data.
  Avatar uploads validate format/size and preserve the saved avatar during upload.
- One account-scoped notification provider replaces duplicated stores, counts all
  unread rows, follows realtime updates and persists read state before updating UI.
  Device registration follows an explicit permission action, resets on logout and
  guards account-switch races. Removed duplicate client chat pushes and local
  reminder generators. Notification clicks preserve HashRouter routes.
- Call signaling uses private channels, call IDs and sender checks. Refs own media
  tracks and current status; cancelled permission prompts stop late streams,
  unmount stops active tracks, and unanswered calls time out. Public demo TURN
  credentials were removed; cross-network calls need the configured TURN service.
- Share links use unguessable replacement codes and a 24-hour expiration. Anonymous
  clients can fetch one unexpired snapshot by code through a restricted RPC; they
  cannot enumerate the table. Creating a new link revokes the previous link.

## Applied to the live Supabase project

Project `awijrkxrhlisixufiukw` was inspected using the owning account. Seven repair
migrations are checked in with timestamps matching the remote history; the prior
deployed migration history was fetched, and old standalone snippets were moved
outside the migration directory.

- Replaced permissive/duplicate RLS policies with explicit ownership, active-couple
  membership and consent checks. Removed anonymous profile, FCM-token and public-key
  enumeration; restricted notification and note-key writes and identity backups.
- Prevented signup metadata and self-updates from assigning administrator roles.
  Pairing runs under row/advisory locks, checks authoritative account roles,
  expires pending codes after 24 hours and prevents simultaneous active pairings.
  Only the tracking account can enable health-data sharing. Recipients cannot
  change another sender's note content or ownership.
- Hardened security-definer search paths and execution grants. Internal cleanup,
  budgeting and reminder RPCs cannot be called by anonymous/authenticated clients.
  Sync sessions expire and cannot have their identity or creation time rewritten.
- Added seven missing foreign-key/supporting indexes; removed five verified exact
  duplicate non-unique indexes. Consolidated policy auth checks. Retained indexes
  merely marked unused because a short observation window does not prove redundancy.
- Added private Realtime authorization policies; call/game/broadcast clients use
  private channels. Avatar folders require ownership; chat storage requires couple
  membership and remains private.
- Deployed authenticated AI, push, reminder and health-check handlers. Secured both
  legacy misspelled endpoint URLs as well. AI has verified-user rate limits,
  bounded inputs, one parsed request body, coordinate validation and timeouts.
- The database chat webhook uses a random Vault-backed credential, synchronized
  to Edge Function secrets without committing its value. Push recipients are
  derived/verified server-side. Provider acceptance is no longer called delivery.
- Reminder processing uses the actual schema, per-account time zones/preferences,
  idempotent notification keys and bounded retry leases. An authenticated cron job
  runs every 15 minutes and delivers within each configured local reminder hour.
  Retention maintenance runs daily instead of every minute. Health checks measure
  actual responses and use the correct live website instead of fake latency.

## Verification

- Unit/component regression coverage: encryption identity/cache isolation, local
  dates/DST/overdue estimates, pending and rejected saves, metadata privilege
  rejection, stale auth responses, call cleanup and private media failure handling.
- Live synthetic-account checks: role escalation rejected; logs persist across
  reads; zero hours preserved; unrelated data/token reads and writes blocked;
  notifications restricted; valid pairing works; ghost mode hides health data;
  a partner cannot re-enable sharing; private media works for members and fails
  for outsiders; avatar path ownership enforced; share enumeration blocked and
  expiration enforced; unrelated users rejected from private call channels.
- All six privileged Edge Function URLs reject anonymous POSTs with 401. Deno
  checks all four canonical function sources. Rolled-back SQL assertions verify
  request-budget limits, reminder deduplication/completion and internal RPC grants.
- Browser verification used a temporary synthetic account: login, dashboard,
  daily-log save, reopening and full-page reload preserve the saved note. Mobile
  welcome actions, labels and horizontal overflow were checked. No real user
  health records were used for tests. Test accounts and storage objects are removed.
- GitHub CI checks clean installation, dependency audit, tests, web build/typecheck
  and Deno sources. It does not need production credentials or mutate the live DB.

## Still open — do not treat this as a complete security or product sign-off

1. **Rotate previously published credentials.** Removing files from the current
   tree cannot revoke secrets in public Git history or already installed binaries.
   Firebase administrator credentials and updater signing material require an
   owner-controlled rotation and a compatible updater trust transition. Review
   Supabase/provider keys and hosted environment variables as well. No force-push
   or incompatible signing-key replacement was performed.
2. **Privacy protocol/storage migration:** health logs/settings still retain
   plaintext columns alongside encrypted payloads, and local identity storage uses
   Capacitor Preferences. RLS now restricts access, but this does not establish
   end-to-end encryption of all health data. A recovery-compatible migration and
   secure native key storage need dedicated implementation and platform tests.
3. **Game correctness:** channels and membership are hardened, but the 19 game
   implementations still duplicate lifecycle logic and rely on client-generated
   boards. Atomic moves, legal-move validation, simultaneous-answer privacy,
   rollback convergence and two-client tests remain required. Removing unused
   components does not resolve that shared architecture.
4. **Device management:** deleting a public-key route does not revoke a Supabase
   auth session or erase a device's cached keys. The UI must not promise full device
   revocation; real revocation requires session-to-device mapping and key strategy.
5. **Hosted settings:** enable leaked-password protection where the Supabase plan
   supports it, review auth redirects/mail templates, enforce private-only Realtime
   in project settings, and finish credential/environment rotation. The connector
   does not expose these settings. Vercel CLI is not authenticated in this session;
   the existing GitHub integration supplies deployment builds/statuses.
6. **Fresh database/bootstrap:** the historical migrations assume manually created
   base tables. Docker was unavailable for a full local database verification.
   Do not run loose repair SQL or blindly replay the history against an empty
   database. Localhost currently uses the configured hosted backend.
7. **Product/platform follow-up:** overhaul duplicated auth/layout/game code,
   correct remaining historical chart/statistical assumptions, further reduce
   initial bundles, finish consistent accessible dialogs/forms, and redesign the
   frontend. OAuth/email recovery delivery, real FCM delivery, two-device camera/
   microphone calls, Android packaging and signed desktop updates need platform
   acceptance tests; these were not proven by a web build.

Supabase's remaining security-definer advisories include intentionally exposed,
restricted pairing/share/RLS helper functions; the private internal tables have
deny-by-default RLS and no client grants. Review these exceptions rather than
silencing them. Relevant guidance: [function execution grants](https://supabase.com/docs/guides/database/linter?lint=0028_anon_security_definer_function_executable),
[password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection),
[private Realtime](https://supabase.com/docs/guides/realtime/authorization).

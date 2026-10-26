# Twilight: chat, device recovery, navigation and cycle synchronization

This continues the [initial repair audit](REPAIR_STATUS_2026-10-25.md). It does
not claim that every historical feature has been redesigned or independently
security audited.

## Concrete fixes

- Replaced three duplicated application layouts with one responsive shell.
  The desktop sidebar uses 80px collapsed / 240px expanded widths; mobile exposes
  Today, Calendar, Insights, Chat and a More sheet. Chat header and composer now
  stay inside the content column, above mobile navigation. Dialogs trap keyboard
  focus, controls have labels, and the composer handles IME input correctly.
- Replaced four duplicated login/signup implementations with one auth screen.
  Added consistent form labels, autocomplete, password visibility, signup account
  choice, inline errors, email-code verification and resend cooldown. Existing
  roles remain authoritative; partner OAuth selection only applies to an explicit
  fresh signup flow. Email delivery/Google/native deep links still need provider
  acceptance tests.
- Added explicit recorded period starts. Saving a start and its log/settings is
  atomic. Editing/removing a marker updates the stored latest start. Ordinary flow
  days no longer reset the cycle. Historical calendars use applicable recorded
  starts; invalid dates, dates before known history and irregular cycles do not
  fabricate predictions. Zero sleep hours survive mapping. Tracker and partner use
  the same phase logic; server reminders also honor irregular-cycle mode.
- Centralized initial/live partner health mapping and coalesced invalidations.
  Sharing disabled by the tracker clears partner state, with database RLS enforcing
  the consent boundary.
- Added private database-triggered chat broadcasts, stable message IDs, idempotent
  sends, bounded encrypted retry outbox, deterministic pagination and reconciliation,
  monotonic receipts and foreground/network catch-up. Healthy subscriptions no
  longer depend on a three-second poll. Messages appear optimistically while the
  server persists them. Old plaintext chat caches are removed; plaintext chat is
  retained in memory only, while queued sends store ciphertext.
- New devices cannot overwrite the canonical encryption identity. They restore
  the same identity with a recovery passphrase or a same-account trusted-device
  code. Restoring verifies the canonical public key, installs both local keys,
  registers the device, then decrypts history. Removed artificial recovery delays
  and a race that skipped registration during initialization. New passphrase
  backups use versioned PBKDF2-SHA256 with 600,000 iterations and AES-GCM; older
  backups remain readable. Device registrations now load independently of cached
  profile data. Removing a registration is explicitly not session revocation.
- Identity fingerprints normalize JWK metadata and match in either partner order.
  Verification no longer shows a verified badge before a matching comparison.
  Camera scanning uses lifecycle cleanup and inline failures; pasted-code
  comparison also works.
- Call signaling, including SDP and ICE candidates, is encrypted. Buffered ICE
  avoids candidates arriving before their offer; call IDs and deterministic glare
  handling isolate simultaneous calls. Connected means the media transport is
  connected. Hangup/signout release tracks and peers; reconnect requests and ICE
  restarts handle network changes. The call UI exposes measured round-trip time.
- Replaced static ExpressTURN credentials with the authenticated, rate-limited
  Cloudflare credential endpoint. Credentials stay in memory and refresh during
  longer calls. See [Cloudflare setup](CLOUDFLARE_TURN_SETUP.md).
- Added a dataset epoch so a reset invalidates stale application caches and keys.
  Retained login accounts can recreate minimal profiles and begin onboarding again.

## Verification evidence

- TypeScript, 35 automated tests, production build, all five Edge Function type
  checks, secret scan and dependency audit. Dependency audit reports zero known
  vulnerabilities at verification time.
- Live synthetic accounts: private pairing completion; canonical identity guards;
  20 encrypted message broadcasts; idempotent retry; receipt monotonicity; outsider
  denial; atomic period save, zero values, shared dates and ghost-mode enforcement.
- Observed sender-request-to-receiver-decryption latency over 20 messages:
  median **101ms**, p95 **133ms**, maximum **198ms**. This measures this environment
  and connection, not an SLA or a comparison benchmark against WhatsApp.
- Browser checks on isolated tracker/partner sessions: real UI sends in both
  directions, decrypted history after reload, matching fingerprints, successful
  pasted comparison, passphrase recovery, and trusted-device recovery. Mobile
  composer fits a 390×844 viewport without horizontal page overflow. Desktop
  expanded/collapsed navigation and mobile More destinations were checked.
- Browser WebRTC used real private signaling and generated media: voice packets
  received on both peers; video decoded in both directions; direct local RTT around
  0–1ms; hangup closed both peers and left zero live local tracks. No physical
  microphone/camera or different-network quality claim follows from this test.
- The old ExpressTURN server returned 401 and no relay candidates. It has been
  removed from the code and local environment. Cloudflare requires the owner's
  credentials before a successful forced-relay test can be performed. The deployed
  endpoint rejects unauthenticated/outsider requests and reports missing
  configuration explicitly rather than pretending relay support is available.

## Database reset

The user authorized clearing application user rows while keeping login accounts,
schema, RLS and configuration. The reset is an operational action, not a migration
that would delete future production data when replayed. It clears profiles,
settings, logs, relationships, messages, encryption registrations/backups, device
links, shared cards, notifications, push tokens/subscriptions, games and operational
activity. User avatars/chat attachments are removed through the Storage API.
Release records/assets and the dataset revision record remain. Roles are retained
in trusted auth metadata for existing logins. Newly created QA accounts are removed
separately. Verification counts are recorded after the reset below.

Reset completed on 2026-10-26 after production deployment of merged
[PR #2](https://github.com/AdityaRoy999/twilightgarden/pull/2)
(application commit `032722eb60102d2906375b3976b5ecdd408d3c2f`). Exact verification
found **zero rows in all 18 application/activity tables**, including the two
private budget/reminder tables. Removed **11 avatar files and 20 chat attachments**;
both user storage buckets now contain zero objects. Preserved **11 existing login
accounts**, **3 release records**, **4 release files** and the dataset revision
configuration. All three synthetic QA accounts were removed before the reset.
Scheduled monitoring can create new operational checks after this verification;
new sign-ins intentionally recreate only that account's fresh profile/onboarding.

## Remaining boundaries

- Cloudflare credentials and physical two-device relay/media acceptance testing.
- The chat cryptography uses a stable shared identity, not Signal's double ratchet
  or forward-secret per-device sessions. Web/native Preferences storage is not an
  OS credential vault. A removed registration cannot erase already copied keys or
  terminate an existing Supabase session. A full security architecture change
  needs migration and a separate cryptographic review.
- Health rows and local health caches still have plaintext fields protected by
  database authorization; chat encryption does not make all health storage E2EE.
  Partners can retain data they were previously permitted to read.
- Historical secret rotation, leaked-password protection and native push/mail/OAuth
  acceptance remain as described in the earlier report. Supabase still reports
  [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Nine intentionally callable security-definer helpers and the anonymous share
  lookup remain flagged for review. They enforce explicit auth/membership or
  unguessable share-code boundaries. Private budget/reminder tables intentionally
  have no client policies/grants. See [function grants](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Performance advisors report only informational unused-index notices (19 at the
  check), including indexes protecting fresh/rare paths. A small reset database is
  insufficient evidence to drop those indexes. See [unused-index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
- The historical migration baseline still assumes manually created initial tables;
  a full new local Postgres bootstrap was not proven without Docker. Local web uses
  the hosted Twilight backend.
- Multiplayer games still need atomic server move validation and simultaneous
  answer privacy. Remaining chart assumptions, native packaging/updater acceptance,
  and broader visual refinement remain outside the repaired chat/auth/date paths.

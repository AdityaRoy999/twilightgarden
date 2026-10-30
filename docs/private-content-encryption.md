# Private content encryption

The app encrypts private content in the client, before it reaches Postgres or
object storage. This is an implementation description, not an independent
cryptographic audit or a claim that all metadata is hidden.

## Content and recipients

| Content | Key and processing |
| --- | --- |
| Health logs, dates, cycle settings, profile, avatar, private preferences | Personal account vault; per-record AES-256-GCM keys wrapped by its random master key |
| Explicitly shared health and profile | Separate per-record key envelopes for the current partner using P-256 ECDH + HKDF-SHA-256; personal master key is never shared |
| Chat, attachments, GIF references, replies and reactions | Existing conversation ECDH/AES-GCM identity, protected separately from the personal vault |
| Call signalling and reactions | Encrypted conversation signals; WebRTC encrypts peer media |
| Game state, moves, answers and stored generated questions | Encrypted room state and commands; the host device alone decrypts the hidden answer state |
| AI, map, GIF and shopping requests | Explicit external-service exceptions; the chosen provider receives the submitted context/query |
| Rights/safety reports | Category and receipt only until an operator encryption key/contact is configured; free-text private reports are disabled |

The backend retains login identifiers, account roles, consent and age eligibility,
connection membership, record kinds/IDs, ciphertext lengths, revisions, update
times, delivery/read routing, game type, push tokens and request categories.
These are operational metadata. Exports and screenshots are plaintext under the
user's control. TLS/storage encryption are additional safeguards, not E2EE.

## Vault recovery and device storage

Setup generates a random 256-bit master key and an independent P-256 sharing
identity. A separate backup password (minimum 12 characters) wraps that bundle
using PBKDF2-SHA-256 with 600,000 iterations, a random 16-byte salt and AES-GCM.
Fresh 96-bit nonces are generated for every encryption. Authenticated context
binds envelopes to their account, vault epoch, record kind and opaque record ID.
Dates are inside ciphertext; opaque HMAC IDs avoid plaintext date indexes.

iOS uses Keychain and Android uses Keystore-backed storage through the pinned
Capacitor secure-storage plugin. Its insecure web fallback is never used.
Browsers wrap local credentials with a non-extractable CryptoKey in IndexedDB;
this does not protect an unlocked application against malicious same-origin
code, browser extensions or an attacker controlling the device. Logout clears
unlocked keys and decrypted avatar URLs. Remembered keys remain device-protected
for later login, bound to account/data/vault epochs. A new device needs the backup
password. There is no administrator decryption or forgotten-password recovery.

Personal vault keys survive partner disconnect. Chat identities and backups are
reset by disconnect, and a new connection needs fresh chat backup setup. Health
sharing is independently opt-in; RLS, active-session checks and key envelopes all
apply. Consent withdrawal/unlink revokes server access and removes sharing
envelopes. Already decrypted, exported or copied information cannot be recalled.
An unlocked owner must be online to grant old records to a newly linked partner.

Peer public keys are pinned on first use for each connection. The connection
verification code includes both chat and personal-vault public keys. Users must
compare it through a trusted channel to detect a substituted initial key. There
is no public key-transparency service or double-ratchet/forward-secrecy claim.

## Games and reminders

The server coordinates membership, durable encrypted commands and compare-and-
swap revisions. It cannot validate readable game rules. The host's unlocked game
screen processes the existing rules, and both players get encrypted state. A
modified host can cheat or inspect hidden inputs; these are cooperative,
non-monetary games, not an adversarial game-integrity protocol. Suspended hosts
must reopen their game before queued moves can complete. Realtime applies moves
immediately; the recovery poll is only for missed events.

AI questions are generated in an explicitly consented transient service request
and encrypted by the host before storage. They are not stored as readable game
secrets. Health predictions/reports/charts run on the device. Native health
reminders are scheduled locally for the next seven days and refreshed when the
app opens or logs/preferences change; notification text is generic. The cloud
cleanup job no longer reads cycle dates. Closed-app remote iOS calls still
require APNs/PushKit/CallKit and appropriate Apple provisioning; this encryption
change does not enable those capabilities for a free Apple ID.

## Storage boundary and reset

`private_records` contains only envelopes and routing metadata. Atomic encrypted
batches use revision checks to prevent stale saves overwriting another device.
Legacy health writes are disabled, old game APIs return an update-required error,
profile fields cannot be repopulated as plaintext, and plain avatars are retired.
Backend deletion still removes records and storage without needing content keys.

The requested reset keeps login accounts, schemas, security configuration and
release files. It clears application profiles, health/history, connections,
messages/media, games, vault/chat backups, registered keys, privacy choices and
device tokens, revokes current sessions and advances the dataset epoch. Provider
backup retention/CDN copies cannot be proven immediately erased by a row reset.

Verification: `npm test`, `npm run build`, Deno checks, `npm run verify:ui`, and
`node scripts/verify-private-vault.mjs`. The live verifier creates synthetic users
only and exercises the real encryption facade, recovery, RLS, sharing withdrawal,
encrypted game transport, revision conflicts and unlink. Runtime measurements
are saved in `tmp/verification/private-vault-live.json` (excluded from Git).

## Performance boundaries and measurements

Own-account ciphertext reads use a bounded 2 MiB, five-second memory cache and
deduplicate concurrent requests. No decrypted history is persisted. Writes,
realtime changes, account changes and vault switches invalidate it. Partner
reads always recheck database authorization; they are not served from this cache.
Derived CryptoKeys are bounded in memory and cleared with the vault. Profile
and preferences requests run in parallel. Recovery code is loaded on demand.

RLS constant session checks run once per statement. Indexes support record
ownership, recipient routing and pending game commands. Host moves use one CAS
transaction. Private realtime broadcasts contain only a change hint, never state;
receivers fetch committed state from the database. PostgreSQL events and the
durable outbox remain recovery paths. A peer cannot forge authoritative game
state by broadcasting a revision.

On 30 October 2026, a small synthetic live test from this Windows machine to the
Mumbai database observed 77.8 ms for a cold history read and 0.77–1.04 ms for
three cached reads (one encrypted log). Seven game commits took 45–57 ms.
Three host-to-peer moves took 194–235 ms; three guest-to-host moves took
403–612 ms. Earlier measurements without hints were 387–666 ms and
698–1348 ms respectively. These are observed low-sample timings, not latency
guarantees or load-test results. Weak networks, suspended hosts and device
performance still affect delivery. Do not weaken key derivation, consent checks
or encryption to improve a benchmark.

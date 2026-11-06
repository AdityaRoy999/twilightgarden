# Recover a private space

Each account has one personal vault and one backup password for records and
chats. Sign-in authentication and vault decryption remain separate.

## Use another unlocked device

1. Sign into the same account on the new device.
2. Choose **Forgot backup password? → Use an unlocked device**.
3. Keep the new device open. It displays a 16-character code for five minutes.
4. On the already unlocked device, tap the approval notice, or go to
   **Account → Account backup password → Approve another device**.
5. Enter the code shown on the new device and explicitly approve it.
6. The whole vault opens on the new device, including the account's chat
   recovery envelope. No second chat password is introduced.
7. To replace a forgotten password, open account backup settings on either
   unlocked device, choose **I forgot my current password**, and confirm the new
   password twice. This rewraps the same keys without deleting records.

Approval is available in the foreground while the trusted device is signed in
and unlocked. It does not send SMS or require a mobile number. Never approve a
request you did not initiate. An attacker controlling an unlocked device can
read data and change its backup password; device locks still matter.

## No unlocked device

Choose **No unlocked device? Reset encrypted data**. Read the deletion scope,
request an email code, enter that code, tick the explicit deletion confirmation,
and press **Permanently reset encrypted data**. Merely sending an email, entering
a code, or opening a sign-in link does not delete anything.

The server verifies the code for the authenticated user's actual email. It
rejects stale vault epochs, invalid/reused email codes, anonymous requests and
direct calls to the service-only deletion functions. Email requests are limited
to three per hour and verification attempts to five per hour, in addition to
Supabase Auth's own limits.

All sessions are revoked before cleanup. The reset disconnects the relationship
and removes the owner's encrypted records, vault and chat recovery keys,
device-key registrations, notifications, device tokens and owned media; shared
chat and games are removed for both participants. The peer's personal vault is
preserved. Login identity, declared age/consent evidence and rights requests stay.
A failed physical cleanup stays queued; the account remains disabled until the
scheduled cleanup succeeds. Sign in again afterward to create a fresh vault and
password. This cannot recover old encrypted records or erase offline exports.

## Deployment and evidence

Apply both `vault_device_recovery` and `vault_recovery_rate_limits` migrations.
Deploy `vault-recovery` and `check-reminders`. The existing scheduled reminder
cleanup retries pending resets. `supabase/templates/magic-link.html` includes
both the OTP and the ordinary sign-in link. Its subject/content were pushed to
Twilight's hosted Auth configuration on 6 November 2026 without changing any
other Auth setting. Keep a working email sender configured; an actual external
mailbox delivery has not been tested by the synthetic verifier.

Verification: `node scripts/verify-vault-recovery.mjs` creates two disposable
accounts, uses two owner sessions and a stranger, and removes its fixtures in
`finally`. It tests public API/RLS isolation, requester-session binding,
single-use consumption, cancellation, password rewrapping, email proof via an
admin-generated synthetic OTP (no email sent), storage removal, session
revocation, peer preservation and fresh-vault creation after reset. Unit/UI
tests also cover tampered codes, wrong epochs/accounts/keys, explicit reset
confirmation, error retention and retired device-key cleanup.

The security advisor identifies the four authenticated device RPCs as
intentional SECURITY DEFINER entry points. They use an empty search path,
owner/session/consent checks and constrained operations; direct table writes
are denied. The reset job table intentionally has no client RLS policy and no
client grants. There is no administrator decryption, key transparency or
independent cryptographic-audit claim.

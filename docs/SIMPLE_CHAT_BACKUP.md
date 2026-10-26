# Simple chat backup

## Everyday use

Sign in and connect to your partner. The current device initializes its encryption
identity automatically. Messaging, encrypted attachments and calls do not require
setting a backup password. The chat header reports its connection/encryption state;
it no longer labels an otherwise usable chat as requiring protection.

## Optional backup

Open **Settings → Chat backup** (or **Account → Chat backup** for partners).
Choose a backup password, tap Continue, then confirm it. Only one password field is
shown at a time. Not now closes the optional setup without a server request.
Existing backups can be updated from the same screen. New backup passwords still
require at least eight characters and use the existing encryption; a short numeric
PIN has not replaced that protection.

## A new device

If a backup exists, enter its password once to restore chats. Existing passphrases
and legacy PIN backups continue to work. Alternatively, open More options and
request a link code. On a device already signed in with the same account, open
Chat backup → More options and enter that code.

When no backup exists, the new device offers linking directly. It cannot replace
the account's existing identity or silently start using a different key. If every
trusted device is lost without a usable backup, the old encrypted history cannot
be restored by this flow. Creating a backup before switching/losing devices remains
the recovery option.

## Verification

- 56 tests cover the non-blocking prompt, optional setup/cancel, one-field password
  confirmation, legacy restore, hidden device linking, incomplete-link cleanup,
  calls without a backup, and refusal to call with a locked/uninitialized identity.
- Live synthetic tracker/partner accounts with no `identity_backups` rows sent and
  decrypted actual encrypted messages in both directions. A replacement device key
  was still rejected by the canonical identity guard.
- Both synthetic accounts, their relationship/messages, profiles and encryption
  registrations were removed after testing. No existing account was modified.
- Browser preview could not initialize due to the desktop tool's missing kernel
  assets path. UI flows were checked through rendered component tests and the
  production build, with actual backend encryption/persistence verified separately.

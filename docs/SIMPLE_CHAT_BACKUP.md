# One account backup password

Each account has one backup password for private records, profile, preferences and chat recovery. Both the cycle tracker and carer use the same flow. This password is separate from the sign-in password.

The account-vault setup includes password confirmation. To change it later, open **Account / Settings → Backup password**. Enter the current backup password, the new password (at least 12 characters), and confirmation. Changing it rewraps the same master key, preserving records and chats.

A new device unlocks the account vault with that password and automatically restores the independent chat key from an owner-only encrypted envelope. There is no separate chat-password setup. The server never receives the readable key or backup password.

Disconnect deletes messages, media, games, chat keys and the chat recovery envelope for both members. Personal records, the personal vault and its backup password remain. Reconnecting creates fresh chat keys automatically under that same account vault. A delayed device registration from an old conversation generation is rejected.

Existing devices automatically import their usable local chat key. If an old identity exists only in a legacy password-encrypted backup, its old chat password is needed once to migrate it. Alternatively use another signed-in device via **Backup password → More options**. After migration the separate legacy backup is removed. Lost keys cannot be recovered without an unlocked device or a usable encrypted backup.

Verification: `node scripts/verify-unified-backup.mjs` uses synthetic accounts to test carer setup with a stale local counter, owner-only recovery, new-device message decryption, password rotation, stale-write rejection and repeated carer unlink/relink cycles. It removes only its synthetic accounts afterward.
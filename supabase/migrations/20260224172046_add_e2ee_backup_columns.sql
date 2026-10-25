ALTER TABLE user_keys
ADD COLUMN IF NOT EXISTS backup_data text,
ADD COLUMN IF NOT EXISTS backup_salt text;

COMMENT ON COLUMN user_keys.backup_data IS 'AES-GCM encrypted private key backup';
COMMENT ON COLUMN user_keys.backup_salt IS 'Salt used for PBKDF2 PIN derivation';;

ALTER TABLE identity_backups ADD COLUMN IF NOT EXISTS public_key TEXT;
COMMENT ON COLUMN identity_backups.public_key IS 'Permanent public identity key for cross-device restoration.';;

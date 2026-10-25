-- Add backup columns to user_keys
ALTER TABLE user_keys ADD COLUMN IF NOT EXISTS backup_identity TEXT;
ALTER TABLE user_keys ADD COLUMN IF NOT EXISTS backup_salt TEXT;

-- Create sync_sessions table for QR handshake
CREATE TABLE IF NOT EXISTS sync_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    ephemeral_public_key TEXT NOT NULL,
    encrypted_payload TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sync_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for sync_sessions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own sync sessions' AND tablename = 'sync_sessions') THEN
        CREATE POLICY "Users can manage their own sync sessions" ON sync_sessions
        FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;
;

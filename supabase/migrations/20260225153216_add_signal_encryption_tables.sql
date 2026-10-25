-- Table for One-time Pre-keys (X3DH)
CREATE TABLE IF NOT EXISTS public.user_pre_keys (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  device_id text NOT NULL,
  public_key_b64 text NOT NULL,
  is_used boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Table for Session Snapshots (Encrypted with PIN key for recovery)
CREATE TABLE IF NOT EXISTS public.e2ee_session_backups (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  device_id text NOT NULL,
  partner_id uuid REFERENCES auth.users ON DELETE CASCADE,
  encrypted_session_state text NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.user_pre_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.e2ee_session_backups ENABLE ROW LEVEL SECURITY;

-- Pre-keys: Anyone can read (to start a session), owner can manage
CREATE POLICY "Pre-keys readable by authenticated" ON public.user_pre_keys
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users manage own pre-keys" ON public.user_pre_keys
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Session Backups: Only owner can access
CREATE POLICY "Users manage own session backups" ON public.e2ee_session_backups
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pre_keys_user_device ON public.user_pre_keys(user_id, device_id) WHERE is_used = false;
CREATE INDEX IF NOT EXISTS idx_session_backups_user_partner ON public.e2ee_session_backups(user_id, partner_id);
;

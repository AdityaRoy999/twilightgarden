-- Create a table for storing public keys for E2EE
CREATE TABLE IF NOT EXISTS public.user_keys (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    public_key TEXT NOT NULL, -- JWK format Base64 encoded
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_keys ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Users can insert their own public key
CREATE POLICY "Users can insert their own public key" ON public.user_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. Users can update their own public key
CREATE POLICY "Users can update their own public key" ON public.user_keys
    FOR UPDATE USING (auth.uid() = user_id);

-- 3. Any authenticated user can read public keys (needed for encryption)
CREATE POLICY "Anyone can read public keys" ON public.user_keys
    FOR SELECT USING (true);

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.user_keys
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- Add to Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_keys;
;

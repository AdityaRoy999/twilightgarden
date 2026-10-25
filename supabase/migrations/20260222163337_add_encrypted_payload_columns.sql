ALTER TABLE IF EXISTS public.daily_logs ADD COLUMN IF NOT EXISTS encrypted_payload TEXT;
ALTER TABLE IF EXISTS public.user_settings ADD COLUMN IF NOT EXISTS encrypted_payload TEXT;
ALTER TABLE IF EXISTS public.notifications ADD COLUMN IF NOT EXISTS encrypted_payload TEXT;;

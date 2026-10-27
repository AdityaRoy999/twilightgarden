-- These non-unique indexes duplicate the exact keys/order of existing UNIQUE
-- constraints. Retain the unique constraints, all policies, and all user rows.
SET lock_timeout = '3s';
DROP INDEX IF EXISTS public.idx_daily_logs_user_date;
DROP INDEX IF EXISTS public.idx_user_settings_user;
DROP INDEX IF EXISTS public.idx_identity_backups_user_id;

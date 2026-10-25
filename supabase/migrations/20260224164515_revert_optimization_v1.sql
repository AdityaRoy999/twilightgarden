-- Revert Database Optimizations

-- Drop consolidated boot RPC function
DROP FUNCTION IF EXISTS public.get_app_boot_data(UUID);

-- Drop optimized indexes
DROP INDEX IF EXISTS public.idx_profiles_role;
DROP INDEX IF EXISTS public.idx_couples_partner_1;
DROP INDEX IF EXISTS public.idx_couples_partner_2;
DROP INDEX IF EXISTS public.idx_couples_status;
DROP INDEX IF EXISTS public.idx_daily_logs_user_date;
DROP INDEX IF EXISTS public.idx_shared_notes_couple_created;
DROP INDEX IF EXISTS public.idx_notifications_user_read;
DROP INDEX IF EXISTS public.idx_user_settings_user_id;;

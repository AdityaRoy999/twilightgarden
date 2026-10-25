ALTER TABLE public.daily_logs
ADD COLUMN energy_level text CHECK (energy_level IN ('low', 'medium', 'high')),
ADD COLUMN sleep_hours numeric,
ADD COLUMN sleep_quality text CHECK (sleep_quality IN ('poor', 'fair', 'good'));;

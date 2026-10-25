-- Add role column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

-- Create function to set admin role
CREATE OR REPLACE FUNCTION public.set_admin_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email = 'adiroyboy2@gmail.com' THEN
    NEW.role := 'admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run before insert on profiles
DROP TRIGGER IF EXISTS tr_set_admin_role ON public.profiles;
CREATE TRIGGER tr_set_admin_role
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_admin_role();

-- RLS Policies for Admin Access

-- Profiles: Admin can see all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
);

-- Daily Logs: Admin can see all logs
CREATE POLICY "Admins can view all daily logs" ON public.daily_logs
FOR SELECT USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
);

-- User Settings: Admin can see all settings
CREATE POLICY "Admins can view all user settings" ON public.user_settings
FOR SELECT USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
);

-- Couples: Admin can see all couples
CREATE POLICY "Admins can view all couples" ON public.couples
FOR SELECT USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
);

-- Shared Notes: Admin can see all notes
CREATE POLICY "Admins can view all shared notes" ON public.shared_notes
FOR SELECT USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
);

-- Push Subscriptions: Admin can see all subscriptions (optional, but good for debugging)
CREATE POLICY "Admins can view all push subscriptions" ON public.push_subscriptions
FOR SELECT USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
);;

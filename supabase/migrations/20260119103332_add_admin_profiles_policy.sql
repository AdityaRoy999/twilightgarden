-- Add policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id OR is_admin());

-- Also add admin policy for user_settings (to fix DataContext loading)
CREATE POLICY "Admins can view all user_settings" ON public.user_settings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR is_admin());;

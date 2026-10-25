CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role text := 'user';
BEGIN
  -- Determine role based on email
  IF new.email = 'adiroyboy2@gmail.com' THEN
    v_role := 'admin';
  END IF;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    v_role
  );

  -- Also create default settings for them
  insert into public.user_settings (user_id, avg_cycle_length, avg_period_length)
  values (new.id, 28, 5);

  return new;
END;
$$;;

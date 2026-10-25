-- Create a table to store FCM tokens for mobile push notifications
create table if not exists public.user_fcm_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  token text not null,
  device_type text default 'android',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, token)
);

-- Turn on RLS
alter table public.user_fcm_tokens enable row level security;

-- Policies
create policy "Users can insert their own tokens"
  on public.user_fcm_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own tokens"
  on public.user_fcm_tokens for select
  using (auth.uid() = user_id);

create policy "Users can update their own tokens"
  on public.user_fcm_tokens for update
  using (auth.uid() = user_id);

create policy "Users can delete their own tokens"
  on public.user_fcm_tokens for delete
  using (auth.uid() = user_id);

-- Create a database webhook to trigger the edge function on message insert
-- Assuming you have a 'shared_notes' table
-- You need to create a trigger that calls the 'push-notifications' function
-- Note: This usually requires enabling pg_net extension and using supabase_functions.http_request 
-- OR using the Supabase Dashboard UI to set up the trigger.
-- Here is the function definition if using internal postgres function to call edge function:

/*
create or replace function public.handle_new_message()
returns trigger as $$
begin
  perform
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.functions.supabase.co/push-notifications',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
      body := jsonb_build_object(
        'type', 'chat',
        'record', row_to_json(NEW),
        'userId', (
           -- Logic to find the recipient
           -- This is hard to do in pure SQL trigger without knowing the couple logic
           -- Simplified: Pass the whole record and let Edge Function figure it out
           NEW.recipient_id -- If recipient_id is on the note, otherwise the Edge Function handles it.
        ) 
      )
    );
  return new;
end;
$$ language plpgsql;

create trigger on_new_message
  after insert on public.shared_notes
  for each row execute procedure public.handle_new_message();
*/

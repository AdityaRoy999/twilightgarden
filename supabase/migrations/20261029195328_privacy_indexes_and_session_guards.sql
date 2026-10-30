begin;
create index privacy_requests_user_created on public.privacy_requests(user_id,created_at desc);
create index consent_events_user on twilight_private.consent_events(user_id);
create or replace function twilight_private.current_session_active() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid());
$$;
revoke all on function twilight_private.current_session_active() from public,anon;
grant execute on function twilight_private.current_session_active() to authenticated,service_role;
create policy privacy_preferences_session on public.privacy_preferences as restrictive for select to authenticated using((select twilight_private.current_session_active()));
create policy privacy_requests_session on public.privacy_requests as restrictive for all to authenticated using((select twilight_private.current_session_active())) with check((select twilight_private.current_session_active()));
create or replace function twilight_private.guard_privacy_session() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and not twilight_private.current_session_active() then raise exception 'RECENT_SESSION_REQUIRED'; end if;
 return new;
end; $$;
revoke all on function twilight_private.guard_privacy_session() from public,anon,authenticated;
create trigger privacy_preferences_session before insert or update on public.privacy_preferences for each row execute function twilight_private.guard_privacy_session();
commit;

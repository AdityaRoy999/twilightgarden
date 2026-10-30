begin;
-- SECURITY DEFINER RPCs also hit these triggers, so consent cannot be bypassed
-- by calling send_chat_note directly instead of using the UI.
create trigger privacy_note_write before insert or update on public.shared_notes for each row execute function twilight_private.guard_sensitive_write();
create trigger privacy_identity_write before insert or update on public.user_keys for each row execute function twilight_private.guard_sensitive_write();
create or replace function public.consume_request_budget(p_user_id uuid,p_action text,p_limit integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_count integer;v_window timestamptz;
begin
 if p_user_id is null or p_action is null or p_limit is null
 or p_action not in('ai','push','turn-credentials','game-move','game-ai','pair-code','pair-join','unlink','account-delete') or p_limit not between 1 and 120 then return false;end if;
 v_window:=case when p_action='turn-credentials' then date_trunc('hour',now()) else date_trunc('minute',now()) end;
 delete from twilight_private.request_budgets where user_id=p_user_id and window_start<now()-interval '1 hour';
 insert into twilight_private.request_budgets(user_id,action,window_start,requests) values(p_user_id,p_action,v_window,1)
 on conflict(user_id,action,window_start) do update set requests=request_budgets.requests+1 returning requests into v_count;
 return v_count<=p_limit;
end $$;
revoke all on function public.consume_request_budget(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.consume_request_budget(uuid,text,integer) to service_role;
commit;

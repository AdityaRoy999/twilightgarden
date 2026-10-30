begin;
create table public.privacy_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 age_band text not null check(age_band in ('under13','13-17','18+')),
 core_consent boolean not null default false,
 health_consent boolean not null default false,
 share_health boolean not null default false,
 ai_consent boolean not null default false,
 shopping_consent boolean not null default false,
 notice_version text not null default '2026-10-30',
 updated_at timestamptz not null default now(),
 deleting boolean not null default false
);
alter table public.privacy_preferences enable row level security;
revoke all on public.privacy_preferences from anon, authenticated;
grant select on public.privacy_preferences to authenticated;
grant all on public.privacy_preferences to service_role;
create policy privacy_read_own on public.privacy_preferences for select to authenticated using(user_id=(select auth.uid()));

create table twilight_private.consent_events (
 id bigint generated always as identity primary key,
 user_id uuid references auth.users(id) on delete cascade,
 recorded_at timestamptz not null default now(),
 notice_version text not null,
 preferences jsonb not null
);
alter table twilight_private.consent_events enable row level security;
revoke all on twilight_private.consent_events from public,anon,authenticated;
grant all on twilight_private.consent_events to service_role;

-- Self-declared age is not guardian verification. Teen sensitive access remains
-- disabled until a real guardian-verification service and review process exist.
create or replace function twilight_private.privacy_allowed(p_user uuid,p_purpose text default 'core') returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.privacy_preferences p where p.user_id=p_user
 and p.age_band='18+' and p.core_consent and not p.deleting and p.notice_version='2026-10-30'
 and (auth.uid() is null or exists(select 1 from auth.sessions s where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid()))
 and case p_purpose when 'health' then p.health_consent when 'share' then p.health_consent and p.share_health
 when 'ai' then p.ai_consent when 'shopping' then p.shopping_consent else p_purpose='core' end);
$$;
revoke all on function twilight_private.privacy_allowed(uuid,text) from public,anon;
grant usage on schema twilight_private to authenticated,service_role;
grant execute on function twilight_private.privacy_allowed(uuid,text) to authenticated,service_role;

create or replace function public.save_privacy_preferences(p_age text,p_core boolean,p_health boolean,p_share boolean,p_ai boolean,p_shopping boolean)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); old_band text;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_age not in ('under13','13-17','18+') then raise exception 'INVALID_AGE_BAND'; end if;
 select age_band into old_band from public.privacy_preferences where user_id=actor for update;
 if old_band in ('under13','13-17') and p_age<>old_band then raise exception 'AGE_REVIEW_REQUIRED'; end if;
 if exists(select 1 from public.privacy_preferences where user_id=actor and deleting) then raise exception 'DELETION_IN_PROGRESS'; end if;
 insert into public.privacy_preferences(user_id,age_band,core_consent,health_consent,share_health,ai_consent,shopping_consent)
 values(actor,p_age,p_core and p_age='18+',p_health and p_core and p_age='18+',p_share and p_health and p_core and p_age='18+',p_ai and p_core and p_age='18+',p_shopping and p_core and p_age='18+')
 on conflict(user_id) do update set age_band=excluded.age_band,core_consent=excluded.core_consent,health_consent=excluded.health_consent,
 share_health=excluded.share_health,ai_consent=excluded.ai_consent,shopping_consent=excluded.shopping_consent,
 notice_version='2026-10-30',updated_at=now();
 insert into twilight_private.consent_events(user_id,notice_version,preferences)
 select actor,notice_version,to_jsonb(p)-'user_id'-'deleting' from public.privacy_preferences p where user_id=actor;
 -- Stop public links immediately on withdrawal of health consent.
 if not p_health or not p_core then delete from public.shared_cards where user_id=actor; end if;
end; $$;
revoke all on function public.save_privacy_preferences(text,boolean,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.save_privacy_preferences(text,boolean,boolean,boolean,boolean,boolean) to authenticated;

create or replace function public.privacy_permissions(p_actor uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('core',twilight_private.privacy_allowed(p_actor,'core'),
 'health',twilight_private.privacy_allowed(p_actor,'health'),'ai',twilight_private.privacy_allowed(p_actor,'ai'),
 'shopping',twilight_private.privacy_allowed(p_actor,'shopping'));
$$;
revoke all on function public.privacy_permissions(uuid) from public,anon,authenticated;
grant execute on function public.privacy_permissions(uuid) to service_role;

create or replace function public.session_is_active(p_actor uuid,p_session uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions where id=p_session and user_id=p_actor);
$$;
revoke all on function public.session_is_active(uuid,uuid) from public,anon,authenticated;
grant execute on function public.session_is_active(uuid,uuid) to service_role;

create or replace function public.get_partner_id() returns uuid language sql stable security definer set search_path='' as $$
 select case when c.partner_1_id=auth.uid() then c.partner_2_id else c.partner_1_id end from public.couples c
 where auth.uid() in (c.partner_1_id,c.partner_2_id) and c.status='active' and c.share_enabled
 and twilight_private.privacy_allowed(auth.uid(),'core')
 and twilight_private.privacy_allowed(case when c.partner_1_id=auth.uid() then c.partner_2_id else c.partner_1_id end,'share') limit 1;
$$;
revoke all on function public.get_partner_id() from public,anon;
grant execute on function public.get_partner_id() to authenticated;

-- Restrictive policies supplement, rather than broaden, existing ownership RLS.
create policy privacy_health_read on public.daily_logs as restrictive for select to authenticated
 using(twilight_private.privacy_allowed(user_id,'health') and twilight_private.privacy_allowed((select auth.uid()),'core'));
create policy privacy_settings_read on public.user_settings as restrictive for select to authenticated
 using(twilight_private.privacy_allowed(user_id,'core') and twilight_private.privacy_allowed((select auth.uid()),'core'));
create policy privacy_card_read on public.shared_cards as restrictive for select to authenticated using(twilight_private.privacy_allowed(user_id,'health'));
create policy privacy_card_insert on public.shared_cards as restrictive for insert to authenticated with check(twilight_private.privacy_allowed((select auth.uid()),'health'));
create policy privacy_card_update on public.shared_cards as restrictive for update to authenticated using(twilight_private.privacy_allowed(user_id,'health')) with check(twilight_private.privacy_allowed(user_id,'health'));
create or replace function twilight_private.guard_sensitive_write() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and not twilight_private.privacy_allowed(auth.uid(),case when tg_table_name='daily_logs' then 'health' else 'core' end)
 then raise exception 'PRIVACY_CONSENT_REQUIRED'; end if;
 return new;
end; $$;
revoke all on function twilight_private.guard_sensitive_write() from public,anon,authenticated;
create trigger privacy_log_write before insert or update on public.daily_logs for each row execute function twilight_private.guard_sensitive_write();
create trigger privacy_settings_write before insert or update on public.user_settings for each row execute function twilight_private.guard_sensitive_write();
create trigger privacy_pairing_write before insert or update on public.couples for each row execute function twilight_private.guard_sensitive_write();
do $$ declare t text; begin
 foreach t in array array['shared_notes','note_keys','user_keys','identity_backups','sync_sessions','game_sessions','user_fcm_tokens','push_subscriptions','chat_identity_state'] loop
 execute format('create policy privacy_core_access on public.%I as restrictive for all to authenticated using (twilight_private.privacy_allowed((select auth.uid()),''core'')) with check (twilight_private.privacy_allowed((select auth.uid()),''core''))',t);
 end loop;
end $$;
create policy privacy_chat_storage on storage.objects as restrictive for all to authenticated
 using(bucket_id<>'chat-media' or twilight_private.privacy_allowed((select auth.uid()),'core'))
 with check(bucket_id<>'chat-media' or twilight_private.privacy_allowed((select auth.uid()),'core'));

create table public.privacy_requests (
 id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete set null,
 kind text not null check(kind in ('access','correction','withdrawal','deletion','grievance','safety','child-safety')),
 description text not null check(length(description) between 10 and 4000),
 status text not null default 'received' check(status in ('received','reviewing','resolved')),
 created_at timestamptz not null default now(),acknowledge_by timestamptz not null default (now()+interval '24 hours'),
 resolve_by timestamptz not null default (now()+interval '7 days')
);
alter table public.privacy_requests enable row level security;
revoke all on public.privacy_requests from anon,authenticated;
grant select,insert on public.privacy_requests to authenticated;
grant all on public.privacy_requests to service_role;
create policy request_read_own on public.privacy_requests for select to authenticated using(user_id=(select auth.uid()));
create policy request_submit_own on public.privacy_requests for insert to authenticated with check(user_id=(select auth.uid()) and status='received' and created_at between now()-interval '1 minute' and now()+interval '1 minute' and acknowledge_by<=now()+interval '24 hours' and resolve_by<=now()+interval '7 days');
create index privacy_request_queue on public.privacy_requests(status,resolve_by);
-- Bound spam independently of the UI. A ticket receipt is not human acknowledgement.
create or replace function twilight_private.guard_request_rate() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,17));
 if (select count(*) from public.privacy_requests where user_id=new.user_id and created_at>now()-interval '1 hour')>=5 then raise exception 'Please wait before sending another request'; end if;
 new.created_at=now();new.acknowledge_by=now()+interval '24 hours';new.resolve_by=now()+interval '7 days';
 if new.kind='child-safety' then new.resolve_by=now()+interval '2 hours'; end if;
 return new;
end; $$;
revoke all on function twilight_private.guard_request_rate() from public,anon,authenticated;
create trigger privacy_request_rate before insert on public.privacy_requests for each row execute function twilight_private.guard_request_rate();

create table twilight_private.deletion_jobs(user_id uuid primary key, requested_at timestamptz not null default now(),completed_at timestamptz);
alter table twilight_private.deletion_jobs enable row level security;
revoke all on twilight_private.deletion_jobs from public,anon,authenticated;
grant all on twilight_private.deletion_jobs to service_role;
create or replace function public.prepare_account_deletion(p_actor uuid,p_session uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.sessions where id=p_session and user_id=p_actor and created_at>now()-interval '10 minutes') then raise exception 'RECENT_SIGN_IN_REQUIRED'; end if;
 insert into twilight_private.deletion_jobs(user_id) values(p_actor) on conflict do nothing;
 update public.privacy_preferences set deleting=true,core_consent=false,health_consent=false,share_health=false,ai_consent=false,shopping_consent=false where user_id=p_actor;
 delete from auth.sessions where user_id=p_actor;
end; $$;
revoke all on function public.prepare_account_deletion(uuid,uuid) from public,anon,authenticated;
grant execute on function public.prepare_account_deletion(uuid,uuid) to service_role;

-- Public health links are turned off pending an explicit recipient-sharing flow.
revoke execute on function public.get_shared_card(text) from public,anon,authenticated;
delete from public.shared_cards where expires_at<now();
create or replace function public.account_storage_objects(p_actor uuid) returns table(bucket_id text,name text)
language sql stable security definer set search_path='' as $$
 select o.bucket_id,o.name from storage.objects o where o.owner_id=p_actor::text limit 500;
$$;
create or replace function public.pending_account_deletions() returns table(user_id uuid)
language sql stable security definer set search_path='' as $$
 select j.user_id from twilight_private.deletion_jobs j where completed_at is null order by requested_at limit 20;
$$;
create or replace function public.delete_owned_account_rows(p_actor uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from twilight_private.deletion_jobs where user_id=p_actor and completed_at is null) then raise exception 'DELETION_NOT_REQUESTED'; end if;
 delete from public.shared_notes where sender_id=p_actor;
 delete from public.user_settings where user_id=p_actor;
 delete from public.profiles where id=p_actor;
end; $$;
create or replace function public.complete_account_deletion(p_actor uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from auth.users where id=p_actor) then raise exception 'ACCOUNT_STILL_EXISTS'; end if;
 update twilight_private.deletion_jobs set completed_at=now() where user_id=p_actor;
end; $$;
revoke all on function public.account_storage_objects(uuid),public.pending_account_deletions(),public.delete_owned_account_rows(uuid),public.complete_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.account_storage_objects(uuid),public.pending_account_deletions(),public.delete_owned_account_rows(uuid),public.complete_account_deletion(uuid) to service_role;
-- Only expired links and completed operational records are purged automatically.
select cron.schedule('privacy-retention-cleanup','37 3 * * *', $job$
 delete from public.shared_cards where expires_at<now();
 delete from public.privacy_requests where status='resolved' and created_at<now()-interval '90 days';
 delete from twilight_private.deletion_jobs where completed_at<now()-interval '7 days';
$job$);
commit;

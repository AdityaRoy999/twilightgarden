-- Legacy rooms remain readable. Version 2 rooms accept only service-validated
-- actions, so a browser cannot overwrite a turn, inspect a secret or set a score.
alter table public.game_sessions add column engine_version integer not null default 1;
alter table public.game_sessions add column revision integer not null default 0;
create unique index one_active_v2_game on public.game_sessions(couple_id,game_type)
where engine_version=2 and status in ('waiting','active');
create table public.game_room_secrets (
 session_id uuid primary key references public.game_sessions(id) on delete cascade,
 payload jsonb not null default '{}'::jsonb
);
alter table public.game_room_secrets enable row level security;
revoke all on public.game_room_secrets from anon,authenticated;
grant all on public.game_room_secrets to service_role;
create policy games_v2_insert on public.game_sessions as restrictive for insert to authenticated with check(engine_version=1);
create policy games_v2_update on public.game_sessions as restrictive for update to authenticated using(engine_version=1) with check(engine_version=1);
create policy games_v2_delete on public.game_sessions as restrictive for delete to authenticated using(engine_version=1);
create policy games_v2_read on public.game_sessions as restrictive for select to authenticated using(engine_version=1 or exists(select 1 from public.couples c where c.id=couple_id and c.status='active' and (c.partner_1_id=(select auth.uid()) or c.partner_2_id=(select auth.uid()))));

create function public.open_game_room(p_actor uuid,p_couple uuid,p_type text,p_state jsonb,p_secret jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.couples; r public.game_sessions;
begin
 select * into c from public.couples where id=p_couple for update;
 if c.id is null or c.status<>'active' or p_actor not in(c.partner_1_id,c.partner_2_id) then raise exception 'Active relationship required'; end if;
 select * into r from public.game_sessions where couple_id=p_couple and game_type=p_type and engine_version=2 and status in('waiting','active') limit 1;
 if r.id is null then
  insert into public.game_sessions(couple_id,game_type,engine_version,board_state,player_x,current_turn) values(p_couple,p_type,2,p_state,p_actor,p_actor) returning * into r;
  insert into public.game_room_secrets(session_id,payload) values(r.id,p_secret);
 elsif r.player_x<>p_actor and r.player_o is null then
  update public.game_sessions set player_o=p_actor,status='active',revision=revision+1 where id=r.id returning * into r;
 end if;
 return to_jsonb(r);
end $$;

create function public.commit_game_action(p_actor uuid,p_id uuid,p_revision integer,p_state jsonb,p_secret jsonb,p_leave boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.game_sessions;
begin
 select g.* into r from public.game_sessions g join public.couples c on c.id=g.couple_id where g.id=p_id and g.engine_version=2 and c.status='active' and p_actor in(c.partner_1_id,c.partner_2_id) for update of g;
 if r.id is null or p_actor not in(r.player_x,r.player_o) then raise exception 'Room unavailable';end if;
 if r.revision<>p_revision then raise exception 'STALE_ROOM';end if;
 if r.status not in('waiting','active') then raise exception 'Room has ended';end if;
 if not p_leave and r.player_o is null then raise exception 'Wait for your partner';end if;
 update public.game_sessions set board_state=p_state, revision=revision+1, current_turn=case when p_state->>'turn'='X' then r.player_x else r.player_o end,
 status=case when p_leave then 'ended' when p_state->>'phase'='result' then 'finished' else 'active' end,
 winner=case when p_state->>'phase'='result' then p_state->>'winner' else null end
 where id=p_id returning * into r;
 update public.game_room_secrets set payload=p_secret where session_id=p_id;
 return to_jsonb(r);
end $$;
revoke all on function public.open_game_room(uuid,uuid,text,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.commit_game_action(uuid,uuid,integer,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.open_game_room(uuid,uuid,text,jsonb,jsonb) to service_role;
grant execute on function public.commit_game_action(uuid,uuid,integer,jsonb,jsonb,boolean) to service_role;

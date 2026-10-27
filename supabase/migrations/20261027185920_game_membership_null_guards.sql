create or replace function public.open_game_room(p_actor uuid,p_couple uuid,p_type text,p_state jsonb,p_secret jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.couples; r public.game_sessions;
begin
 select * into c from public.couples where id=p_couple for update;
 if c.id is null or c.status<>'active' or (p_actor=c.partner_1_id or p_actor=c.partner_2_id) is not true then raise exception 'Active relationship required'; end if;
 select * into r from public.game_sessions where couple_id=p_couple and game_type=p_type and engine_version=2 and status in('waiting','active') limit 1;
 if r.id is null then
  insert into public.game_sessions(couple_id,game_type,engine_version,board_state,player_x,current_turn) values(p_couple,p_type,2,p_state,p_actor,p_actor) returning * into r;
  insert into public.game_room_secrets(session_id,payload) values(r.id,p_secret);
 elsif r.player_x<>p_actor and r.player_o is null then
  update public.game_sessions set player_o=p_actor,status='active',revision=revision+1 where id=r.id returning * into r;
 end if;
 return to_jsonb(r);
end $$;

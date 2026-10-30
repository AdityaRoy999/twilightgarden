-- Support room reconciliation, FK cleanup and share revocation without scans.
CREATE INDEX encrypted_game_commands_session ON public.encrypted_game_commands(session_id,created_at,id);
CREATE INDEX encrypted_game_commands_actor ON public.encrypted_game_commands(actor_id);
CREATE INDEX private_records_couple ON public.private_records(couple_id) WHERE couple_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.queue_private_game_command(p_id uuid,p_session uuid,p_revision int,p_ciphertext jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=auth.uid(); g public.game_sessions%ROWTYPE;
BEGIN
 IF NOT twilight_private.privacy_allowed(a,'core') OR NOT public.consume_request_budget(a,'game-move',100) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT s.* INTO g FROM public.game_sessions s JOIN public.couples c ON c.id=s.couple_id WHERE s.id=p_session AND s.engine_version=3 AND s.status NOT IN('ended','finished') AND c.status='active' AND a IN(s.player_x,s.player_o);
 IF NOT FOUND THEN RAISE EXCEPTION 'Game unavailable' USING ERRCODE='42501'; END IF;
 IF p_revision<>g.revision THEN RAISE EXCEPTION 'STALE_ROOM' USING ERRCODE='40001'; END IF;
 INSERT INTO public.encrypted_game_commands(id,session_id,actor_id,base_revision,ciphertext) VALUES(p_id,p_session,a,p_revision,p_ciphertext) ON CONFLICT(id) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.commit_private_game(p_id uuid,p_revision int,p_state jsonb,p_secret jsonb,p_command uuid DEFAULT NULL,p_status text DEFAULT 'active') RETURNS public.game_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=auth.uid(); g public.game_sessions%ROWTYPE;
BEGIN
 IF NOT twilight_private.privacy_allowed(a,'core') THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT s.* INTO g FROM public.game_sessions s JOIN public.couples c ON c.id=s.couple_id WHERE s.id=p_id AND s.engine_version=3 AND (s.status NOT IN('ended','finished') OR (s.status='finished' AND p_status='ended')) AND c.status='active' AND s.player_x=a FOR UPDATE OF s;
 IF NOT FOUND THEN RAISE EXCEPTION 'Host access required' USING ERRCODE='42501'; END IF;
 IF g.revision<>p_revision THEN RAISE EXCEPTION 'STALE_ROOM' USING ERRCODE='40001'; END IF;
 IF p_state IS NULL OR p_secret IS NULL OR coalesce(p_state->>'v','')<>'1' OR coalesce(p_secret->>'v','')<>'1' OR octet_length(p_state::text)>128000 OR octet_length(p_secret::text)>128000 OR p_status NOT IN('waiting','active','finished','ended') THEN RAISE EXCEPTION 'Invalid encrypted state'; END IF;
 IF p_command IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.encrypted_game_commands WHERE id=p_command AND session_id=p_id AND status='pending') THEN RAISE EXCEPTION 'Command already consumed'; END IF;
 UPDATE public.game_sessions SET encrypted_state=p_state,host_secret=p_secret,revision=revision+1,status=p_status,board_state='{"encrypted":true}',winner=NULL,current_turn=NULL WHERE id=p_id RETURNING * INTO g;
 IF p_command IS NOT NULL THEN UPDATE public.encrypted_game_commands SET status='applied' WHERE id=p_command AND session_id=p_id; END IF;
 RETURN g;
END $$;

CREATE OR REPLACE FUNCTION public.reject_private_game_command(p_id uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.encrypted_game_commands q SET status='rejected' FROM public.game_sessions g WHERE q.id=p_id AND q.status='pending' AND q.session_id=g.id AND g.player_x=auth.uid() AND twilight_private.privacy_allowed(auth.uid(),'core');
$$;

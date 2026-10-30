ALTER TABLE public.game_sessions ADD COLUMN encrypted_state jsonb, ADD COLUMN host_secret jsonb;
CREATE TABLE public.encrypted_game_commands(
 id uuid PRIMARY KEY,
 session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 base_revision integer NOT NULL CHECK(base_revision>=0),
 ciphertext jsonb NOT NULL CHECK(coalesce(ciphertext->>'v','')='1' AND octet_length(ciphertext::text)<32000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','applied','rejected')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX encrypted_game_commands_pending ON public.encrypted_game_commands(session_id,created_at) WHERE status='pending';
ALTER TABLE public.encrypted_game_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.encrypted_game_commands FROM anon,authenticated;
GRANT SELECT ON public.encrypted_game_commands TO authenticated;
GRANT ALL ON public.encrypted_game_commands TO service_role;
CREATE POLICY encrypted_game_commands_read ON public.encrypted_game_commands FOR SELECT TO authenticated USING(
 twilight_private.privacy_allowed(auth.uid(),'core') AND EXISTS(SELECT 1 FROM public.game_sessions g JOIN public.couples c ON c.id=g.couple_id WHERE g.id=session_id AND g.engine_version=3 AND c.status='active' AND auth.uid() IN(g.player_x,g.player_o)));
ALTER PUBLICATION supabase_realtime ADD TABLE public.encrypted_game_commands;

CREATE FUNCTION public.open_private_game(p_couple uuid,p_type text) RETURNS public.game_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=auth.uid(); c public.couples%ROWTYPE; g public.game_sessions%ROWTYPE;
BEGIN
 IF NOT twilight_private.privacy_allowed(a,'core') THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF p_type NOT IN('tictactoe','dots_boxes','connect_four','rps','hangman','wordguess','love_trivia','truth_dare','would_you_rather','this_or_that','twenty_questions','emoji_charades','memory_match','story_builder','riddle_me','never_have_i_ever','two_truths','rapid_fire','song_lyrics') THEN RAISE EXCEPTION 'Unknown game'; END IF;
 IF NOT public.consume_request_budget(a,'game-move',100) THEN RAISE EXCEPTION 'Please slow down'; END IF;
 SELECT * INTO c FROM public.couples WHERE id=p_couple AND status='active' AND a IN(partner_1_id,partner_2_id);
 IF NOT FOUND THEN RAISE EXCEPTION 'Active connection required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.account_vaults WHERE user_id=c.partner_1_id) OR NOT EXISTS(SELECT 1 FROM public.account_vaults WHERE user_id=c.partner_2_id) THEN RAISE EXCEPTION 'Both players must set up their private vaults first'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_couple::text||p_type,995));
 SELECT * INTO g FROM public.game_sessions WHERE couple_id=p_couple AND game_type=p_type AND engine_version=3 AND status NOT IN('ended','finished','completed') ORDER BY created_at DESC LIMIT 1;
 IF NOT FOUND THEN INSERT INTO public.game_sessions(couple_id,game_type,player_x,status,engine_version,revision,board_state) VALUES(p_couple,p_type,a,'waiting',3,0,'{"encrypted":true}') RETURNING * INTO g;
 ELSIF g.player_x<>a AND g.player_o IS NULL THEN UPDATE public.game_sessions SET player_o=a,status='active' WHERE id=g.id RETURNING * INTO g; END IF;
 RETURN g;
END $$;

CREATE FUNCTION public.queue_private_game_command(p_id uuid,p_session uuid,p_revision int,p_ciphertext jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=auth.uid(); g public.game_sessions%ROWTYPE;
BEGIN
 IF NOT twilight_private.privacy_allowed(a,'core') OR NOT public.consume_request_budget(a,'game-move',100) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT s.* INTO g FROM public.game_sessions s JOIN public.couples c ON c.id=s.couple_id WHERE s.id=p_session AND s.engine_version=3 AND c.status='active' AND a IN(s.player_x,s.player_o);
 IF NOT FOUND THEN RAISE EXCEPTION 'Game unavailable' USING ERRCODE='42501'; END IF;
 IF p_revision<>g.revision THEN RAISE EXCEPTION 'STALE_ROOM' USING ERRCODE='40001'; END IF;
 INSERT INTO public.encrypted_game_commands(id,session_id,actor_id,base_revision,ciphertext) VALUES(p_id,p_session,a,p_revision,p_ciphertext) ON CONFLICT(id) DO NOTHING;
END $$;

CREATE FUNCTION public.commit_private_game(p_id uuid,p_revision int,p_state jsonb,p_secret jsonb,p_command uuid DEFAULT NULL,p_status text DEFAULT 'active') RETURNS public.game_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=auth.uid(); g public.game_sessions%ROWTYPE;
BEGIN
 IF NOT twilight_private.privacy_allowed(a,'core') THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT s.* INTO g FROM public.game_sessions s JOIN public.couples c ON c.id=s.couple_id WHERE s.id=p_id AND s.engine_version=3 AND c.status='active' AND s.player_x=a FOR UPDATE OF s;
 IF NOT FOUND THEN RAISE EXCEPTION 'Host access required' USING ERRCODE='42501'; END IF;
 IF g.revision<>p_revision THEN RAISE EXCEPTION 'STALE_ROOM' USING ERRCODE='40001'; END IF;
 IF p_state IS NULL OR p_secret IS NULL OR coalesce(p_state->>'v','')<>'1' OR coalesce(p_secret->>'v','')<>'1' OR octet_length(p_state::text)>128000 OR octet_length(p_secret::text)>128000 OR p_status NOT IN('waiting','active','finished','ended') THEN RAISE EXCEPTION 'Invalid encrypted state'; END IF;
 IF p_command IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.encrypted_game_commands WHERE id=p_command AND session_id=p_id AND status='pending') THEN RAISE EXCEPTION 'Command already consumed'; END IF;
 UPDATE public.game_sessions SET encrypted_state=p_state,host_secret=p_secret,revision=revision+1,status=p_status,board_state='{"encrypted":true}',winner=NULL,current_turn=NULL WHERE id=p_id RETURNING * INTO g;
 IF p_command IS NOT NULL THEN UPDATE public.encrypted_game_commands SET status='applied' WHERE id=p_command AND session_id=p_id; END IF;
 RETURN g;
END $$;

CREATE FUNCTION public.reject_private_game_command(p_id uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.encrypted_game_commands q SET status='rejected' FROM public.game_sessions g WHERE q.id=p_id AND q.session_id=g.id AND g.player_x=auth.uid() AND twilight_private.privacy_allowed(auth.uid(),'core');
$$;
REVOKE ALL ON FUNCTION public.open_private_game(uuid,text), public.queue_private_game_command(uuid,uuid,int,jsonb),public.commit_private_game(uuid,int,jsonb,jsonb,uuid,text),public.reject_private_game_command(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.open_private_game(uuid,text),public.queue_private_game_command(uuid,uuid,int,jsonb),public.commit_private_game(uuid,int,jsonb,jsonb,uuid,text),public.reject_private_game_command(uuid) TO authenticated;

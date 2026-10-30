-- Ending a room is lifecycle metadata, so either member can do it without
-- decrypting host state or waiting for the host's device to be awake.
CREATE FUNCTION public.end_private_game(p_id uuid) RETURNS public.game_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=auth.uid(); g public.game_sessions%ROWTYPE;
BEGIN
 IF NOT twilight_private.privacy_allowed(a,'core') THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT s.* INTO g FROM public.game_sessions s JOIN public.couples c ON c.id=s.couple_id
 WHERE s.id=p_id AND s.engine_version=3 AND c.status='active' AND a IN(s.player_x,s.player_o) FOR UPDATE OF s;
 IF NOT FOUND THEN RAISE EXCEPTION 'Game unavailable' USING ERRCODE='42501'; END IF;
 IF g.status NOT IN('ended','finished','completed') THEN
  -- Do not increment revision: existing ciphertext authenticates that revision.
  UPDATE public.game_sessions SET status='ended' WHERE id=p_id RETURNING * INTO g;
  UPDATE public.encrypted_game_commands SET status='rejected' WHERE session_id=p_id AND status='pending';
 END IF;
 RETURN g;
END $$;
CREATE FUNCTION public.game_adult_pair_eligible(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT twilight_private.privacy_allowed(auth.uid(),'core') AND EXISTS(
 SELECT 1 FROM public.game_sessions g JOIN public.couples c ON c.id=g.couple_id
 JOIN public.privacy_preferences x ON x.user_id=g.player_x
 JOIN public.privacy_preferences o ON o.user_id=g.player_o
 WHERE g.id=p_id AND g.engine_version=3 AND c.status='active' AND auth.uid() IN(g.player_x,g.player_o)
 AND x.age_band='18+' AND o.age_band='18+' AND x.core_consent AND o.core_consent AND NOT x.deleting AND NOT o.deleting);
$$;
REVOKE ALL ON FUNCTION public.end_private_game(uuid),public.game_adult_pair_eligible(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.end_private_game(uuid),public.game_adult_pair_eligible(uuid) TO authenticated;

-- Queue concurrent independently confirmed answers/ready acknowledgements.
-- The host authenticates the encrypted phase/round/settings basis before rebasing.
CREATE OR REPLACE FUNCTION public.queue_private_game_command(p_id uuid,p_session uuid,p_revision int,p_ciphertext jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=auth.uid(); g public.game_sessions%ROWTYPE;
BEGIN
 IF NOT twilight_private.privacy_allowed(a,'core') OR NOT public.consume_request_budget(a,'game-move',100) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT s.* INTO g FROM public.game_sessions s JOIN public.couples c ON c.id=s.couple_id WHERE s.id=p_session AND s.engine_version=3 AND s.status NOT IN('ended','finished','completed') AND c.status='active' AND a IN(s.player_x,s.player_o);
 IF NOT FOUND THEN RAISE EXCEPTION 'Game unavailable' USING ERRCODE='42501'; END IF;
 IF p_revision>g.revision OR p_revision<greatest(0,g.revision-50) THEN RAISE EXCEPTION 'STALE_ROOM' USING ERRCODE='40001'; END IF;
 INSERT INTO public.encrypted_game_commands(id,session_id,actor_id,base_revision,ciphertext) VALUES(p_id,p_session,a,p_revision,p_ciphertext) ON CONFLICT(id) DO NOTHING;
END $$;


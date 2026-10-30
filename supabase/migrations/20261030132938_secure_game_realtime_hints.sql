-- Private low-latency hints carry no state. Clients fetch the committed room.
CREATE FUNCTION twilight_private.can_join_private_game(topic text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE parts text[]:=string_to_array(topic,':'); a uuid:=auth.uid();
BEGIN
 IF a IS NULL OR array_length(parts,1)<>3 OR parts[1]<>'game-secure'
 OR NOT twilight_private.privacy_allowed(a,'core') THEN RETURN false; END IF;
 RETURN EXISTS(SELECT 1 FROM public.game_sessions g JOIN public.couples c ON c.id=g.couple_id
 WHERE g.id=parts[3]::uuid AND g.couple_id=parts[2]::uuid AND g.engine_version=3
 AND c.status='active' AND a IN(g.player_x,g.player_o) AND a IN(c.partner_1_id,c.partner_2_id));
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION twilight_private.can_join_private_game(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION twilight_private.can_join_private_game(text) TO authenticated;
CREATE POLICY private_game_hints_read ON realtime.messages FOR SELECT TO authenticated USING(
 extension='broadcast' AND (SELECT twilight_private.can_join_private_game((SELECT realtime.topic()))));
CREATE POLICY private_game_hints_write ON realtime.messages FOR INSERT TO authenticated WITH CHECK(
 extension='broadcast' AND (SELECT twilight_private.can_join_private_game((SELECT realtime.topic()))));

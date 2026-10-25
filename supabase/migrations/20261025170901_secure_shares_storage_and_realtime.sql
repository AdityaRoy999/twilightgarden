SET lock_timeout='5s';
-- Public share links are capability URLs. The table itself must not be enumerable.
DROP POLICY "Anyone can view shared cards" ON public.shared_cards;
DROP POLICY "Users can create own shared cards" ON public.shared_cards;
DROP POLICY "Users can delete own shared cards" ON public.shared_cards;
DROP POLICY "Users can update own shared cards" ON public.shared_cards;
CREATE POLICY shared_cards_read ON public.shared_cards FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY shared_cards_insert ON public.shared_cards FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY shared_cards_update ON public.shared_cards FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY shared_cards_delete ON public.shared_cards FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE OR REPLACE FUNCTION public.get_shared_card(p_code text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT card_data FROM public.shared_cards WHERE share_code=p_code AND length(p_code) BETWEEN 16 AND 128 AND expires_at>now() LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_shared_card(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_card(text) TO anon,authenticated;

DROP POLICY "Anyone can upload an avatar." ON storage.objects;
DROP POLICY "Users can update their own avatar." ON storage.objects;
CREATE POLICY avatars_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY avatars_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='avatars' AND owner=(SELECT auth.uid())) WITH CHECK(bucket_id='avatars' AND owner=(SELECT auth.uid()) AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY avatars_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='avatars' AND owner=(SELECT auth.uid()));
DROP POLICY "Couple members can download media" ON storage.objects;
DROP POLICY "Couple members can upload media" ON storage.objects;
CREATE POLICY chat_media_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='chat-media' AND EXISTS(SELECT 1 FROM public.couples c WHERE c.id::text=(storage.foldername(name))[1] AND (c.partner_1_id=(SELECT auth.uid()) OR c.partner_2_id=(SELECT auth.uid()))));
CREATE POLICY chat_media_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='chat-media' AND EXISTS(SELECT 1 FROM public.couples c WHERE c.id::text=(storage.foldername(name))[1] AND c.status='active' AND (c.partner_1_id=(SELECT auth.uid()) OR c.partner_2_id=(SELECT auth.uid()))));

DROP POLICY "Users can create games for their couple" ON public.game_sessions;
DROP POLICY "Users can delete their couple's games" ON public.game_sessions;
DROP POLICY "Users can update their couple's games" ON public.game_sessions;
DROP POLICY "Users can view their couple's games" ON public.game_sessions;
CREATE POLICY games_read ON public.game_sessions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.couples c WHERE c.id=couple_id AND (c.partner_1_id=(SELECT auth.uid()) OR c.partner_2_id=(SELECT auth.uid()))));
CREATE POLICY games_insert ON public.game_sessions FOR INSERT TO authenticated WITH CHECK(player_x=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.couples c WHERE c.id=couple_id AND c.status='active' AND (c.partner_1_id=(SELECT auth.uid()) OR c.partner_2_id=(SELECT auth.uid())) AND (player_o IS NULL OR player_o IN(c.partner_1_id,c.partner_2_id))));
CREATE POLICY games_update ON public.game_sessions FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM public.couples c WHERE c.id=couple_id AND (c.partner_1_id=(SELECT auth.uid()) OR c.partner_2_id=(SELECT auth.uid())))) WITH CHECK(EXISTS(SELECT 1 FROM public.couples c WHERE c.id=couple_id AND c.status='active' AND player_x IN(c.partner_1_id,c.partner_2_id) AND (player_o IS NULL OR player_o IN(c.partner_1_id,c.partner_2_id)) AND (c.partner_1_id=(SELECT auth.uid()) OR c.partner_2_id=(SELECT auth.uid()))));
CREATE POLICY games_delete ON public.game_sessions FOR DELETE TO authenticated USING(EXISTS(SELECT 1 FROM public.couples c WHERE c.id=couple_id AND (c.partner_1_id=(SELECT auth.uid()) OR c.partner_2_id=(SELECT auth.uid()))));

CREATE OR REPLACE FUNCTION public.can_access_realtime_topic() RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.couples c WHERE c.status='active' AND (c.partner_1_id=(SELECT auth.uid()) OR c.partner_2_id=(SELECT auth.uid())) AND (
   (SELECT realtime.topic()) IN('call:'||c.id::text,'couple_main_'||c.id::text,'partner_realtime_'||c.partner_1_id::text,'partner_realtime_'||c.partner_2_id::text)))
 OR EXISTS(SELECT 1 FROM public.game_sessions g WHERE g.id::text=right((SELECT realtime.topic()),36) AND (SELECT realtime.topic()) ~ '^game_[a-z]+_');
$$;
REVOKE ALL ON FUNCTION public.can_access_realtime_topic() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_access_realtime_topic() TO authenticated;
CREATE POLICY couple_realtime_read ON realtime.messages FOR SELECT TO authenticated USING(extension IN('broadcast','presence') AND (SELECT public.can_access_realtime_topic()));
CREATE POLICY couple_realtime_write ON realtime.messages FOR INSERT TO authenticated WITH CHECK(extension IN('broadcast','presence') AND (SELECT public.can_access_realtime_topic()));

-- Only the note's sender may alter its content or identity; recipients can react/read.
CREATE OR REPLACE FUNCTION public.guard_note_identity() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user IN('authenticated','anon') AND (
   NEW.sender_id IS DISTINCT FROM OLD.sender_id OR NEW.couple_id IS DISTINCT FROM OLD.couple_id OR
   (OLD.sender_id<>auth.uid() AND (NEW.content IS DISTINCT FROM OLD.content OR NEW.media_url IS DISTINCT FROM OLD.media_url OR NEW.type IS DISTINCT FROM OLD.type))) THEN
   RAISE EXCEPTION 'Cannot change another sender''s note' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_note_identity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_note_identity BEFORE UPDATE ON public.shared_notes FOR EACH ROW EXECUTE FUNCTION public.guard_note_identity();
SELECT cron.schedule('twilight-hourly-reminders','*/15 * * * *','select public.run_reminder_job()');
NOTIFY pgrst,'reload schema';

;

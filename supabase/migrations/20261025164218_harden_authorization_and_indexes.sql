-- Recover authorization boundaries before optimizing policies. No health records are deleted.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER FUNCTION public."delete_ended_game_session"() SET search_path = public, pg_temp;
ALTER FUNCTION public."delete_old_notifications"() SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public."delete_old_notifications"() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public."get_partner_id"() SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public."get_partner_id"() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public."handle_new_user"() SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public."handle_new_user"() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public."handle_updated_at"() SET search_path = public, pg_temp;
ALTER FUNCTION public."is_admin"() SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public."is_admin"() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public."join_couple"(code_input text) SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public."join_couple"(code_input text) FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public."join_couple_love_lock"(code_input text) SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public."join_couple_love_lock"(code_input text) FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public."set_admin_role"() SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public."set_admin_role"() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_partner_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_couple(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_couple_love_lock(text) TO authenticated;
DROP POLICY "Admins can view all couples" ON public."couples";
DROP POLICY "Users can create a couple entry" ON public."couples";
DROP POLICY "Users can delete their own couple" ON public."couples";
DROP POLICY "Users can update their couple data" ON public."couples";
DROP POLICY "Users can view their own couple data" ON public."couples";
DROP POLICY "Users and partners can view logs" ON public."daily_logs";
DROP POLICY "Users can delete own logs" ON public."daily_logs";
DROP POLICY "Users can insert own logs" ON public."daily_logs";
DROP POLICY "Users can update own logs" ON public."daily_logs";
DROP POLICY "Users can manage their own identity backups" ON public."identity_backups";
DROP POLICY "Users can insert note keys for their partner" ON public."note_keys";
DROP POLICY "Users can view their own note keys" ON public."note_keys";
DROP POLICY "Authenticated users can insert notifications" ON public."notifications";
DROP POLICY "Service role can insert" ON public."notifications";
DROP POLICY "Users can delete own notifications" ON public."notifications";
DROP POLICY "Users can insert notifications" ON public."notifications";
DROP POLICY "Users can update own notifications" ON public."notifications";
DROP POLICY "Users can update their own notifications" ON public."notifications";
DROP POLICY "Users can view own notifications" ON public."notifications";
DROP POLICY "Users can view their own notifications" ON public."notifications";
DROP POLICY "Admins can view all profiles" ON public."profiles";
DROP POLICY "Partners can view shared profile" ON public."profiles";
DROP POLICY "Profiles are viewable by everyone" ON public."profiles";
DROP POLICY "Users can insert own profile" ON public."profiles";
DROP POLICY "Users can read own profile" ON public."profiles";
DROP POLICY "Users can update own profile" ON public."profiles";
DROP POLICY "Users can view own profile" ON public."profiles";
DROP POLICY "Admins can view all push subscriptions" ON public."push_subscriptions";
DROP POLICY "Admins can view all subscriptions" ON public."push_subscriptions";
DROP POLICY "Users can delete own push subscriptions" ON public."push_subscriptions";
DROP POLICY "Users can delete their own subscriptions" ON public."push_subscriptions";
DROP POLICY "Users can insert own push subscriptions" ON public."push_subscriptions";
DROP POLICY "Users can insert their own subscriptions" ON public."push_subscriptions";
DROP POLICY "Users can select own push subscriptions" ON public."push_subscriptions";
DROP POLICY "Users can update own push subscriptions" ON public."push_subscriptions";
DROP POLICY "Users can view their own subscriptions" ON public."push_subscriptions";
DROP POLICY "Admins can view all notes" ON public."shared_notes";
DROP POLICY "Admins can view all shared notes" ON public."shared_notes";
DROP POLICY "Users can delete notes from their couple" ON public."shared_notes";
DROP POLICY "Users can insert notes to their couple" ON public."shared_notes";
DROP POLICY "Users can update notes in their couple" ON public."shared_notes";
DROP POLICY "Users can view notes from their couple" ON public."shared_notes";
DROP POLICY "Users can manage their own sync sessions" ON public."sync_sessions";
DROP POLICY "Service Role can read all tokens" ON public."user_fcm_tokens";
DROP POLICY "Service role can select fcm tokens" ON public."user_fcm_tokens";
DROP POLICY "Users can delete their own tokens" ON public."user_fcm_tokens";
DROP POLICY "Users can insert fcm tokens" ON public."user_fcm_tokens";
DROP POLICY "Users can insert their own tokens" ON public."user_fcm_tokens";
DROP POLICY "Users can read their own tokens" ON public."user_fcm_tokens";
DROP POLICY "Users can update their own fcm tokens" ON public."user_fcm_tokens";
DROP POLICY "Users can update their own tokens" ON public."user_fcm_tokens";
DROP POLICY "Users can view their own fcm tokens" ON public."user_fcm_tokens";
DROP POLICY "Anyone can read public keys" ON public."user_keys";
DROP POLICY "Public keys are readable by everyone" ON public."user_keys";
DROP POLICY "Users can insert their own public key" ON public."user_keys";
DROP POLICY "Users can update their own public key" ON public."user_keys";
DROP POLICY "Users can update their own public keys" ON public."user_keys";
DROP POLICY "Users and partners can view settings" ON public."user_settings";
DROP POLICY "Users can insert their own settings" ON public."user_settings";
DROP POLICY "Users can update their own settings" ON public."user_settings";

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles(id,email,full_name,role,created_at,updated_at)
  VALUES(NEW.id,NEW.email,NEW.raw_user_meta_data->>'full_name',
    CASE WHEN NEW.raw_user_meta_data->>'is_partner'='true' OR NEW.raw_user_meta_data->>'role'='partner' THEN 'partner' ELSE 'user' END,now(),now())
  ON CONFLICT(id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.set_admin_role() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RETURN NEW; END $$;
-- Preserve existing administrator assignments; clients cannot grant themselves that role.
CREATE OR REPLACE FUNCTION public.guard_profile_role() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF current_user IN ('authenticated','anon') AND
    ((TG_OP='INSERT' AND NEW.role NOT IN ('user','partner')) OR
     (TG_OP='UPDATE' AND NEW.role IS DISTINCT FROM OLD.role AND (NEW.role='admin' OR OLD.role='admin'))) THEN
   RAISE EXCEPTION 'Administrator roles require a trusted administrator' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_profile_role BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role();

CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated USING (
 id=(SELECT auth.uid()) OR (SELECT public.is_admin()) OR id IN (
 SELECT CASE WHEN c.partner_1_id=(SELECT auth.uid()) THEN c.partner_2_id ELSE c.partner_1_id END
 FROM public.couples c WHERE c.status='active' AND (c.partner_1_id=(SELECT auth.uid()) OR c.partner_2_id=(SELECT auth.uid()))));
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated WITH CHECK(id=(SELECT auth.uid()) AND role IN ('user','partner'));
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated USING(id=(SELECT auth.uid())) WITH CHECK(id=(SELECT auth.uid()));

CREATE POLICY couples_read ON public.couples FOR SELECT TO authenticated USING(partner_1_id=(SELECT auth.uid()) OR partner_2_id=(SELECT auth.uid()) OR (SELECT public.is_admin()));
CREATE POLICY couples_insert ON public.couples FOR INSERT TO authenticated WITH CHECK(partner_1_id=(SELECT auth.uid()) AND partner_2_id IS NULL AND status='pending');
CREATE POLICY couples_update ON public.couples FOR UPDATE TO authenticated USING(partner_1_id=(SELECT auth.uid()) OR partner_2_id=(SELECT auth.uid())) WITH CHECK(partner_1_id=(SELECT auth.uid()) OR partner_2_id=(SELECT auth.uid()));
CREATE POLICY couples_delete ON public.couples FOR DELETE TO authenticated USING(partner_1_id=(SELECT auth.uid()) OR partner_2_id=(SELECT auth.uid()));
CREATE OR REPLACE FUNCTION public.guard_couple_membership() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF current_user IN ('authenticated','anon') AND
   (NEW.partner_1_id IS DISTINCT FROM OLD.partner_1_id OR NEW.partner_2_id IS DISTINCT FROM OLD.partner_2_id OR NEW.partner_1_role IS DISTINCT FROM OLD.partner_1_role OR NEW.status IS DISTINCT FROM OLD.status) THEN
   RAISE EXCEPTION 'Pairing membership must be changed through the pairing function' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_couple_membership BEFORE UPDATE ON public.couples FOR EACH ROW EXECUTE FUNCTION public.guard_couple_membership();
CREATE POLICY daily_logs_read ON public.daily_logs FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR user_id=(SELECT public.get_partner_id()));
CREATE POLICY daily_logs_insert ON public.daily_logs FOR INSERT TO authenticated  WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY daily_logs_update ON public.daily_logs FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY daily_logs_delete ON public.daily_logs FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid())) ;
CREATE POLICY user_settings_read ON public.user_settings FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR user_id=(SELECT public.get_partner_id()));
CREATE POLICY user_settings_insert ON public.user_settings FOR INSERT TO authenticated  WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY user_settings_update ON public.user_settings FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY user_fcm_tokens_select ON public.user_fcm_tokens FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid())) ;
CREATE POLICY user_fcm_tokens_insert ON public.user_fcm_tokens FOR INSERT TO authenticated  WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY user_fcm_tokens_update ON public.user_fcm_tokens FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY user_fcm_tokens_delete ON public.user_fcm_tokens FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid())) ;
CREATE POLICY push_subscriptions_select ON public.push_subscriptions FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid())) ;
CREATE POLICY push_subscriptions_insert ON public.push_subscriptions FOR INSERT TO authenticated  WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY push_subscriptions_update ON public.push_subscriptions FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY push_subscriptions_delete ON public.push_subscriptions FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid())) ;
CREATE POLICY identity_backups_select ON public.identity_backups FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid())) ;
CREATE POLICY identity_backups_insert ON public.identity_backups FOR INSERT TO authenticated  WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY identity_backups_update ON public.identity_backups FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY identity_backups_delete ON public.identity_backups FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid())) ;
CREATE POLICY notifications_read ON public.notifications FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY notifications_insert ON public.notifications FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()) OR EXISTS(SELECT 1 FROM public.couples c WHERE c.status='active' AND ((c.partner_1_id=(SELECT auth.uid()) AND c.partner_2_id=user_id) OR (c.partner_2_id=(SELECT auth.uid()) AND c.partner_1_id=user_id))));
CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY notifications_delete ON public.notifications FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid()));

CREATE POLICY shared_notes_read ON public.shared_notes FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.couples c WHERE c.id=couple_id AND (c.partner_1_id=(SELECT auth.uid()) OR c.partner_2_id=(SELECT auth.uid()))));
CREATE POLICY shared_notes_insert ON public.shared_notes FOR INSERT TO authenticated WITH CHECK(sender_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.couples c WHERE c.id=couple_id AND c.status='active' AND (c.partner_1_id=(SELECT auth.uid()) OR c.partner_2_id=(SELECT auth.uid()))));
CREATE POLICY shared_notes_update ON public.shared_notes FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM public.couples c WHERE c.id=couple_id AND (c.partner_1_id=(SELECT auth.uid()) OR c.partner_2_id=(SELECT auth.uid())))) WITH CHECK(EXISTS(SELECT 1 FROM public.couples c WHERE c.id=couple_id AND (c.partner_1_id=(SELECT auth.uid()) OR c.partner_2_id=(SELECT auth.uid()))));
CREATE POLICY shared_notes_delete ON public.shared_notes FOR DELETE TO authenticated USING(sender_id=(SELECT auth.uid()));

CREATE POLICY user_keys_read ON public.user_keys FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR EXISTS(SELECT 1 FROM public.couples c WHERE c.status='active' AND ((c.partner_1_id=(SELECT auth.uid()) AND c.partner_2_id=user_id) OR (c.partner_2_id=(SELECT auth.uid()) AND c.partner_1_id=user_id))));
CREATE POLICY user_keys_insert ON public.user_keys FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY user_keys_update ON public.user_keys FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY user_keys_delete ON public.user_keys FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY note_keys_read ON public.note_keys FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY note_keys_insert ON public.note_keys FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM public.shared_notes n JOIN public.couples c ON c.id=n.couple_id WHERE n.id=note_id AND n.sender_id=(SELECT auth.uid()) AND user_id IN(c.partner_1_id,c.partner_2_id)));
CREATE POLICY sync_sessions_read ON public.sync_sessions FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) AND created_at>now()-interval '10 minutes');
CREATE POLICY sync_sessions_insert ON public.sync_sessions FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()) AND created_at>now()-interval '10 minutes');
CREATE POLICY sync_sessions_update ON public.sync_sessions FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid()) AND created_at>now()-interval '10 minutes') WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY sync_sessions_delete ON public.sync_sessions FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.join_couple(code_input text) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid := auth.uid(); v_role text; v_couple public.couples%ROWTYPE;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text,0));
 IF EXISTS(SELECT 1 FROM public.couples WHERE status='active' AND (partner_1_id=v_user OR partner_2_id=v_user)) THEN RAISE EXCEPTION 'Already connected to a partner'; END IF;
 SELECT * INTO v_couple FROM public.couples WHERE pairing_code=upper(trim(code_input)) AND status='pending' AND created_at>now()-interval '24 hours' FOR UPDATE;
 IF NOT FOUND OR v_couple.partner_1_id=v_user THEN RAISE EXCEPTION 'Invalid or expired pairing code'; END IF;
 SELECT role INTO v_role FROM public.profiles WHERE id=v_user;
 IF (v_role='partner')=(v_couple.partner_1_role='supporter') THEN RAISE EXCEPTION 'Connect a tracking account with a partner account'; END IF;
 IF EXISTS(SELECT 1 FROM public.couples WHERE status='active' AND (partner_1_id=v_couple.partner_1_id OR partner_2_id=v_couple.partner_1_id)) THEN RAISE EXCEPTION 'Partner is already connected'; END IF;
 UPDATE public.couples SET partner_2_id=v_user,status='active' WHERE id=v_couple.id RETURNING * INTO v_couple;
 RETURN row_to_json(v_couple);
END $$;
CREATE OR REPLACE FUNCTION public.join_couple_love_lock(code_input text) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result json;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 UPDATE public.couples c SET love_unlocked=true WHERE c.love_code=upper(trim(code_input)) AND c.status='active' AND (c.partner_1_id=auth.uid() OR c.partner_2_id=auth.uid()) RETURNING row_to_json(c) INTO v_result;
 IF v_result IS NULL THEN RAISE EXCEPTION 'Invalid unlock code'; END IF;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.handle_new_user(), public.set_admin_role(), public.guard_profile_role(), public.guard_couple_membership() FROM PUBLIC,anon,authenticated;

CREATE INDEX IF NOT EXISTS game_sessions_couple_created_idx ON public.game_sessions(couple_id,game_type,created_at DESC);
CREATE INDEX IF NOT EXISTS game_sessions_player_x_idx ON public.game_sessions(player_x);
CREATE INDEX IF NOT EXISTS game_sessions_player_o_idx ON public.game_sessions(player_o);
CREATE INDEX IF NOT EXISTS note_keys_user_id_idx ON public.note_keys(user_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS shared_notes_reply_to_id_idx ON public.shared_notes(reply_to_id);
CREATE INDEX IF NOT EXISTS sync_sessions_user_created_idx ON public.sync_sessions(user_id,created_at DESC);
-- Verified exact non-unique duplicates; keep the original equivalent index.
DROP INDEX public.idx_couples_partner1;
DROP INDEX public.idx_couples_partner2;
DROP INDEX public.idx_notifications_user_created;
DROP INDEX public.idx_user_fcm_tokens_user_id;
DROP INDEX public.idx_user_keys_user_id;
NOTIFY pgrst, 'reload schema';

;

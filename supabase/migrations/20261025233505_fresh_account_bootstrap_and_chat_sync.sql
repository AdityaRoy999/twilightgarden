SET lock_timeout='5s';
CREATE TABLE public.app_dataset (id boolean PRIMARY KEY DEFAULT true CHECK(id), epoch uuid NOT NULL DEFAULT gen_random_uuid());
INSERT INTO public.app_dataset(id) VALUES(true);
ALTER TABLE public.app_dataset ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.app_dataset TO anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.app_dataset FROM anon,authenticated;
CREATE POLICY dataset_read ON public.app_dataset FOR SELECT TO anon,authenticated USING(true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_dataset;
CREATE FUNCTION public.get_data_epoch() RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$ SELECT epoch::text FROM public.app_dataset WHERE id; $$;
REVOKE ALL ON FUNCTION public.get_data_epoch() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_data_epoch() TO anon,authenticated;

-- A reset removes app profiles, while retaining the existing login accounts.
-- Authorization is restored only from trusted app_metadata, never editable role metadata.
CREATE FUNCTION public.ensure_own_profile() RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user auth.users%ROWTYPE; v_profile public.profiles%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_user FROM auth.users WHERE id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable'; END IF;
 INSERT INTO public.profiles(id,email,full_name,role) VALUES(v_user.id,v_user.email,v_user.raw_user_meta_data->>'full_name',
  CASE WHEN v_user.raw_app_meta_data->>'twilight_role' IN('admin','partner','user') THEN v_user.raw_app_meta_data->>'twilight_role'
   WHEN v_user.raw_user_meta_data->>'is_partner'='true' THEN 'partner' ELSE 'user' END) ON CONFLICT(id) DO NOTHING;
 SELECT * INTO v_profile FROM public.profiles WHERE id=auth.uid(); RETURN v_profile;
END $$;
REVOKE ALL ON FUNCTION public.ensure_own_profile() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ensure_own_profile() TO authenticated;

CREATE FUNCTION public.choose_initial_account_role(p_role text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR p_role NOT IN('user','partner') THEN RAISE EXCEPTION 'Invalid account choice'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role<>'admin' AND created_at>now()-interval '10 minutes')
  OR EXISTS(SELECT 1 FROM public.daily_logs WHERE user_id=auth.uid())
  OR EXISTS(SELECT 1 FROM public.user_settings WHERE user_id=auth.uid() AND onboarding_completed)
  OR EXISTS(SELECT 1 FROM public.couples WHERE partner_1_id=auth.uid() OR partner_2_id=auth.uid()) THEN
  RAISE EXCEPTION 'This existing account already has an account type';
 END IF;
 UPDATE public.profiles SET role=p_role WHERE id=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.choose_initial_account_role(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.choose_initial_account_role(text) TO authenticated;

CREATE FUNCTION public.get_chat_public_key(p_user_id uuid) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_key text;
BEGIN
 IF auth.uid() IS NULL OR (p_user_id<>auth.uid() AND NOT EXISTS(SELECT 1 FROM public.couples c WHERE c.status='active' AND ((c.partner_1_id=auth.uid() AND c.partner_2_id=p_user_id) OR (c.partner_2_id=auth.uid() AND c.partner_1_id=p_user_id)))) THEN
  RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
 END IF;
 SELECT public_key INTO v_key FROM public.identity_backups WHERE user_id=p_user_id;
 IF v_key IS NULL THEN SELECT public_key INTO v_key FROM public.user_keys WHERE user_id=p_user_id ORDER BY created_at LIMIT 1; END IF;
 RETURN v_key;
END $$;
REVOKE ALL ON FUNCTION public.get_chat_public_key(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_chat_public_key(uuid) TO authenticated;

CREATE FUNCTION twilight_private.key_identity(p_key text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT (convert_from(decode(p_key,'base64'),'UTF8')::jsonb)-'key_ops'-'ext';
$$;
REVOKE ALL ON FUNCTION twilight_private.key_identity(text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.guard_registered_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_key text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text,42));
 SELECT public_key INTO v_key FROM public.identity_backups WHERE user_id=NEW.user_id;
 IF v_key IS NULL THEN SELECT public_key INTO v_key FROM public.user_keys WHERE user_id=NEW.user_id ORDER BY created_at LIMIT 1; END IF;
 IF v_key IS NOT NULL AND twilight_private.key_identity(v_key)<>twilight_private.key_identity(NEW.public_key) THEN
  RAISE EXCEPTION 'Restore your existing identity before registering this device' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_registered_identity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_registered_identity BEFORE INSERT OR UPDATE OF public_key ON public.user_keys FOR EACH ROW EXECUTE FUNCTION public.guard_registered_identity();

ALTER TABLE public.shared_notes ADD COLUMN sender_public_key text, ADD COLUMN recipient_public_key text;
CREATE INDEX shared_notes_couple_cursor_idx ON public.shared_notes(couple_id,created_at DESC,id DESC);
CREATE FUNCTION public.send_chat_note(p_id uuid,p_couple uuid,p_content text,p_sender_key text,p_recipient_key text,p_type text DEFAULT 'text',p_media text DEFAULT NULL,p_reply uuid DEFAULT NULL,p_device text DEFAULT NULL)
RETURNS public.shared_notes LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_couple public.couples%ROWTYPE; v_recipient uuid; v_note public.shared_notes%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_couple FROM public.couples WHERE id=p_couple AND status='active' AND auth.uid() IN(partner_1_id,partner_2_id);
 IF NOT FOUND THEN RAISE EXCEPTION 'Active relationship required' USING ERRCODE='42501'; END IF;
 v_recipient:=CASE WHEN v_couple.partner_1_id=auth.uid() THEN v_couple.partner_2_id ELSE v_couple.partner_1_id END;
 IF p_type NOT IN('text','image','audio','gif') OR length(p_content) NOT BETWEEN 32 AND 30000 OR p_content !~ '^[A-Za-z0-9+/=]+$' OR length(coalesce(p_media,''))>12000 THEN RAISE EXCEPTION 'Invalid encrypted message'; END IF;
 IF p_sender_key IS NULL OR p_recipient_key IS NULL OR twilight_private.key_identity(p_sender_key) IS DISTINCT FROM twilight_private.key_identity(public.get_chat_public_key(auth.uid()))
  OR twilight_private.key_identity(p_recipient_key) IS DISTINCT FROM twilight_private.key_identity(public.get_chat_public_key(v_recipient)) THEN RAISE EXCEPTION 'Encryption identity changed. Restore it and retry.'; END IF;
 IF p_reply IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.shared_notes WHERE id=p_reply AND couple_id=p_couple) THEN RAISE EXCEPTION 'Reply unavailable'; END IF;
 INSERT INTO public.shared_notes(id,couple_id,sender_id,sender_device_id,content,type,media_url,reply_to_id,sender_public_key,recipient_public_key)
 VALUES(p_id,p_couple,auth.uid(),p_device,p_content,p_type,p_media,p_reply,p_sender_key,p_recipient_key) ON CONFLICT(id) DO NOTHING;
 SELECT * INTO v_note FROM public.shared_notes WHERE id=p_id AND sender_id=auth.uid() AND couple_id=p_couple;
 IF NOT FOUND THEN RAISE EXCEPTION 'Message identifier unavailable'; END IF;
 RETURN v_note;
END $$;
REVOKE ALL ON FUNCTION public.send_chat_note(uuid,uuid,text,text,text,text,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.send_chat_note(uuid,uuid,text,text,text,text,text,uuid,text) TO authenticated;

CREATE FUNCTION public.broadcast_chat_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  PERFORM realtime.send(jsonb_build_object('id',OLD.id,'couple_id',OLD.couple_id),'note:deleted','couple_main_'||OLD.couple_id::text,true); RETURN OLD;
 END IF;
 PERFORM realtime.send(to_jsonb(NEW),CASE WHEN TG_OP='INSERT' THEN 'note:created' ELSE 'note:updated' END,'couple_main_'||NEW.couple_id::text,true);
 IF TG_OP='INSERT' THEN
  INSERT INTO public.notifications(user_id,type,message,dedupe_key) SELECT CASE WHEN partner_1_id=NEW.sender_id THEN partner_2_id ELSE partner_1_id END,'chat','Your partner sent a private message.',NEW.id::text FROM public.couples WHERE id=NEW.couple_id ON CONFLICT(user_id,dedupe_key) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.broadcast_chat_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER broadcast_chat_change AFTER INSERT OR UPDATE OR DELETE ON public.shared_notes FOR EACH ROW EXECUTE FUNCTION public.broadcast_chat_change();

CREATE OR REPLACE FUNCTION public.can_access_realtime_topic() RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.couples c WHERE (c.partner_1_id=(SELECT auth.uid()) OR c.partner_2_id=(SELECT auth.uid())) AND (
   (SELECT realtime.topic())='couple_main_'||c.id::text OR (c.status='active' AND (SELECT realtime.topic()) IN('call:'||c.id::text,'partner_realtime_'||c.partner_1_id::text,'partner_realtime_'||c.partner_2_id::text))))
 OR EXISTS(SELECT 1 FROM public.game_sessions g WHERE g.id::text=right((SELECT realtime.topic()),36) AND (SELECT realtime.topic()) ~ '^game_[a-z]+_');
$$;
NOTIFY pgrst,'reload schema';

;

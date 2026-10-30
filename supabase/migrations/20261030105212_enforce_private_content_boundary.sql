-- Old clients must fail closed instead of silently repopulating plaintext rows.
REVOKE ALL ON public.daily_logs,public.user_settings FROM anon,authenticated;
REVOKE ALL ON public.shared_cards FROM anon,authenticated;
REVOKE ALL ON FUNCTION public.save_daily_log(date,jsonb,boolean,text),public.save_cycle_settings(jsonb,text) FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.game_sessions FROM anon,authenticated;
REVOKE ALL ON FUNCTION public.open_game_room(uuid,uuid,text,jsonb,jsonb),public.commit_game_action(uuid,uuid,integer,jsonb,jsonb,boolean) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION twilight_private.reject_legacy_private_write() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'CLIENT_UPDATE_REQUIRED: use encrypted private content' USING ERRCODE='42501'; END $$;
REVOKE ALL ON FUNCTION twilight_private.reject_legacy_private_write() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER retire_plain_health BEFORE INSERT OR UPDATE ON public.daily_logs FOR EACH ROW EXECUTE FUNCTION twilight_private.reject_legacy_private_write();
CREATE TRIGGER retire_plain_settings BEFORE INSERT OR UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION twilight_private.reject_legacy_private_write();
CREATE TRIGGER retire_plain_game_secrets BEFORE INSERT OR UPDATE ON public.game_room_secrets FOR EACH ROW EXECUTE FUNCTION twilight_private.reject_legacy_private_write();
CREATE TRIGGER retire_plain_shared_cards BEFORE INSERT OR UPDATE ON public.shared_cards FOR EACH ROW EXECUTE FUNCTION twilight_private.reject_legacy_private_write();
CREATE FUNCTION twilight_private.encrypted_game_only() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.engine_version<>3 OR NEW.board_state<>'{"encrypted":true}'::jsonb THEN RAISE EXCEPTION 'CLIENT_UPDATE_REQUIRED: use encrypted games' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION twilight_private.encrypted_game_only() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER encrypted_game_only BEFORE INSERT OR UPDATE ON public.game_sessions FOR EACH ROW EXECUTE FUNCTION twilight_private.encrypted_game_only();

CREATE FUNCTION twilight_private.metadata_only_profile() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 NEW.email=NULL;NEW.full_name=NULL;NEW.avatar_url=NULL;NEW.bio=NULL;NEW.status=NULL;NEW.partner_nickname=NULL;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION twilight_private.metadata_only_profile() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER metadata_only_profile BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION twilight_private.metadata_only_profile();

CREATE OR REPLACE FUNCTION public.ensure_own_profile() RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user auth.users%ROWTYPE; v_profile public.profiles%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id::text=auth.jwt()->>'session_id' AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Sign in again' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_user FROM auth.users WHERE id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable'; END IF;
 INSERT INTO public.profiles(id,email,role) VALUES(v_user.id,v_user.email,
 CASE WHEN v_user.raw_app_meta_data->>'twilight_role' IN('admin','partner','user') THEN v_user.raw_app_meta_data->>'twilight_role' ELSE 'user' END) ON CONFLICT(id) DO NOTHING;
 SELECT * INTO v_profile FROM public.profiles WHERE id=auth.uid();RETURN v_profile;
END $$;

CREATE OR REPLACE FUNCTION public.choose_initial_account_role(p_role text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR p_role NOT IN('user','partner') OR NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id::text=auth.jwt()->>'session_id' AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Invalid account choice'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role<>'admin' AND created_at>now()-interval '10 minutes')
 OR EXISTS(SELECT 1 FROM public.private_records WHERE owner_id=auth.uid() AND kind IN('daily_logs','health_settings'))
 OR EXISTS(SELECT 1 FROM public.couples WHERE auth.uid() IN(partner_1_id,partner_2_id)) THEN RAISE EXCEPTION 'This account already has an account type'; END IF;
 UPDATE public.profiles SET role=p_role WHERE id=auth.uid();
 UPDATE auth.users SET raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||jsonb_build_object('twilight_role',p_role) WHERE id=auth.uid();
END $$;

CREATE FUNCTION twilight_private.revoke_health_envelopes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT NEW.share_health OR NOT NEW.health_consent OR NOT NEW.core_consent OR NEW.deleting THEN
 UPDATE public.private_records SET recipient_id=NULL,couple_id=NULL,recipient_key=NULL,revision=revision+1 WHERE owner_id=NEW.user_id AND kind IN('daily_logs','health_settings') AND recipient_id IS NOT NULL;
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION twilight_private.revoke_health_envelopes() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER revoke_health_envelopes AFTER UPDATE ON public.privacy_preferences FOR EACH ROW EXECUTE FUNCTION twilight_private.revoke_health_envelopes();

CREATE FUNCTION twilight_private.revoke_couple_envelopes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT NEW.share_enabled OR NEW.status<>'active' THEN UPDATE public.private_records SET recipient_id=NULL,couple_id=NULL,recipient_key=NULL,revision=revision+1 WHERE couple_id=NEW.id AND (kind IN('daily_logs','health_settings') OR NEW.status<>'active'); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION twilight_private.revoke_couple_envelopes() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER revoke_couple_envelopes AFTER UPDATE OF share_enabled,status ON public.couples FOR EACH ROW EXECUTE FUNCTION twilight_private.revoke_couple_envelopes();

-- Without an operator public key, accept category-only rights/safety receipts.
-- Never collect a readable free-text description under an E2EE representation.
ALTER TABLE public.privacy_requests ADD CONSTRAINT category_only_request CHECK(description='Category-only request. No private description submitted.') NOT VALID;

CREATE FUNCTION twilight_private.encrypted_reactions_only() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.reactions IS NOT NULL AND jsonb_typeof(NEW.reactions)<>'string' THEN RAISE EXCEPTION 'Use encrypted reactions. Update Twilight.'; END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION twilight_private.encrypted_reactions_only() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER encrypted_reactions_only BEFORE INSERT OR UPDATE OF reactions ON public.shared_notes FOR EACH ROW EXECUTE FUNCTION twilight_private.encrypted_reactions_only();
UPDATE storage.buckets SET public=false WHERE id='avatars';
CREATE POLICY retire_plain_avatars ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated USING(bucket_id<>'avatars') WITH CHECK(bucket_id<>'avatars');
CREATE FUNCTION twilight_private.generic_notification_content() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.encrypted_payload IS NULL THEN NEW.message='A private update is available. Open Twilight to view it.'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION twilight_private.generic_notification_content() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER generic_notification_content BEFORE INSERT OR UPDATE OF message ON public.notifications FOR EACH ROW EXECUTE FUNCTION twilight_private.generic_notification_content();
ALTER POLICY private_records_read ON public.private_records USING(
 (SELECT twilight_private.privacy_allowed((SELECT auth.uid()),'core')) AND (
  (owner_id=(SELECT auth.uid()) AND (kind NOT IN('daily_logs','health_settings') OR (SELECT twilight_private.privacy_allowed((SELECT auth.uid()),'health'))))
  OR (recipient_id=(SELECT auth.uid()) AND
    ((kind IN('daily_logs','health_settings') AND owner_id=(SELECT public.get_partner_id()))
     OR (kind='profile' AND twilight_private.privacy_allowed(owner_id,'core')))
    AND EXISTS(SELECT 1 FROM public.couples c WHERE c.id=private_records.couple_id AND c.status='active'
      AND (SELECT auth.uid()) IN(c.partner_1_id,c.partner_2_id) AND owner_id IN(c.partner_1_id,c.partner_2_id)))
 ));
CREATE FUNCTION twilight_private.valid_content_envelope(value jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_typeof(value)='object' AND value->'v'='1'::jsonb AND value-ARRAY['v','iv','data']='{}'::jsonb
 AND jsonb_typeof(value->'iv')='string' AND value->>'iv' ~ '^[A-Za-z0-9+/]{16}$'
 AND jsonb_typeof(value->'data')='string' AND length(value->>'data')>=24 AND value->>'data' ~ '^[A-Za-z0-9+/]+={0,2}$',false);
$$;
REVOKE ALL ON FUNCTION twilight_private.valid_content_envelope(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION twilight_private.valid_content_envelope(jsonb) TO authenticated,service_role;
ALTER TABLE public.private_records ADD CONSTRAINT strict_record_envelopes CHECK(twilight_private.valid_content_envelope(ciphertext) AND twilight_private.valid_content_envelope(owner_key) AND (recipient_key IS NULL OR twilight_private.valid_content_envelope(recipient_key))) NOT VALID;
ALTER TABLE public.account_vaults ADD CONSTRAINT strict_vault_backup CHECK(coalesce(
 public_key->>'x' ~ '^[A-Za-z0-9_-]{43}$' AND public_key->>'y' ~ '^[A-Za-z0-9_-]{43}$'
 AND backup->>'salt' ~ '^[A-Za-z0-9+/]{22}==$' AND jsonb_typeof(backup->'iterations')='number'
 AND twilight_private.valid_content_envelope(backup->'sealed'),false)) NOT VALID;
ALTER TABLE public.encrypted_game_commands ADD CONSTRAINT strict_game_command CHECK(twilight_private.valid_content_envelope(ciphertext)) NOT VALID;
ALTER TABLE public.game_sessions ADD CONSTRAINT strict_game_envelopes CHECK(engine_version<>3 OR (encrypted_state IS NULL AND host_secret IS NULL) OR (twilight_private.valid_content_envelope(encrypted_state) AND twilight_private.valid_content_envelope(host_secret))) NOT VALID;

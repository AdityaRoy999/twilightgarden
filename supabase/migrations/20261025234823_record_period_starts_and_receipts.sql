SET lock_timeout='5s';
ALTER TABLE public.daily_logs ADD COLUMN is_period_start boolean NOT NULL DEFAULT false;
CREATE INDEX daily_logs_period_start_idx ON public.daily_logs(user_id,date DESC) WHERE is_period_start;

CREATE FUNCTION public.save_daily_log(p_date date,p_values jsonb,p_period_start boolean DEFAULT false,p_encrypted text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_old boolean; v_log public.daily_logs%ROWTYPE; v_settings public.user_settings%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF p_date>current_date+1 OR octet_length(p_values::text)>20000 OR length(coalesce(p_values->>'notes',''))>500
  OR coalesce(p_values->>'flow','') NOT IN('','spotting','light','medium','heavy')
  OR (p_values->>'sleep_hours')::numeric NOT BETWEEN 0 AND 24
  OR jsonb_typeof(coalesce(p_values->'moods','[]'::jsonb))<>'array' OR jsonb_typeof(coalesce(p_values->'symptoms','[]'::jsonb))<>'array' THEN RAISE EXCEPTION 'Invalid daily log'; END IF;
 IF p_period_start AND coalesce(p_values->>'flow','') NOT IN('light','medium','heavy') THEN RAISE EXCEPTION 'Select your period flow before marking a new period start'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,73));
 SELECT is_period_start INTO v_old FROM public.daily_logs WHERE user_id=auth.uid() AND date=p_date;
 INSERT INTO public.daily_logs(user_id,date,flow,moods,symptoms,notes,energy_level,sleep_quality,sleep_hours,encrypted_payload,is_period_start)
 VALUES(auth.uid(),p_date,p_values->>'flow',ARRAY(SELECT jsonb_array_elements_text(coalesce(p_values->'moods','[]'))),ARRAY(SELECT DISTINCT jsonb_array_elements_text(coalesce(p_values->'symptoms','[]'))),p_values->>'notes',p_values->>'energy_level',p_values->>'sleep_quality',(p_values->>'sleep_hours')::numeric,p_encrypted,p_period_start)
 ON CONFLICT(user_id,date) DO UPDATE SET flow=excluded.flow,moods=excluded.moods,symptoms=excluded.symptoms,notes=excluded.notes,energy_level=excluded.energy_level,sleep_quality=excluded.sleep_quality,sleep_hours=excluded.sleep_hours,encrypted_payload=excluded.encrypted_payload,is_period_start=excluded.is_period_start RETURNING * INTO v_log;
 INSERT INTO public.user_settings(user_id) VALUES(auth.uid()) ON CONFLICT(user_id) DO NOTHING;
 IF p_period_start THEN UPDATE public.user_settings SET last_period_start=greatest(last_period_start,p_date),encrypted_payload=NULL WHERE user_id=auth.uid() AND (last_period_start IS NULL OR last_period_start<=p_date);
 ELSIF v_old THEN UPDATE public.user_settings SET last_period_start=(SELECT max(date) FROM public.daily_logs WHERE user_id=auth.uid() AND is_period_start),encrypted_payload=NULL WHERE user_id=auth.uid() AND last_period_start=p_date; END IF;
 SELECT * INTO v_settings FROM public.user_settings WHERE user_id=auth.uid();
 RETURN jsonb_build_object('log',to_jsonb(v_log),'settings',to_jsonb(v_settings));
END $$;
REVOKE ALL ON FUNCTION public.save_daily_log(date,jsonb,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_daily_log(date,jsonb,boolean,text) TO authenticated;

CREATE FUNCTION public.save_cycle_settings(p_values jsonb,p_encrypted text DEFAULT NULL) RETURNS public.user_settings LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_settings public.user_settings%ROWTYPE; v_start date:=(nullif(p_values->>'last_period_start',''))::date;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF (p_values->>'avg_cycle_length')::integer NOT BETWEEN 20 AND 90 OR (p_values->>'avg_period_length')::integer NOT BETWEEN 1 AND 20
  OR (p_values->>'avg_period_length')::integer>=(p_values->>'avg_cycle_length')::integer OR v_start>current_date+1 THEN RAISE EXCEPTION 'Invalid cycle settings'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,73));
 INSERT INTO public.user_settings(user_id,avg_cycle_length,avg_period_length,last_period_start,onboarding_completed,irregular_cycle,encrypted_payload)
 VALUES(auth.uid(),(p_values->>'avg_cycle_length')::integer,(p_values->>'avg_period_length')::integer,v_start,(p_values->>'onboarding_completed')::boolean,(p_values->>'irregular_cycle')::boolean,p_encrypted)
 ON CONFLICT(user_id) DO UPDATE SET avg_cycle_length=excluded.avg_cycle_length,avg_period_length=excluded.avg_period_length,last_period_start=excluded.last_period_start,onboarding_completed=excluded.onboarding_completed,irregular_cycle=excluded.irregular_cycle,encrypted_payload=excluded.encrypted_payload RETURNING * INTO v_settings;
 IF v_start IS NOT NULL THEN INSERT INTO public.daily_logs(user_id,date,is_period_start) VALUES(auth.uid(),v_start,true) ON CONFLICT(user_id,date) DO UPDATE SET is_period_start=true; END IF;
 RETURN v_settings;
END $$;
REVOKE ALL ON FUNCTION public.save_cycle_settings(jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_cycle_settings(jsonb,text) TO authenticated;

CREATE TRIGGER guard_backup_identity BEFORE INSERT OR UPDATE OF public_key ON public.identity_backups FOR EACH ROW EXECUTE FUNCTION public.guard_registered_identity();
CREATE OR REPLACE FUNCTION public.guard_note_identity() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user IN('authenticated','anon') THEN
  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id OR NEW.couple_id IS DISTINCT FROM OLD.couple_id OR NEW.sender_public_key IS DISTINCT FROM OLD.sender_public_key OR NEW.recipient_public_key IS DISTINCT FROM OLD.recipient_public_key
   OR (OLD.sender_id<>auth.uid() AND (NEW.content IS DISTINCT FROM OLD.content OR NEW.media_url IS DISTINCT FROM OLD.media_url OR NEW.type IS DISTINCT FROM OLD.type)) THEN
   RAISE EXCEPTION 'Cannot change message identity or another sender''s content' USING ERRCODE='42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
   IF OLD.sender_id=auth.uid() THEN RAISE EXCEPTION 'Only the recipient can acknowledge delivery' USING ERRCODE='42501'; END IF;
   IF array_position(ARRAY['sent','delivered','read'],NEW.status)<array_position(ARRAY['sent','delivered','read'],OLD.status) THEN NEW.status:=OLD.status; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
NOTIFY pgrst,'reload schema';

CREATE OR REPLACE FUNCTION public.send_chat_note(p_id uuid,p_couple uuid,p_content text,p_sender_key text,p_recipient_key text,p_type text DEFAULT 'text',p_media text DEFAULT NULL,p_reply uuid DEFAULT NULL,p_device text DEFAULT NULL)
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
 VALUES(p_id,p_couple,auth.uid(),p_device::uuid,p_content,p_type,p_media,p_reply,p_sender_key,p_recipient_key) ON CONFLICT(id) DO NOTHING;
 SELECT * INTO v_note FROM public.shared_notes WHERE id=p_id AND sender_id=auth.uid() AND couple_id=p_couple;
 IF NOT FOUND THEN RAISE EXCEPTION 'Message identifier unavailable'; END IF;
 RETURN v_note;
END $$;
REVOKE ALL ON FUNCTION public.send_chat_note(uuid,uuid,text,text,text,text,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.send_chat_note(uuid,uuid,text,text,text,text,text,uuid,text) TO authenticated;


;

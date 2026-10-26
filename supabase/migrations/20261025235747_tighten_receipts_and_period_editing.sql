CREATE OR REPLACE FUNCTION public.save_daily_log(p_date date,p_values jsonb,p_period_start boolean DEFAULT false,p_encrypted text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_old boolean; v_log public.daily_logs%ROWTYPE; v_settings public.user_settings%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF p_date>current_date+1 OR octet_length(p_values::text)>20000 OR length(coalesce(p_values->>'notes',''))>500
  OR coalesce(p_values->>'flow','') NOT IN('','spotting','light','medium','heavy')
  OR (p_values->>'sleep_hours')::numeric NOT BETWEEN 0 AND 24
  OR jsonb_typeof(coalesce(p_values->'moods','[]'::jsonb))<>'array' OR jsonb_typeof(coalesce(p_values->'symptoms','[]'::jsonb))<>'array' THEN RAISE EXCEPTION 'Invalid daily log'; END IF;
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

CREATE OR REPLACE FUNCTION public.save_cycle_settings(p_values jsonb,p_encrypted text DEFAULT NULL) RETURNS public.user_settings LANGUAGE plpgsql SET search_path='' AS $$
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


;

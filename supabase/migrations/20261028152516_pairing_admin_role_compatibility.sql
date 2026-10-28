-- Preserve the existing administrator-as-tracker pairing behavior.
CREATE OR REPLACE FUNCTION public.generate_pairing_code() RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); c public.couples%ROWTYPE; r text; candidate text;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF NOT public.consume_request_budget(u,'pair-code',20) THEN RAISE EXCEPTION 'Please wait before generating another code'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
 IF EXISTS(SELECT 1 FROM public.couples WHERE status='active' AND u IN(partner_1_id,partner_2_id)) THEN RAISE EXCEPTION 'Already connected. Unlink first.'; END IF;
 SELECT * INTO c FROM public.couples WHERE partner_1_id=u AND status='pending' AND created_at>now()-interval '24 hours' ORDER BY created_at DESC LIMIT 1;
 IF FOUND THEN RETURN row_to_json(c); END IF;
 DELETE FROM public.couples WHERE partner_1_id=u AND status='pending';
 SELECT role INTO r FROM public.profiles WHERE id=u;
 IF r IS NULL THEN RAISE EXCEPTION 'Account unavailable'; END IF;
 LOOP
  candidate:=upper(substr(translate(encode(extensions.gen_random_bytes(9),'base64'),'+/','AZ'),1,6));
  EXIT WHEN NOT EXISTS(SELECT 1 FROM public.couples WHERE pairing_code=candidate);
 END LOOP;
 INSERT INTO public.couples(partner_1_id,partner_1_role,pairing_code,status)
 VALUES(u,CASE WHEN r='partner' THEN 'supporter' ELSE 'menstruator' END,candidate,'pending') RETURNING * INTO c;
 RETURN row_to_json(c);
END $$;

create or replace function public.consume_request_budget(p_user_id uuid,p_action text,p_limit integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_count integer;v_window timestamptz;
begin
 if p_user_id is null or p_action is null or p_limit is null
 or p_action not in('ai','push','turn-credentials','game-move','game-ai','pair-code','pair-join','unlink') or p_limit not between 1 and 120 then return false;end if;
 v_window:=case when p_action='turn-credentials' then date_trunc('hour',now()) else date_trunc('minute',now()) end;
 delete from twilight_private.request_budgets where user_id=p_user_id and window_start<now()-interval '1 hour';
 insert into twilight_private.request_budgets(user_id,action,window_start,requests) values(p_user_id,p_action,v_window,1)
 on conflict(user_id,action,window_start) do update set requests=request_budgets.requests+1 returning requests into v_count;
 return v_count<=p_limit;
end $$;

-- A conversation is removed atomically; Storage cleanup is durable and retryable.
CREATE TABLE public.chat_cleanup_jobs (
 couple_id uuid PRIMARY KEY,
 member_ids uuid[] NOT NULL,
 requested_at timestamptz NOT NULL DEFAULT now(),
 cleaned_at timestamptz,
 attempts integer NOT NULL DEFAULT 0
);
ALTER TABLE public.chat_cleanup_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_cleanup_jobs FROM anon, authenticated;
GRANT ALL ON public.chat_cleanup_jobs TO service_role;

CREATE FUNCTION public.unlink_relationship(p_couple uuid,p_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.couples%ROWTYPE; members uuid[]; rooms text[];
BEGIN
 SELECT * INTO c FROM public.couples WHERE id=p_couple FOR UPDATE;
 IF NOT FOUND THEN
  IF EXISTS(SELECT 1 FROM public.chat_cleanup_jobs WHERE couple_id=p_couple AND p_actor=ANY(member_ids)) THEN RETURN; END IF;
  RAISE EXCEPTION 'Connection unavailable' USING ERRCODE='42501';
 END IF;
 IF p_actor IS NULL OR (p_actor IS DISTINCT FROM c.partner_1_id AND p_actor IS DISTINCT FROM c.partner_2_id) THEN
  RAISE EXCEPTION 'Connection unavailable' USING ERRCODE='42501';
 END IF;
 members:=array_remove(ARRAY[c.partner_1_id,c.partner_2_id],NULL);
 INSERT INTO public.chat_cleanup_jobs(couple_id,member_ids) VALUES(c.id,members) ON CONFLICT DO NOTHING;
 SELECT array_agg(id::text) INTO rooms FROM public.game_sessions WHERE couple_id=c.id;
 DELETE FROM public.notifications WHERE user_id=ANY(members) AND
  (dedupe_key IN(SELECT id::text FROM public.shared_notes WHERE couple_id=c.id)
   OR data->>'roomId'=ANY(coalesce(rooms,ARRAY[]::text[])) OR data->>'coupleId'=c.id::text);
 DELETE FROM public.shared_notes WHERE couple_id=c.id;
 DELETE FROM public.couples WHERE id=c.id;
 -- Account-scoped delivery still works after membership has been removed.
 PERFORM realtime.send(jsonb_build_object('couple_id',c.id),'relationship:deleted','couple_account_'||m::text,true) FROM unnest(members) m;
END $$;
REVOKE ALL ON FUNCTION public.unlink_relationship(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unlink_relationship(uuid,uuid) TO service_role;
CREATE POLICY own_relationship_events ON realtime.messages FOR SELECT TO authenticated
 USING((SELECT realtime.topic())='couple_account_'||(SELECT auth.uid())::text);
NOTIFY pgrst,'reload schema';

-- Active relationships must go through the cleanup endpoint.
DROP POLICY couples_delete ON public.couples;
CREATE POLICY couples_delete ON public.couples FOR DELETE TO authenticated
 USING(status='pending' AND partner_1_id=(SELECT auth.uid()));

CREATE FUNCTION public.generate_pairing_code() RETURNS json
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
 IF r NOT IN('user','partner') OR r IS NULL THEN RAISE EXCEPTION 'Account unavailable'; END IF;
 LOOP
  candidate:=upper(substr(translate(encode(extensions.gen_random_bytes(9),'base64'),'+/','AZ'),1,6));
  EXIT WHEN NOT EXISTS(SELECT 1 FROM public.couples WHERE pairing_code=candidate);
 END LOOP;
 INSERT INTO public.couples(partner_1_id,partner_1_role,pairing_code,status)
 VALUES(u,CASE WHEN r='partner' THEN 'supporter' ELSE 'menstruator' END,candidate,'pending') RETURNING * INTO c;
 RETURN row_to_json(c);
END $$;
REVOKE ALL ON FUNCTION public.generate_pairing_code() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.generate_pairing_code() TO authenticated;

CREATE OR REPLACE FUNCTION public.join_couple(code_input text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); c public.couples%ROWTYPE; r text; owner_id uuid;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF NOT public.consume_request_budget(u,'pair-join',30) THEN RAISE EXCEPTION 'Please wait before trying another code'; END IF;
 IF upper(trim(code_input)) !~ '^[A-Z0-9]{6}$' THEN RAISE EXCEPTION 'Enter a six-character code'; END IF;
 SELECT partner_1_id INTO owner_id FROM public.couples WHERE pairing_code=upper(trim(code_input)) AND status='pending' AND created_at>now()-interval '24 hours';
 IF NOT FOUND OR owner_id=u THEN RAISE EXCEPTION 'Invalid or expired pairing code'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(least(u,owner_id)::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended(greatest(u,owner_id)::text,0));
 SELECT * INTO c FROM public.couples WHERE pairing_code=upper(trim(code_input)) AND status='pending' AND created_at>now()-interval '24 hours' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired pairing code'; END IF;
 IF EXISTS(SELECT 1 FROM public.couples WHERE status='active' AND (u IN(partner_1_id,partner_2_id) OR owner_id IN(partner_1_id,partner_2_id))) THEN RAISE EXCEPTION 'An account is already connected'; END IF;
 SELECT role INTO r FROM public.profiles WHERE id=u;
 IF r IS NULL OR (r='partner')=(c.partner_1_role='supporter') THEN RAISE EXCEPTION 'Connect a tracking account with a partner account'; END IF;
 DELETE FROM public.couples WHERE partner_1_id=u AND status='pending' AND id<>c.id;
 UPDATE public.couples SET partner_2_id=u,status='active' WHERE id=c.id RETURNING * INTO c;
 RETURN row_to_json(c);
END $$;

CREATE OR REPLACE FUNCTION public.unlink_relationship(p_couple uuid, p_actor uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE c public.couples%ROWTYPE; members uuid[]; rooms text[]; m uuid;
BEGIN
 SELECT * INTO c FROM public.couples WHERE id=p_couple;
 IF NOT FOUND THEN
  IF EXISTS(SELECT 1 FROM public.chat_cleanup_jobs WHERE couple_id=p_couple AND p_actor=ANY(member_ids)) THEN RETURN; END IF;
  RAISE EXCEPTION 'Connection unavailable' USING ERRCODE='42501';
 END IF;
 IF p_actor IS NULL OR (p_actor IS DISTINCT FROM c.partner_1_id AND p_actor IS DISTINCT FROM c.partner_2_id) THEN
  RAISE EXCEPTION 'Connection unavailable' USING ERRCODE='42501';
 END IF;
 members:=array_remove(ARRAY[c.partner_1_id,c.partner_2_id],NULL);
 -- Serialize pairing and identity writes before deleting the connection.
 FOR m IN SELECT x FROM unnest(members) x ORDER BY x LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(m::text,0));
 END LOOP;
 SELECT * INTO c FROM public.couples WHERE id=p_couple FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 FOR m IN SELECT x FROM unnest(members) x ORDER BY x LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(m::text,42));
 END LOOP;
 INSERT INTO public.chat_cleanup_jobs(couple_id,member_ids) VALUES(c.id,members) ON CONFLICT DO NOTHING;
 SELECT array_agg(id::text) INTO rooms FROM public.game_sessions WHERE couple_id=c.id;
 DELETE FROM public.notifications WHERE user_id=ANY(members) AND
  (dedupe_key IN(SELECT id::text FROM public.shared_notes WHERE couple_id=c.id)
   OR data->>'roomId'=ANY(coalesce(rooms,ARRAY[]::text[])) OR data->>'coupleId'=c.id::text);
 DELETE FROM public.shared_notes WHERE couple_id=c.id;
 DELETE FROM public.note_keys WHERE user_id=ANY(members);
 DELETE FROM public.sync_sessions WHERE user_id=ANY(members);
 DELETE FROM public.identity_backups WHERE user_id=ANY(members);
 DELETE FROM public.user_keys WHERE user_id=ANY(members);
 -- Personal health uses its independent vault; disconnect only resets chat.
 UPDATE public.notifications SET encrypted_payload=NULL WHERE user_id=ANY(members) AND encrypted_payload IS NOT NULL;
 INSERT INTO public.chat_identity_state(user_id,generation) SELECT x,1 FROM unnest(members) x
 ON CONFLICT(user_id) DO UPDATE SET generation=chat_identity_state.generation+1;
 DELETE FROM public.couples WHERE id=c.id;
 PERFORM realtime.send(jsonb_build_object('couple_id',c.id,'identity_reset',true),'relationship:deleted','couple_account_'||x::text,true) FROM unnest(members) x;
END $function$

-- Only a version counter survives a reset: no public/private keys or backup.
CREATE TABLE public.chat_identity_state (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 generation integer NOT NULL DEFAULT 0 CHECK(generation>=0)
);
ALTER TABLE public.chat_identity_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_identity_state FROM anon,authenticated;
GRANT SELECT ON public.chat_identity_state TO authenticated;
GRANT ALL ON public.chat_identity_state TO service_role;
CREATE POLICY own_identity_generation ON public.chat_identity_state FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()));
ALTER TABLE public.user_keys ADD COLUMN identity_generation integer NOT NULL DEFAULT 0;
ALTER TABLE public.identity_backups ADD COLUMN identity_generation integer NOT NULL DEFAULT 0;
ALTER TABLE public.sync_sessions ADD COLUMN identity_generation integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.guard_registered_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_key text; v_generation integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text,42));
 SELECT generation INTO v_generation FROM public.chat_identity_state WHERE user_id=NEW.user_id;
 IF NEW.identity_generation IS DISTINCT FROM coalesce(v_generation,0) THEN
  RAISE EXCEPTION 'Chat identity was reset. Refresh this device before setting up chat again.' USING ERRCODE='42501';
 END IF;
 SELECT public_key INTO v_key FROM public.identity_backups WHERE user_id=NEW.user_id;
 IF v_key IS NULL THEN SELECT public_key INTO v_key FROM public.user_keys WHERE user_id=NEW.user_id ORDER BY created_at LIMIT 1; END IF;
 IF TG_TABLE_NAME='sync_sessions' THEN
  IF NEW.status='completed' AND (v_key IS NULL OR twilight_private.key_identity((NEW.encrypted_payload::jsonb)->>'senderPublicKey') IS DISTINCT FROM twilight_private.key_identity(v_key)) THEN
   RAISE EXCEPTION 'Device link belongs to a retired identity' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
 END IF;
 IF v_key IS NOT NULL AND twilight_private.key_identity(v_key)<>twilight_private.key_identity(NEW.public_key) THEN
  RAISE EXCEPTION 'Restore your existing identity before registering this device' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_registered_identity() FROM PUBLIC,anon,authenticated;
DROP TRIGGER guard_registered_identity ON public.user_keys;
CREATE TRIGGER guard_registered_identity BEFORE INSERT OR UPDATE ON public.user_keys FOR EACH ROW EXECUTE FUNCTION public.guard_registered_identity();
DROP TRIGGER guard_backup_identity ON public.identity_backups;
CREATE TRIGGER guard_backup_identity BEFORE INSERT OR UPDATE ON public.identity_backups FOR EACH ROW EXECUTE FUNCTION public.guard_registered_identity();
CREATE TRIGGER guard_sync_generation BEFORE INSERT OR UPDATE ON public.sync_sessions FOR EACH ROW EXECUTE FUNCTION public.guard_registered_identity();

-- One snapshot keeps the generation, canonical identity and backup in agreement.
CREATE FUNCTION public.get_own_chat_identity_state() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object(
  'generation',coalesce((SELECT generation FROM public.chat_identity_state WHERE user_id=auth.uid()),0),
  'public_key',public.get_chat_public_key(auth.uid()),
  'has_backup',EXISTS(SELECT 1 FROM public.identity_backups WHERE user_id=auth.uid()),
  'active',EXISTS(SELECT 1 FROM public.couples WHERE status='active' AND auth.uid() IN(partner_1_id,partner_2_id))
 );
$$;
REVOKE ALL ON FUNCTION public.get_own_chat_identity_state() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_own_chat_identity_state() TO authenticated;

CREATE OR REPLACE FUNCTION public.unlink_relationship(p_couple uuid,p_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
 -- Health records retain their structured fields; discard encrypted duplicates
 -- derived from the retired chat key so they cannot shadow later edits.
 UPDATE public.daily_logs SET encrypted_payload=NULL WHERE user_id=ANY(members) AND encrypted_payload IS NOT NULL;
 UPDATE public.user_settings SET encrypted_payload=NULL WHERE user_id=ANY(members) AND encrypted_payload IS NOT NULL;
 UPDATE public.notifications SET encrypted_payload=NULL WHERE user_id=ANY(members) AND encrypted_payload IS NOT NULL;
 INSERT INTO public.chat_identity_state(user_id,generation) SELECT x,1 FROM unnest(members) x
 ON CONFLICT(user_id) DO UPDATE SET generation=chat_identity_state.generation+1;
 DELETE FROM public.couples WHERE id=c.id;
 PERFORM realtime.send(jsonb_build_object('couple_id',c.id,'identity_reset',true),'relationship:deleted','couple_account_'||x::text,true) FROM unnest(members) x;
END $$;
REVOKE ALL ON FUNCTION public.unlink_relationship(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unlink_relationship(uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';

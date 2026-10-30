CREATE TABLE public.vault_chat_backups(
 user_id uuid PRIMARY KEY REFERENCES public.account_vaults(user_id) ON DELETE CASCADE,
 epoch uuid NOT NULL,
 identity_generation integer NOT NULL CHECK(identity_generation>=0),
 public_key text NOT NULL,
 ciphertext jsonb NOT NULL CHECK(twilight_private.valid_content_envelope(ciphertext)),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vault_chat_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vault_chat_backups FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vault_chat_backups TO authenticated;
GRANT ALL ON public.vault_chat_backups TO service_role;
CREATE POLICY own_vault_chat_backup ON public.vault_chat_backups FOR SELECT TO authenticated USING(
 user_id=(SELECT auth.uid()) AND (SELECT twilight_private.privacy_allowed((SELECT auth.uid()),'core'))
 AND identity_generation=coalesce((SELECT generation FROM public.chat_identity_state WHERE user_id=(SELECT auth.uid())),0));

CREATE FUNCTION public.register_vault_chat_identity(p_epoch uuid,p_generation integer,p_public_key text,p_ciphertext jsonb,p_device uuid,p_device_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=auth.uid(); canonical text;
BEGIN
 IF NOT twilight_private.privacy_allowed(a,'core') THEN RAISE EXCEPTION 'Sign in and unlock your private space' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended(a::text,42));
 IF NOT EXISTS(SELECT 1 FROM public.account_vaults WHERE user_id=a AND epoch=p_epoch)
 OR p_generation IS DISTINCT FROM coalesce((SELECT generation FROM public.chat_identity_state WHERE user_id=a),0)
 OR (p_generation>0 AND NOT EXISTS(SELECT 1 FROM public.couples WHERE status='active' AND a IN(partner_1_id,partner_2_id))) THEN
 RAISE EXCEPTION 'Connection changed. Retry secure chat setup.' USING ERRCODE='40001'; END IF;
 IF p_device IS NULL OR p_public_key IS NULL OR twilight_private.key_identity(p_public_key) IS NULL
 OR NOT twilight_private.valid_content_envelope(p_ciphertext) OR octet_length(p_ciphertext::text)>16000 THEN RAISE EXCEPTION 'Invalid encrypted identity'; END IF;
 canonical:=coalesce(public.get_chat_public_key(a),(SELECT public_key FROM public.vault_chat_backups WHERE user_id=a AND identity_generation=p_generation AND epoch=p_epoch));
 IF canonical IS NOT NULL AND twilight_private.key_identity(canonical) IS DISTINCT FROM twilight_private.key_identity(p_public_key) THEN
 RAISE EXCEPTION 'Restore the existing chat identity before registering this device' USING ERRCODE='42501'; END IF;
 INSERT INTO public.vault_chat_backups(user_id,epoch,identity_generation,public_key,ciphertext)
 VALUES(a,p_epoch,p_generation,p_public_key,p_ciphertext)
 ON CONFLICT(user_id) DO UPDATE SET epoch=excluded.epoch,identity_generation=excluded.identity_generation,public_key=excluded.public_key,ciphertext=excluded.ciphertext,updated_at=now();
 INSERT INTO public.user_keys(user_id,device_id,public_key,identity_generation,device_name,last_active)
 VALUES(a,p_device,p_public_key,p_generation,left(coalesce(p_device_name,'Device'),100),now())
 ON CONFLICT(user_id,device_id) DO UPDATE SET public_key=excluded.public_key,identity_generation=excluded.identity_generation,device_name=excluded.device_name,last_active=now(),backup_identity=NULL,backup_salt=NULL;
 DELETE FROM public.identity_backups WHERE user_id=a;
END $$;
REVOKE ALL ON FUNCTION public.register_vault_chat_identity(uuid,integer,text,jsonb,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.register_vault_chat_identity(uuid,integer,text,jsonb,uuid,text) TO authenticated;

CREATE FUNCTION twilight_private.clear_vault_chat_on_reset() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 DELETE FROM public.vault_chat_backups WHERE user_id=NEW.user_id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION twilight_private.clear_vault_chat_on_reset() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER clear_vault_chat_on_reset AFTER INSERT OR UPDATE OF generation ON public.chat_identity_state
 FOR EACH ROW EXECUTE FUNCTION twilight_private.clear_vault_chat_on_reset();

CREATE FUNCTION public.change_vault_backup(p_epoch uuid,p_backup jsonb,p_previous jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT twilight_private.privacy_allowed(auth.uid(),'core') THEN RAISE EXCEPTION 'Sign in again' USING ERRCODE='42501'; END IF;
 UPDATE public.account_vaults SET backup=p_backup WHERE user_id=auth.uid() AND epoch=p_epoch AND backup=p_previous;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vault changed. Sign in again.' USING ERRCODE='40001'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.change_vault_backup(uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.change_vault_backup(uuid,jsonb,jsonb) TO authenticated;

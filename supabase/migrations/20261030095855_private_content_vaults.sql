-- Private keys and plaintext content are never accepted by these APIs.
CREATE TABLE public.account_vaults(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 epoch uuid NOT NULL DEFAULT gen_random_uuid(),
 public_key jsonb NOT NULL CHECK(public_key->>'kty'='EC' AND public_key->>'crv'='P-256' AND NOT public_key ? 'd'),
 backup jsonb NOT NULL CHECK(backup->>'v'='1' AND (backup->>'iterations')::int BETWEEN 600000 AND 1000000 AND octet_length(backup::text)<16000),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_vaults ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_vaults FROM anon,authenticated;
GRANT SELECT,INSERT ON public.account_vaults TO authenticated;
GRANT ALL ON public.account_vaults TO service_role;
CREATE POLICY vault_read ON public.account_vaults FOR SELECT TO authenticated USING(
 twilight_private.privacy_allowed(auth.uid(),'core') AND user_id=auth.uid()
);
CREATE POLICY vault_create ON public.account_vaults FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND twilight_private.privacy_allowed(auth.uid(),'core'));
CREATE FUNCTION public.get_vault_public_key(p_user uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('public_key',v.public_key,'epoch',v.epoch) FROM public.account_vaults v
 WHERE v.user_id=p_user AND twilight_private.privacy_allowed(auth.uid(),'core') AND (p_user=auth.uid() OR EXISTS(
 SELECT 1 FROM public.couples c WHERE c.status='active' AND auth.uid() IN(c.partner_1_id,c.partner_2_id) AND p_user IN(c.partner_1_id,c.partner_2_id)));
$$;
REVOKE ALL ON FUNCTION public.get_vault_public_key(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_vault_public_key(uuid) TO authenticated;

CREATE TABLE public.private_records(
 id text PRIMARY KEY CHECK(id ~ '^[a-f0-9]{64}$'),
 owner_id uuid NOT NULL REFERENCES public.account_vaults(user_id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN('daily_logs','health_settings','preferences','profile','request')),
 epoch uuid NOT NULL,
 ciphertext jsonb NOT NULL CHECK(coalesce(ciphertext->>'v','')='1' AND octet_length(ciphertext::text) BETWEEN 40 AND 262144),
 owner_key jsonb NOT NULL CHECK(coalesce(owner_key->>'v','')='1'),
 recipient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 couple_id uuid REFERENCES public.couples(id) ON DELETE SET NULL,
 recipient_key jsonb,
 revision integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((recipient_id IS NULL AND couple_id IS NULL AND recipient_key IS NULL) OR (recipient_id IS NOT NULL AND couple_id IS NOT NULL AND recipient_key->>'v'='1'))
);
CREATE INDEX private_records_owner_kind ON public.private_records(owner_id,kind,id);
CREATE INDEX private_records_recipient ON public.private_records(recipient_id,couple_id) WHERE recipient_id IS NOT NULL;
ALTER TABLE public.private_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.private_records FROM anon,authenticated;
GRANT SELECT ON public.private_records TO authenticated;
GRANT ALL ON public.private_records TO service_role;
CREATE POLICY private_records_read ON public.private_records FOR SELECT TO authenticated USING(
 twilight_private.privacy_allowed(auth.uid(),'core') AND (
 (owner_id=auth.uid() AND (kind NOT IN('daily_logs','health_settings') OR twilight_private.privacy_allowed(auth.uid(),'health')))
 OR (recipient_id=auth.uid() AND kind IN('daily_logs','health_settings','profile') AND EXISTS(
  SELECT 1 FROM public.couples c WHERE c.id=private_records.couple_id AND c.status='active'
  AND auth.uid() IN(c.partner_1_id,c.partner_2_id) AND owner_id IN(c.partner_1_id,c.partner_2_id)
  AND (kind='profile' OR (c.share_enabled AND twilight_private.privacy_allowed(owner_id,'share')))))
 ));

CREATE FUNCTION public.save_private_records(p_records jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; a uuid:=auth.uid(); v_epoch uuid; n integer;
BEGIN
 IF a IS NULL OR NOT twilight_private.privacy_allowed(a,'core') THEN RAISE EXCEPTION 'Private vault access denied' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_records)<>'array' OR jsonb_array_length(p_records) NOT BETWEEN 1 AND 100 OR octet_length(p_records::text)>2000000 THEN RAISE EXCEPTION 'Invalid encrypted batch'; END IF;
 SELECT epoch INTO v_epoch FROM public.account_vaults WHERE user_id=a;
 IF v_epoch IS NULL THEN RAISE EXCEPTION 'Set up your private vault first'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a::text,984));
 FOR r IN SELECT value FROM jsonb_array_elements(p_records) LOOP
  IF (r->>'owner_id')::uuid<>a OR (r->>'epoch')::uuid<>v_epoch OR r->>'kind' NOT IN('daily_logs','health_settings','preferences','profile','request') THEN RAISE EXCEPTION 'Invalid encrypted identity'; END IF;
  IF r->>'kind' IN('daily_logs','health_settings') AND NOT twilight_private.privacy_allowed(a,'health') THEN RAISE EXCEPTION 'Health consent required' USING ERRCODE='42501'; END IF;
  IF r->>'recipient_id' IS NOT NULL AND (r->>'kind' NOT IN('daily_logs','health_settings','profile') OR NOT EXISTS(
   SELECT 1 FROM public.couples c WHERE c.id=(r->>'couple_id')::uuid AND c.status='active' AND a IN(c.partner_1_id,c.partner_2_id)
   AND (r->>'recipient_id')::uuid IN(c.partner_1_id,c.partner_2_id) AND (r->>'recipient_id')::uuid<>a
   AND (r->>'kind'='profile' OR (c.share_enabled AND twilight_private.privacy_allowed(a,'share'))))) THEN RAISE EXCEPTION 'Sharing access denied' USING ERRCODE='42501'; END IF;
  IF coalesce((r->>'revision')::int,0)=0 THEN
   INSERT INTO public.private_records(id,owner_id,kind,epoch,ciphertext,owner_key,recipient_id,couple_id,recipient_key)
   VALUES(r->>'id',a,r->>'kind',v_epoch,r->'ciphertext',r->'owner_key',(r->>'recipient_id')::uuid,(r->>'couple_id')::uuid,nullif(r->'recipient_key','null'::jsonb)) ON CONFLICT DO NOTHING;
  ELSE
   UPDATE public.private_records SET ciphertext=r->'ciphertext',owner_key=r->'owner_key',recipient_id=(r->>'recipient_id')::uuid,couple_id=(r->>'couple_id')::uuid,recipient_key=nullif(r->'recipient_key','null'::jsonb),revision=revision+1,updated_at=now()
   WHERE id=r->>'id' AND owner_id=a AND kind=r->>'kind' AND epoch=v_epoch AND revision=(r->>'revision')::int;
  END IF;
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Private data changed on another device. Retry.' USING ERRCODE='40001'; END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.save_private_records(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_private_records(jsonb) TO authenticated;

-- Unlinking immediately revokes record envelopes, independently of chat cleanup.
CREATE FUNCTION twilight_private.revoke_private_shares() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.private_records SET recipient_id=NULL,couple_id=NULL,recipient_key=NULL,revision=revision+1 WHERE couple_id=OLD.id;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION twilight_private.revoke_private_shares() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER revoke_private_shares BEFORE DELETE ON public.couples FOR EACH ROW EXECUTE FUNCTION twilight_private.revoke_private_shares();
ALTER PUBLICATION supabase_realtime ADD TABLE public.private_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.account_vaults;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('private-media','private-media',false,6291456,ARRAY['application/octet-stream']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY private_media_owner_write ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='private-media' AND (storage.foldername(name))[1]=auth.uid()::text AND twilight_private.privacy_allowed(auth.uid(),'core'));
CREATE POLICY private_media_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='private-media' AND twilight_private.privacy_allowed(auth.uid(),'core') AND ((storage.foldername(name))[1]=auth.uid()::text OR EXISTS(SELECT 1 FROM public.couples c WHERE c.status='active' AND auth.uid() IN(c.partner_1_id,c.partner_2_id) AND (storage.foldername(name))[1] IN(c.partner_1_id::text,c.partner_2_id::text))));
CREATE POLICY private_media_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='private-media' AND (storage.foldername(name))[1]=auth.uid()::text);

-- New content remains ciphertext; only an unlocked owner can create recipient envelopes.
ALTER TABLE public.private_records DROP CONSTRAINT private_records_kind_check;
ALTER TABLE public.private_records ADD CONSTRAINT private_records_kind_check CHECK(kind IN('daily_logs','health_settings','preferences','profile','request','reproductive_settings','reproductive_entries'));
CREATE OR REPLACE FUNCTION public.save_private_records(p_records jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; a uuid:=auth.uid(); v_epoch uuid; n integer;
BEGIN
 IF a IS NULL OR NOT twilight_private.privacy_allowed(a,'core') THEN RAISE EXCEPTION 'Private vault access denied' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_records)<>'array' OR jsonb_array_length(p_records) NOT BETWEEN 1 AND 100 OR octet_length(p_records::text)>2000000 THEN RAISE EXCEPTION 'Invalid encrypted batch'; END IF;
 SELECT epoch INTO v_epoch FROM public.account_vaults WHERE user_id=a;
 IF v_epoch IS NULL THEN RAISE EXCEPTION 'Set up your private vault first'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a::text,984));
 FOR r IN SELECT value FROM jsonb_array_elements(p_records) LOOP
  IF (r->>'owner_id')::uuid<>a OR (r->>'epoch')::uuid<>v_epoch OR r->>'kind' NOT IN('daily_logs','health_settings','preferences','profile','request','reproductive_settings','reproductive_entries') THEN RAISE EXCEPTION 'Invalid encrypted identity'; END IF;
  IF r->>'kind' IN('daily_logs','health_settings','reproductive_settings','reproductive_entries') AND NOT twilight_private.privacy_allowed(a,'health') THEN RAISE EXCEPTION 'Health consent required' USING ERRCODE='42501'; END IF;
  IF r->>'recipient_id' IS NOT NULL AND (r->>'kind' NOT IN('daily_logs','health_settings','profile','reproductive_entries') OR NOT EXISTS(
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

ALTER POLICY private_records_read ON public.private_records USING(
 (SELECT twilight_private.privacy_allowed((SELECT auth.uid()),'core')) AND (
  (owner_id=(SELECT auth.uid()) AND (kind NOT IN('daily_logs','health_settings','reproductive_settings','reproductive_entries') OR (SELECT twilight_private.privacy_allowed((SELECT auth.uid()),'health'))))
  OR (recipient_id=(SELECT auth.uid()) AND
    ((kind IN('daily_logs','health_settings','reproductive_entries') AND owner_id=(SELECT public.get_partner_id()))
     OR (kind='profile' AND twilight_private.privacy_allowed(owner_id,'core')))
    AND EXISTS(SELECT 1 FROM public.couples c WHERE c.id=private_records.couple_id AND c.status='active'
      AND (SELECT auth.uid()) IN(c.partner_1_id,c.partner_2_id) AND owner_id IN(c.partner_1_id,c.partner_2_id)))
 ));
CREATE OR REPLACE FUNCTION twilight_private.revoke_health_envelopes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT NEW.share_health OR NOT NEW.health_consent OR NOT NEW.core_consent OR NEW.deleting THEN
 UPDATE public.private_records SET recipient_id=NULL,couple_id=NULL,recipient_key=NULL,revision=revision+1 WHERE owner_id=NEW.user_id AND kind IN('daily_logs','health_settings','reproductive_entries') AND recipient_id IS NOT NULL;
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION twilight_private.revoke_health_envelopes() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION twilight_private.revoke_couple_envelopes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT NEW.share_enabled OR NEW.status<>'active' THEN UPDATE public.private_records SET recipient_id=NULL,couple_id=NULL,recipient_key=NULL,revision=revision+1 WHERE couple_id=NEW.id AND (kind IN('daily_logs','health_settings','reproductive_entries') OR NEW.status<>'active'); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION twilight_private.revoke_couple_envelopes() FROM PUBLIC,anon,authenticated;

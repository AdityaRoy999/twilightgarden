-- Same-account device approval (version aligned with hosted migration history).
-- Only a code hash and encrypted vault travel
-- through the service; the 80-bit pairing secret stays on the two devices.
CREATE TABLE public.vault_device_requests (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.account_vaults(user_id) ON DELETE CASCADE,
 epoch uuid NOT NULL, session_id uuid NOT NULL, code_hash text NOT NULL UNIQUE CHECK(code_hash ~ '^[a-f0-9]{64}$'),
 public_key jsonb NOT NULL CHECK(public_key->>'kty'='EC' AND public_key->>'crv'='P-256' AND NOT public_key ? 'd' AND octet_length(public_key::text)<1000),
 device_name text NOT NULL, ciphertext jsonb CHECK(ciphertext IS NULL OR (twilight_private.valid_content_envelope(ciphertext) AND octet_length(ciphertext::text)<16000)),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes'
);
CREATE INDEX vault_device_requests_owner ON public.vault_device_requests(user_id,created_at);
ALTER TABLE public.vault_device_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vault_device_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vault_device_requests TO authenticated;
GRANT ALL ON public.vault_device_requests TO service_role;
CREATE POLICY own_active_device_requests ON public.vault_device_requests FOR SELECT TO authenticated USING(
 user_id=(SELECT auth.uid()) AND expires_at>now() AND (SELECT twilight_private.privacy_allowed((SELECT auth.uid()),'core'))
 AND EXISTS(SELECT 1 FROM public.account_vaults v WHERE v.user_id=vault_device_requests.user_id AND v.epoch=vault_device_requests.epoch));

CREATE FUNCTION public.request_vault_device(p_id uuid,p_epoch uuid,p_hash text,p_key jsonb,p_name text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=auth.uid(); s uuid:=(auth.jwt()->>'session_id')::uuid;
BEGIN
 IF NOT coalesce(twilight_private.privacy_allowed(a,'core'),false) OR s IS NULL THEN RAISE EXCEPTION 'Sign in again' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a::text,984));
 IF NOT EXISTS(SELECT 1 FROM public.account_vaults WHERE user_id=a AND epoch=p_epoch) THEN RAISE EXCEPTION 'Vault changed. Sign in again.' USING ERRCODE='40001'; END IF;
 IF (SELECT count(*) FROM public.vault_device_requests WHERE user_id=a AND created_at>now()-interval '10 minutes')>=5 THEN RAISE EXCEPTION 'Please wait before requesting another device code'; END IF;
 INSERT INTO public.vault_device_requests(id,user_id,epoch,session_id,code_hash,public_key,device_name) VALUES(p_id,a,p_epoch,s,p_hash,p_key,left(coalesce(p_name,'New device'),80));
END $$;
CREATE FUNCTION public.approve_vault_device(p_id uuid,p_hash text,p_ciphertext jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT coalesce(twilight_private.privacy_allowed(auth.uid(),'core'),false) THEN RAISE EXCEPTION 'Sign in again' USING ERRCODE='42501'; END IF;
 UPDATE public.vault_device_requests r SET ciphertext=p_ciphertext WHERE id=p_id AND user_id=auth.uid() AND code_hash=p_hash AND ciphertext IS NULL AND expires_at>now()
 AND session_id::text IS DISTINCT FROM auth.jwt()->>'session_id'
 AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id=r.session_id AND s.user_id=r.user_id)
 AND EXISTS(SELECT 1 FROM public.account_vaults v WHERE v.user_id=r.user_id AND v.epoch=r.epoch);
 IF NOT FOUND OR p_ciphertext IS NULL THEN RAISE EXCEPTION 'Device code expired or already used' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION public.consume_vault_device(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.vault_device_requests;
BEGIN
 IF NOT coalesce(twilight_private.privacy_allowed(auth.uid(),'core'),false) THEN RAISE EXCEPTION 'Sign in again' USING ERRCODE='42501'; END IF;
 DELETE FROM public.vault_device_requests WHERE id=p_id AND user_id=auth.uid() AND session_id::text=auth.jwt()->>'session_id' AND expires_at>now() AND ciphertext IS NOT NULL RETURNING * INTO r;
 RETURN CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('epoch',r.epoch,'ciphertext',r.ciphertext) END;
END $$;
CREATE FUNCTION public.cancel_vault_device(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.vault_device_requests SET expires_at=now(),ciphertext=NULL WHERE id=p_id AND user_id=auth.uid() AND session_id::text=auth.jwt()->>'session_id';
END $$;
REVOKE ALL ON FUNCTION public.request_vault_device(uuid,uuid,text,jsonb,text),public.approve_vault_device(uuid,text,jsonb),public.consume_vault_device(uuid),public.cancel_vault_device(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_vault_device(uuid,uuid,text,jsonb,text),public.approve_vault_device(uuid,text,jsonb),public.consume_vault_device(uuid),public.cancel_vault_device(uuid) TO authenticated;

-- A reset is a separate, retryable operation. Login identity and consent/age
-- evidence survive. All sessions are revoked before ciphertext/storage cleanup.
CREATE TABLE twilight_private.vault_reset_jobs (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, epoch uuid NOT NULL,
 couple_ids uuid[] NOT NULL DEFAULT '{}', requested_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
ALTER TABLE twilight_private.vault_reset_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON twilight_private.vault_reset_jobs FROM PUBLIC,anon,authenticated;
GRANT ALL ON twilight_private.vault_reset_jobs TO service_role;
CREATE FUNCTION public.prepare_vault_reset(p_actor uuid,p_epoch uuid,p_verified_session uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c uuid; ids uuid[];
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,984));
 IF NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id=p_verified_session AND user_id=p_actor AND created_at>now()-interval '2 minutes') THEN RAISE EXCEPTION 'Email verification required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.account_vaults WHERE user_id=p_actor AND epoch=p_epoch) THEN RAISE EXCEPTION 'Vault changed. Start recovery again.' USING ERRCODE='40001'; END IF;
 IF EXISTS(SELECT 1 FROM twilight_private.deletion_jobs WHERE user_id=p_actor AND completed_at IS NULL) THEN RAISE EXCEPTION 'Account deletion is already in progress'; END IF;
 SELECT coalesce(array_agg(id),'{}') INTO ids FROM public.couples WHERE p_actor IN(partner_1_id,partner_2_id);
 INSERT INTO twilight_private.vault_reset_jobs(user_id,epoch,couple_ids) VALUES(p_actor,p_epoch,ids)
 ON CONFLICT(user_id) DO UPDATE SET epoch=excluded.epoch,couple_ids=excluded.couple_ids,requested_at=now(),completed_at=NULL;
 UPDATE public.privacy_preferences SET deleting=true WHERE user_id=p_actor;
 FOREACH c IN ARRAY ids LOOP PERFORM public.unlink_relationship(c,p_actor); END LOOP;
 DELETE FROM public.vault_device_requests WHERE user_id=p_actor;
 DELETE FROM auth.sessions WHERE user_id=p_actor;
END $$;
CREATE FUNCTION public.pending_vault_resets() RETURNS TABLE(user_id uuid,couple_ids uuid[]) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT user_id,couple_ids FROM twilight_private.vault_reset_jobs WHERE completed_at IS NULL ORDER BY requested_at LIMIT 20;
$$;
CREATE FUNCTION public.finish_vault_reset(p_actor uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,984));
 IF NOT EXISTS(SELECT 1 FROM twilight_private.vault_reset_jobs WHERE user_id=p_actor AND completed_at IS NULL) THEN RAISE EXCEPTION 'Reset not requested'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE owner_id=p_actor::text) THEN RAISE EXCEPTION 'Media cleanup is not complete'; END IF;
 DELETE FROM public.shared_notes WHERE sender_id=p_actor;
 DELETE FROM public.game_sessions WHERE p_actor IN(player_x,player_o);
 DELETE FROM public.account_vaults WHERE user_id=p_actor;
 DELETE FROM public.daily_logs WHERE user_id=p_actor;
 DELETE FROM public.user_settings WHERE user_id=p_actor;
 DELETE FROM public.shared_cards WHERE user_id=p_actor;
 DELETE FROM public.notifications WHERE user_id=p_actor;
 DELETE FROM public.push_subscriptions WHERE user_id=p_actor;
 DELETE FROM public.user_fcm_tokens WHERE user_id=p_actor;
 DELETE FROM public.note_keys WHERE user_id=p_actor;
 DELETE FROM public.user_keys WHERE user_id=p_actor;
 DELETE FROM public.sync_sessions WHERE user_id=p_actor;
 DELETE FROM public.identity_backups WHERE user_id=p_actor;
 -- Advance, never rewind, the chat generation to reject delayed old-device writes.
 INSERT INTO public.chat_identity_state(user_id,generation) VALUES(p_actor,1) ON CONFLICT(user_id) DO UPDATE SET generation=chat_identity_state.generation+1;
 UPDATE twilight_private.vault_reset_jobs SET completed_at=now() WHERE user_id=p_actor;
 UPDATE public.privacy_preferences SET deleting=false,share_health=false WHERE user_id=p_actor;
END $$;
REVOKE ALL ON FUNCTION public.prepare_vault_reset(uuid,uuid,uuid),public.pending_vault_resets(),public.finish_vault_reset(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_vault_reset(uuid,uuid,uuid),public.pending_vault_resets(),public.finish_vault_reset(uuid) TO service_role;
SELECT cron.schedule('vault-recovery-retention','42 3 * * *',$job$
 DELETE FROM public.vault_device_requests WHERE expires_at<now()-interval '1 day';
 DELETE FROM twilight_private.vault_reset_jobs WHERE completed_at<now()-interval '7 days';
$job$);

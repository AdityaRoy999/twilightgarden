SET lock_timeout='5s';
-- service_role already bypasses RLS; these permissive-role policies were redundant.
DROP POLICY "Service role insert for service_checks" ON public.service_checks;
DROP POLICY "Service role insert for incidents" ON public.incidents;
DROP POLICY "Service role update for incidents" ON public.incidents;

CREATE OR REPLACE FUNCTION public.guard_couple_membership() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user IN('authenticated','anon') THEN
   IF NEW.partner_1_id IS DISTINCT FROM OLD.partner_1_id OR NEW.partner_2_id IS DISTINCT FROM OLD.partner_2_id OR NEW.partner_1_role IS DISTINCT FROM OLD.partner_1_role OR NEW.status IS DISTINCT FROM OLD.status THEN
     RAISE EXCEPTION 'Pairing membership must be changed through the pairing function' USING ERRCODE='42501';
   END IF;
   IF NEW.share_enabled IS DISTINCT FROM OLD.share_enabled AND auth.uid() IS DISTINCT FROM
      (CASE WHEN OLD.partner_1_role='menstruator' THEN OLD.partner_1_id ELSE OLD.partner_2_id END) THEN
     RAISE EXCEPTION 'Only the person tracking their cycle can change health-data sharing' USING ERRCODE='42501';
   END IF;
 END IF;
 RETURN NEW;
END $$;
DROP POLICY couples_insert ON public.couples;
CREATE POLICY couples_insert ON public.couples FOR INSERT TO authenticated WITH CHECK(
 partner_1_id=(SELECT auth.uid()) AND partner_2_id IS NULL AND status='pending' AND
 partner_1_role=(SELECT CASE WHEN role='partner' THEN 'supporter' ELSE 'menstruator' END FROM public.profiles WHERE id=(SELECT auth.uid())));

CREATE OR REPLACE FUNCTION public.join_couple(code_input text) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid(); v_role text; v_owner_role text; v_couple public.couples%ROWTYPE;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_couple FROM public.couples WHERE pairing_code=upper(trim(code_input)) AND status='pending' AND created_at>now()-interval '24 hours';
 IF NOT FOUND OR v_couple.partner_1_id=v_user THEN RAISE EXCEPTION 'Invalid or expired pairing code'; END IF;
 -- Lock both members in a consistent order: concurrent joins cannot create two active pairings.
 PERFORM pg_advisory_xact_lock(hashtextextended(least(v_user,v_couple.partner_1_id)::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended(greatest(v_user,v_couple.partner_1_id)::text,0));
 SELECT * INTO v_couple FROM public.couples WHERE id=v_couple.id AND status='pending' AND created_at>now()-interval '24 hours' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired pairing code'; END IF;
 IF EXISTS(SELECT 1 FROM public.couples WHERE status='active' AND (partner_1_id IN(v_user,v_couple.partner_1_id) OR partner_2_id IN(v_user,v_couple.partner_1_id))) THEN RAISE EXCEPTION 'One of these accounts is already connected'; END IF;
 SELECT role INTO v_role FROM public.profiles WHERE id=v_user;
 SELECT role INTO v_owner_role FROM public.profiles WHERE id=v_couple.partner_1_id;
 IF v_role NOT IN('user','partner') OR v_owner_role NOT IN('user','partner') OR v_role=v_owner_role THEN RAISE EXCEPTION 'Connect a tracking account with a partner account'; END IF;
 UPDATE public.couples SET partner_2_id=v_user,status='active',partner_1_role=CASE WHEN v_owner_role='partner' THEN 'supporter' ELSE 'menstruator' END WHERE id=v_couple.id RETURNING * INTO v_couple;
 RETURN row_to_json(v_couple);
END $$;

DROP POLICY sync_sessions_insert ON public.sync_sessions;
CREATE POLICY sync_sessions_insert ON public.sync_sessions FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()) AND created_at BETWEEN now()-interval '1 minute' AND now()+interval '1 minute');
CREATE OR REPLACE FUNCTION public.guard_sync_identity() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user IN('authenticated','anon') AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.token IS DISTINCT FROM OLD.token OR NEW.ephemeral_public_key IS DISTINCT FROM OLD.ephemeral_public_key) THEN
   RAISE EXCEPTION 'Cannot change sync identity or extend expiry' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_sync_identity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_sync_identity BEFORE UPDATE ON public.sync_sessions FOR EACH ROW EXECUTE FUNCTION public.guard_sync_identity();
NOTIFY pgrst,'reload schema';

;

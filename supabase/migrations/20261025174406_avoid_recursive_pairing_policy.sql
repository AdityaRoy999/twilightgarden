SET lock_timeout='5s';
DROP POLICY couples_insert ON public.couples;
CREATE POLICY couples_insert ON public.couples FOR INSERT TO authenticated WITH CHECK(partner_1_id=(SELECT auth.uid()) AND partner_2_id IS NULL AND status='pending');

-- Looking up profiles from the couple INSERT policy recurses through profiles_read.
-- The trigger reads the authoritative role as its owner, with no client RPC grant.
CREATE OR REPLACE FUNCTION public.guard_new_couple() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text;
BEGIN
 IF auth.role()='authenticated' THEN
   SELECT role INTO v_role FROM public.profiles WHERE id=auth.uid();
   IF v_role IS NULL OR NEW.partner_1_role IS DISTINCT FROM (CASE WHEN v_role='partner' THEN 'supporter' ELSE 'menstruator' END) THEN
     RAISE EXCEPTION 'Pairing role does not match this account' USING ERRCODE='42501';
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_new_couple() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_new_couple BEFORE INSERT ON public.couples FOR EACH ROW EXECUTE FUNCTION public.guard_new_couple();
NOTIFY pgrst,'reload schema';

;

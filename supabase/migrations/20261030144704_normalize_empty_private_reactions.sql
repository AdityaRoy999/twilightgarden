-- No reactions is metadata, not private content. Normalize legacy defaults.
ALTER TABLE public.shared_notes ALTER COLUMN reactions SET DEFAULT NULL;
CREATE OR REPLACE FUNCTION twilight_private.encrypted_reactions_only() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.reactions='[]'::jsonb THEN NEW.reactions=NULL; END IF;
 IF NEW.reactions IS NOT NULL AND jsonb_typeof(NEW.reactions)<>'string' THEN RAISE EXCEPTION 'Use encrypted reactions. Update Twilight.'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION twilight_private.metadata_only_profile() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id::text=auth.jwt()->>'session_id' AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Sign in again' USING ERRCODE='42501'; END IF;
 NEW.email=NULL;NEW.full_name=NULL;NEW.avatar_url=NULL;NEW.bio=NULL;NEW.status=NULL;NEW.partner_nickname=NULL;
 RETURN NEW;
END $$;

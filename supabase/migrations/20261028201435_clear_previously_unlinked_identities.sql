-- Backfill only completed historical unlinks whose members remain unpaired.
-- Never rotate an active relationship or reset an already-current generation.
DO $$
DECLARE u uuid; previous_couple uuid;
BEGIN
 FOR u IN SELECT DISTINCT member_id FROM public.chat_cleanup_jobs j
  CROSS JOIN LATERAL unnest(j.member_ids) member_id ORDER BY member_id
 LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended(u::text,42));
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=u)
   OR EXISTS(SELECT 1 FROM public.couples WHERE status='active' AND u IN(partner_1_id,partner_2_id))
   OR EXISTS(SELECT 1 FROM public.chat_identity_state WHERE user_id=u) THEN CONTINUE; END IF;
  DELETE FROM public.note_keys WHERE user_id=u;
  DELETE FROM public.sync_sessions WHERE user_id=u;
  DELETE FROM public.identity_backups WHERE user_id=u;
  DELETE FROM public.user_keys WHERE user_id=u;
  UPDATE public.daily_logs SET encrypted_payload=NULL WHERE user_id=u AND encrypted_payload IS NOT NULL;
  UPDATE public.user_settings SET encrypted_payload=NULL WHERE user_id=u AND encrypted_payload IS NOT NULL;
  UPDATE public.notifications SET encrypted_payload=NULL WHERE user_id=u AND encrypted_payload IS NOT NULL;
  INSERT INTO public.chat_identity_state(user_id,generation) VALUES(u,1);
  SELECT couple_id INTO previous_couple FROM public.chat_cleanup_jobs WHERE u=ANY(member_ids) ORDER BY requested_at DESC LIMIT 1;
  PERFORM realtime.send(jsonb_build_object('couple_id',previous_couple,'identity_reset',true),'relationship:deleted','couple_account_'||u::text,true);
 END LOOP;
END $$;

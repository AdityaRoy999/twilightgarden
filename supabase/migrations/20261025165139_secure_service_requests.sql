CREATE SCHEMA IF NOT EXISTS twilight_private;
REVOKE ALL ON SCHEMA twilight_private FROM PUBLIC, anon, authenticated;
CREATE TABLE twilight_private.request_budgets (
  user_id uuid NOT NULL,
  action text NOT NULL,
  window_start timestamptz NOT NULL,
  requests integer NOT NULL,
  PRIMARY KEY(user_id,action,window_start)
);
ALTER TABLE twilight_private.request_budgets ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.consume_request_budget(p_user_id uuid,p_action text,p_limit integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count integer;
BEGIN
  IF p_user_id IS NULL OR p_action NOT IN ('ai','push') OR p_limit NOT BETWEEN 1 AND 120 THEN RETURN false; END IF;
  DELETE FROM twilight_private.request_budgets WHERE user_id=p_user_id AND window_start<now()-interval '1 hour';
  INSERT INTO twilight_private.request_budgets(user_id,action,window_start,requests)
  VALUES(p_user_id,p_action,date_trunc('minute',now()),1)
  ON CONFLICT(user_id,action,window_start) DO UPDATE SET requests=request_budgets.requests+1
  RETURNING requests INTO v_count;
  RETURN v_count<=p_limit;
END $$;
REVOKE ALL ON FUNCTION public.consume_request_budget(uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_request_budget(uuid,text,integer) TO service_role;

DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='twilight_webhook_secret') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'twilight_webhook_secret','Internal Twilight webhook authentication');
  END IF;
END $$;

-- Install the function before switching the trigger; the receiver is deployed first.
CREATE OR REPLACE FUNCTION public.dispatch_chat_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='twilight_webhook_secret';
  IF v_secret IS NULL THEN RAISE WARNING 'Chat push credential unavailable'; RETURN NEW; END IF;
  PERFORM net.http_post(
    url:='https://awijrkxrhlisixufiukw.supabase.co/functions/v1/push-notifications',
    headers:=jsonb_build_object('Content-Type','application/json','x-twilight-webhook',v_secret),
    body:=jsonb_build_object('noteId',NEW.id,'type','chat'),
    timeout_milliseconds:=10000);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_chat_push() FROM PUBLIC,anon,authenticated;

;

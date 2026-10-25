ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key text;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_dedupe_key UNIQUE(user_id,dedupe_key);
CREATE TABLE twilight_private.reminder_deliveries (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_date date NOT NULL,
  kind text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 1,
  completed boolean NOT NULL DEFAULT false,
  PRIMARY KEY(user_id,local_date,kind)
);
ALTER TABLE twilight_private.reminder_deliveries ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.claim_reminder_delivery(p_user_id uuid,p_local_date date,p_kind text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_claimed boolean;
BEGIN
  IF p_kind NOT IN('daily','period-1','period-2','period-3') THEN RETURN false; END IF;
  INSERT INTO twilight_private.reminder_deliveries(user_id,local_date,kind)
  VALUES(p_user_id,p_local_date,p_kind)
  ON CONFLICT(user_id,local_date,kind) DO UPDATE SET claimed_at=now(),attempts=reminder_deliveries.attempts+1
  WHERE NOT reminder_deliveries.completed AND reminder_deliveries.claimed_at<now()-interval '10 minutes' AND reminder_deliveries.attempts<3
  RETURNING true INTO v_claimed;
  RETURN coalesce(v_claimed,false);
END $$;
CREATE OR REPLACE FUNCTION public.complete_reminder_delivery(p_user_id uuid,p_local_date date,p_kind text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  UPDATE twilight_private.reminder_deliveries SET completed=true
  WHERE user_id=p_user_id AND local_date=p_local_date AND kind=p_kind;
$$;
CREATE OR REPLACE FUNCTION public.run_reminder_job() RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_secret text; v_request bigint;
BEGIN
 SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='twilight_webhook_secret';
 IF v_secret IS NULL THEN RAISE EXCEPTION 'Reminder authentication is unavailable'; END IF;
 SELECT net.http_post(url:='https://awijrkxrhlisixufiukw.supabase.co/functions/v1/check-reminders',
   headers:=jsonb_build_object('Content-Type','application/json','x-twilight-webhook',v_secret),
   body:='{}'::jsonb,timeout_milliseconds:=60000) INTO v_request;
 RETURN v_request;
END $$;
REVOKE ALL ON FUNCTION public.claim_reminder_delivery(uuid,date,text),public.complete_reminder_delivery(uuid,date,text),public.run_reminder_job() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reminder_delivery(uuid,date,text),public.complete_reminder_delivery(uuid,date,text),public.run_reminder_job() TO service_role;

CREATE OR REPLACE FUNCTION public.delete_old_notifications() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 DELETE FROM public.notifications WHERE (is_read AND created_at<now()-interval '30 days') OR created_at<now()-interval '90 days';
 DELETE FROM twilight_private.reminder_deliveries WHERE local_date<current_date-30;
 DELETE FROM twilight_private.request_budgets WHERE window_start<now()-interval '1 hour';
END $$;
-- Keep retention maintenance out of the every-minute request path.
SELECT cron.alter_job(jobid,schedule:='0 3 * * *') FROM cron.job WHERE jobname='cleanup-old-notifications';
NOTIFY pgrst,'reload schema';

;

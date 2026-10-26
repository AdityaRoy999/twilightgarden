-- Run through the trusted SQL editor/MCP after applying the TURN budget migration.
-- The transaction rolls back all synthetic budget rows.
BEGIN;
DO $$
DECLARE v_user uuid:=gen_random_uuid(); v_result boolean; v_window timestamptz; v_rows integer;
BEGIN
  FOR v_attempt IN 1..31 LOOP
    v_result:=public.consume_request_budget(v_user,'turn-credentials',30);
    IF v_result IS DISTINCT FROM (v_attempt<=30) THEN
      RAISE EXCEPTION 'Unexpected TURN budget result at attempt %',v_attempt;
    END IF;
  END LOOP;
  SELECT window_start INTO v_window FROM twilight_private.request_budgets WHERE user_id=v_user AND action='turn-credentials';
  IF v_window IS DISTINCT FROM date_trunc('hour',now()) THEN RAISE EXCEPTION 'TURN budget must use an hourly window'; END IF;
  IF NOT public.consume_request_budget(v_user,'ai',1) OR public.consume_request_budget(v_user,'ai',1) THEN RAISE EXCEPTION 'AI budget regressed'; END IF;
  IF NOT public.consume_request_budget(v_user,'push',1) OR public.consume_request_budget(v_user,'push',1) THEN RAISE EXCEPTION 'Push budget regressed'; END IF;
  IF EXISTS(SELECT 1 FROM twilight_private.request_budgets WHERE user_id=v_user AND action IN('ai','push') AND window_start<>date_trunc('minute',now())) THEN RAISE EXCEPTION 'AI/push window changed'; END IF;
  IF public.consume_request_budget(v_user,'unknown',30) OR public.consume_request_budget(v_user,'turn-credentials',NULL) OR public.consume_request_budget(NULL,'turn-credentials',30) THEN RAISE EXCEPTION 'Invalid budget arguments accepted'; END IF;
  SELECT count(*) INTO v_rows FROM twilight_private.request_budgets WHERE user_id=v_user;
  IF v_rows<>3 THEN RAISE EXCEPTION 'Invalid arguments created a budget row'; END IF;
  IF has_function_privilege('anon','public.consume_request_budget(uuid,text,integer)','EXECUTE') OR has_function_privilege('authenticated','public.consume_request_budget(uuid,text,integer)','EXECUTE') THEN RAISE EXCEPTION 'Internal budget helper exposed to clients'; END IF;
  IF NOT has_function_privilege('service_role','public.consume_request_budget(uuid,text,integer)','EXECUTE') THEN RAISE EXCEPTION 'Backend lost budget access'; END IF;
END $$;
ROLLBACK;

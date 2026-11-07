-- Allow authenticated media-room joins through the server-only budget. Other windows
-- remain unchanged. Unknown actions continue to fail closed.
CREATE OR REPLACE FUNCTION public.consume_request_budget(p_user_id uuid,p_action text,p_limit integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count integer;v_window timestamptz;
BEGIN
 IF p_user_id IS NULL OR p_action IS NULL OR p_limit IS NULL
 OR p_action NOT IN('ai','push','turn-credentials','game-move','game-ai','pair-code','pair-join','unlink','account-delete','vault-reset-email','vault-reset-verify','call-room') OR p_limit NOT BETWEEN 1 AND 120 THEN RETURN false; END IF;
 v_window:=CASE WHEN p_action IN('turn-credentials','vault-reset-email','vault-reset-verify') THEN date_trunc('hour',now()) ELSE date_trunc('minute',now()) END;
 DELETE FROM twilight_private.request_budgets WHERE user_id=p_user_id AND window_start<now()-interval '1 hour';
 INSERT INTO twilight_private.request_budgets(user_id,action,window_start,requests) VALUES(p_user_id,p_action,v_window,1)
 ON CONFLICT(user_id,action,window_start) DO UPDATE SET requests=request_budgets.requests+1 RETURNING requests INTO v_count;
 RETURN v_count<=p_limit;
END $$;
REVOKE ALL ON FUNCTION public.consume_request_budget(uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_request_budget(uuid,text,integer) TO service_role;

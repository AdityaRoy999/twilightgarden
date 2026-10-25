
-- Update daily_logs RLS to allow partner access
DROP POLICY IF EXISTS "Users can see own logs" ON daily_logs;
DROP POLICY IF EXISTS "Admins can view all daily logs" ON daily_logs;
DROP POLICY IF EXISTS "Users and partners can view logs" ON daily_logs;

CREATE POLICY "Users and partners can view logs"
ON daily_logs FOR SELECT
USING (
  user_id = auth.uid()
  OR user_id = get_partner_id()
);

-- Keep existing insert/update/delete policies (user can only modify their own)
DROP POLICY IF EXISTS "Users can insert own logs" ON daily_logs;
CREATE POLICY "Users can insert own logs"
ON daily_logs FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own logs" ON daily_logs;
CREATE POLICY "Users can update own logs"
ON daily_logs FOR UPDATE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own logs" ON daily_logs;
CREATE POLICY "Users can delete own logs"
ON daily_logs FOR DELETE
USING (user_id = auth.uid());
;

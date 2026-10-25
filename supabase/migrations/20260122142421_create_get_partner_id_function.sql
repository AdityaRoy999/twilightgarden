
-- Create helper function to get partner's user_id for RLS
CREATE OR REPLACE FUNCTION get_partner_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    CASE
      WHEN partner_1_id = auth.uid() THEN partner_2_id
      ELSE partner_1_id
    END
  FROM couples
  WHERE (partner_1_id = auth.uid() OR partner_2_id = auth.uid())
    AND status = 'active'
    AND share_enabled = true
  LIMIT 1;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_partner_id() TO authenticated;
;


-- Update profiles RLS to allow partner access
DROP POLICY IF EXISTS "Partners can view shared profile" ON profiles;

CREATE POLICY "Partners can view shared profile"
ON profiles FOR SELECT
USING (
  id = auth.uid()
  OR id = get_partner_id()
);
;

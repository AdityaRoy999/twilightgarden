
-- Update user_settings RLS to allow partner access
DROP POLICY IF EXISTS "Users can see their own settings" ON user_settings;
DROP POLICY IF EXISTS "Admins can view all settings" ON user_settings;
DROP POLICY IF EXISTS "Admins can view all user settings" ON user_settings;
DROP POLICY IF EXISTS "Admins can view all user_settings" ON user_settings;
DROP POLICY IF EXISTS "Users and partners can view settings" ON user_settings;

CREATE POLICY "Users and partners can view settings"
ON user_settings FOR SELECT
USING (
  user_id = auth.uid()
  OR user_id = get_partner_id()
);

-- Enable RLS if not already enabled
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
;

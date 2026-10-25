-- Enable RLS on user_settings (just in case)
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own settings
CREATE POLICY "Users can insert their own settings"
ON user_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own settings
CREATE POLICY "Users can update their own settings"
ON user_settings FOR UPDATE
USING (auth.uid() = user_id);
;

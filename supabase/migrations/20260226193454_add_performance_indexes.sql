
-- Performance indexes for hot query paths
-- These speed up every dashboard load, chat load, and notification fetch

-- daily_logs: Queried on every dashboard load by user_id
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_id ON daily_logs(user_id);

-- shared_notes: Queried on every chat open, sorted by created_at DESC
CREATE INDEX IF NOT EXISTS idx_shared_notes_couple_created ON shared_notes(couple_id, created_at DESC);

-- shared_notes: Queried by sender_id for delivery status updates
CREATE INDEX IF NOT EXISTS idx_shared_notes_sender ON shared_notes(sender_id);

-- notifications: Queried on every page load, sorted by created_at DESC
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- couples: Queried by both partner columns on every load
CREATE INDEX IF NOT EXISTS idx_couples_partner1 ON couples(partner_1_id);
CREATE INDEX IF NOT EXISTS idx_couples_partner2 ON couples(partner_2_id);

-- user_keys: Queried during E2EE init and every message decrypt
CREATE INDEX IF NOT EXISTS idx_user_keys_user_id ON user_keys(user_id);

-- identity_backups: Queried during E2EE init
CREATE INDEX IF NOT EXISTS idx_identity_backups_user_id ON identity_backups(user_id);

-- user_fcm_tokens: Queried for push notifications
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user ON user_fcm_tokens(user_id);
;

-- Add UPDATE policy so users can update their own cards
CREATE POLICY "Users can update own shared cards" ON shared_cards
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add unique constraint on user_id (one card per user)
-- First delete duplicates keeping only the oldest one per user
DELETE FROM shared_cards a
USING shared_cards b
WHERE a.user_id = b.user_id
  AND a.created_at > b.created_at;

-- Now add the unique constraint
ALTER TABLE shared_cards ADD CONSTRAINT shared_cards_user_id_unique UNIQUE (user_id);;

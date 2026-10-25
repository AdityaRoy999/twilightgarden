-- Table to store shareable profile card snapshots
CREATE TABLE shared_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    share_code TEXT UNIQUE NOT NULL,
    card_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- Create index for fast lookups by share_code
CREATE INDEX idx_shared_cards_share_code ON shared_cards(share_code);

-- RLS: Anyone can view shared cards (public), only owner can manage
ALTER TABLE shared_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shared cards" ON shared_cards
  FOR SELECT USING (true);

CREATE POLICY "Users can create own shared cards" ON shared_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shared cards" ON shared_cards
  FOR DELETE USING (auth.uid() = user_id);;

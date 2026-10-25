
-- Add partner role and ghost mode columns to couples table
ALTER TABLE couples
  ADD COLUMN IF NOT EXISTS partner_1_role TEXT DEFAULT 'menstruator'
    CHECK (partner_1_role IN ('menstruator', 'supporter')),
  ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN DEFAULT true;

-- Comment for documentation
COMMENT ON COLUMN couples.partner_1_role IS 'Role of partner_1: menstruator (tracks cycle) or supporter (views partner data)';
COMMENT ON COLUMN couples.share_enabled IS 'Ghost mode toggle - when false, partner cannot see cycle data';
;

ALTER TABLE shared_notes DROP CONSTRAINT shared_notes_type_check;
ALTER TABLE shared_notes ADD CONSTRAINT shared_notes_type_check CHECK (type IN ('text', 'image', 'audio', 'gif'));;

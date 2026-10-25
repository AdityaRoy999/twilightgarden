-- Migration: Add message context menu features (reply-to, pin, star, delete, forward)
-- Run this in the Supabase SQL Editor

-- 1. Add reply_to_id: links a reply to the original message
ALTER TABLE public.shared_notes
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.shared_notes(id) ON DELETE SET NULL;

-- 2. Add starred_by: array of user_ids who starred this message
ALTER TABLE public.shared_notes
  ADD COLUMN IF NOT EXISTS starred_by jsonb DEFAULT '[]'::jsonb;

-- 3. Add pinned_by: array of user_ids who pinned this message
ALTER TABLE public.shared_notes
  ADD COLUMN IF NOT EXISTS pinned_by jsonb DEFAULT '[]'::jsonb;

-- 4. Add is_forwarded: flag for forwarded messages
ALTER TABLE public.shared_notes
  ADD COLUMN IF NOT EXISTS is_forwarded boolean DEFAULT false;

-- 5. Add deleted_by: array of user_ids who deleted this message (soft delete per user)
ALTER TABLE public.shared_notes
  ADD COLUMN IF NOT EXISTS deleted_by jsonb DEFAULT '[]'::jsonb;

-- 6. Update the type check constraint to include 'gif' if not already done
ALTER TABLE public.shared_notes
  DROP CONSTRAINT IF EXISTS shared_notes_type_check;
ALTER TABLE public.shared_notes
  ADD CONSTRAINT shared_notes_type_check
  CHECK (type = ANY (ARRAY['text'::text, 'image'::text, 'audio'::text, 'gif'::text]));

-- 7. Index for quickly fetching starred messages
CREATE INDEX IF NOT EXISTS idx_shared_notes_starred_by ON public.shared_notes USING gin (starred_by);

-- 8. Index for quickly fetching pinned messages
CREATE INDEX IF NOT EXISTS idx_shared_notes_pinned_by ON public.shared_notes USING gin (pinned_by);

-- Create couples table
CREATE TABLE IF NOT EXISTS public.couples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_1_id UUID REFERENCES auth.users(id) NOT NULL,
    partner_2_id UUID REFERENCES auth.users(id),
    pairing_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' or 'active'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for queries
CREATE INDEX IF NOT EXISTS couples_partner_1_idx ON public.couples (partner_1_id);
CREATE INDEX IF NOT EXISTS couples_partner_2_idx ON public.couples (partner_2_id);
CREATE INDEX IF NOT EXISTS couples_pairing_code_idx ON public.couples (pairing_code);

-- Enable RLS
ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;

-- Policies for couples
-- Users can see their own couple data
CREATE POLICY "Users can view their own couple data" ON public.couples
    FOR SELECT USING (auth.uid() = partner_1_id OR auth.uid() = partner_2_id);

-- Only partner_1 (creator) can insert initially
CREATE POLICY "Users can create a couple entry" ON public.couples
    FOR INSERT WITH CHECK (auth.uid() = partner_1_id);

-- Both can update (partner_2 updates when joining by setting their ID)
CREATE POLICY "Users can update their couple data" ON public.couples
    FOR UPDATE USING (auth.uid() = partner_1_id OR auth.uid() = partner_2_id OR partner_2_id IS NULL);

-- Create shared_notes table
CREATE TABLE IF NOT EXISTS public.shared_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    couple_id UUID REFERENCES public.couples(id) NOT NULL,
    sender_id UUID REFERENCES auth.users(id) NOT NULL,
    content TEXT NOT NULL,
    reply_content TEXT,
    reactions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for timeline queries
CREATE INDEX IF NOT EXISTS shared_notes_couple_idx ON public.shared_notes (couple_id);
CREATE INDEX IF NOT EXISTS shared_notes_created_at_idx ON public.shared_notes (created_at DESC);

-- Enable RLS
ALTER TABLE public.shared_notes ENABLE ROW LEVEL SECURITY;

-- Policies for shared_notes
-- Users can view notes belonging to their couple
CREATE POLICY "Users can view notes from their couple" ON public.shared_notes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.couples c
            WHERE c.id = shared_notes.couple_id
            AND (c.partner_1_id = auth.uid() OR c.partner_2_id = auth.uid())
        )
    );

-- Users can insert notes if they belong to the couple
CREATE POLICY "Users can insert notes to their couple" ON public.shared_notes
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.couples c
            WHERE c.id = couple_id
            AND (c.partner_1_id = auth.uid() OR c.partner_2_id = auth.uid())
        )
    );

-- Users can update notes (add reply or reactions) if they belong to the couple
CREATE POLICY "Users can update notes in their couple" ON public.shared_notes
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.couples c
            WHERE c.id = couple_id
            AND (c.partner_1_id = auth.uid() OR c.partner_2_id = auth.uid())
        )
    );
;

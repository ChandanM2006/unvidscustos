-- =============================================
-- Calendar & Posts Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. SCHOOL EVENTS (Calendar Layer 1)
-- Holidays, Special Occasions, Exam Periods
-- =============================================
CREATE TABLE IF NOT EXISTS school_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
    
    title TEXT NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    end_date DATE, -- For multi-day events like exam periods
    event_type TEXT CHECK (event_type IN ('holiday', 'occasion', 'exam_period', 'other')) DEFAULT 'other',
    
    -- Visual customization
    color TEXT DEFAULT '#3B82F6', -- Hex color for calendar display
    
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_school_events_school ON school_events(school_id);
CREATE INDEX IF NOT EXISTS idx_school_events_date ON school_events(event_date);
CREATE INDEX IF NOT EXISTS idx_school_events_type ON school_events(event_type);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);

-- RLS
ALTER TABLE school_events ENABLE ROW LEVEL SECURITY;

-- Everyone can view school events
CREATE POLICY "View school events" ON school_events
    FOR SELECT TO authenticated USING (true);

-- Admins manage events
CREATE POLICY "Admins manage events" ON school_events
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin')
        )
    );

-- Posts RLS (if not already set)
-- Everyone can view posts  
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'View all posts'
    ) THEN
        CREATE POLICY "View all posts" ON posts
            FOR SELECT TO authenticated USING (true);
    END IF;
END
$$;

-- Admins manage posts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'Admins manage posts'
    ) THEN
        CREATE POLICY "Admins manage posts" ON posts
            FOR ALL TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM users
                    WHERE users.user_id = auth.uid()
                    AND users.role IN ('super_admin', 'sub_admin')
                )
            );
    END IF;
END
$$;

-- Verification
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('school_events', 'posts');

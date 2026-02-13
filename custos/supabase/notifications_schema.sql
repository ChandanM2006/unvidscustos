-- =============================================
-- Notifications System Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. NOTIFICATIONS
-- All types of notifications
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Recipient
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Content
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT CHECK (type IN (
        'info', 'success', 'warning', 'error',
        'announcement', 'reminder', 'alert',
        'attendance', 'marks', 'fee', 'homework'
    )) DEFAULT 'info',
    
    -- Link/Action
    action_url TEXT,
    action_label TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Scheduling
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 2. ANNOUNCEMENTS (School-wide)
-- =============================================
CREATE TABLE IF NOT EXISTS announcements (
    announcement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
    
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT CHECK (priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',
    
    -- Targeting
    target_audience TEXT CHECK (target_audience IN ('all', 'students', 'teachers', 'parents', 'staff')) DEFAULT 'all',
    target_class_ids UUID[] DEFAULT '{}', -- Empty = all classes
    
    -- Attachments
    attachment_urls TEXT[],
    
    -- Scheduling
    publish_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    is_published BOOLEAN DEFAULT false,
    is_pinned BOOLEAN DEFAULT false,
    
    -- Tracking
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 3. NOTIFICATION PREFERENCES
-- User notification settings
-- =============================================
CREATE TABLE IF NOT EXISTS notification_preferences (
    preference_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE UNIQUE,
    
    -- Email preferences
    email_announcements BOOLEAN DEFAULT true,
    email_attendance BOOLEAN DEFAULT true,
    email_marks BOOLEAN DEFAULT true,
    email_fees BOOLEAN DEFAULT true,
    
    -- Push preferences (for future mobile app)
    push_enabled BOOLEAN DEFAULT true,
    push_announcements BOOLEAN DEFAULT true,
    push_attendance BOOLEAN DEFAULT true,
    push_marks BOOLEAN DEFAULT true,
    
    -- Quiet hours
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_announcements_school ON announcements(school_id);
CREATE INDEX IF NOT EXISTS idx_announcements_published ON announcements(is_published, publish_at);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users see only their notifications
CREATE POLICY "Users view own notifications" ON notifications
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications" ON notifications
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

-- System can insert notifications
CREATE POLICY "System create notifications" ON notifications
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Announcements - view published
CREATE POLICY "View published announcements" ON announcements
    FOR SELECT TO authenticated
    USING (is_published = true OR created_by = auth.uid());

-- Staff manage announcements
CREATE POLICY "Staff manage announcements" ON announcements
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin', 'teacher')
        )
    );

-- Users manage own preferences
CREATE POLICY "Users manage own preferences" ON notification_preferences
    FOR ALL TO authenticated
    USING (user_id = auth.uid());

-- Verification
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('notifications', 'announcements', 'notification_preferences');

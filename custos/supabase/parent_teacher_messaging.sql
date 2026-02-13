-- Parent-Teacher Messaging Schema
-- Run this in Supabase SQL Editor

-- Messages table with child context
CREATE TABLE IF NOT EXISTS parent_teacher_messages (
    message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Participants
    parent_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(user_id) ON DELETE CASCADE, -- The child being discussed
    
    -- Sender (parent or teacher)
    sender_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    sender_role TEXT CHECK (sender_role IN ('parent', 'teacher')),
    
    -- Message content
    subject TEXT,
    message TEXT NOT NULL,
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_messages_parent ON parent_teacher_messages(parent_id);
CREATE INDEX IF NOT EXISTS idx_messages_teacher ON parent_teacher_messages(teacher_id);
CREATE INDEX IF NOT EXISTS idx_messages_student ON parent_teacher_messages(student_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON parent_teacher_messages(created_at DESC);

-- RLS
ALTER TABLE parent_teacher_messages ENABLE ROW LEVEL SECURITY;

-- Parents can see their own messages
CREATE POLICY "Parents view own messages" ON parent_teacher_messages
    FOR SELECT TO authenticated
    USING (parent_id = auth.uid());

-- Teachers can see messages sent to them
CREATE POLICY "Teachers view their messages" ON parent_teacher_messages
    FOR SELECT TO authenticated
    USING (teacher_id = auth.uid());

-- Parents can send messages
CREATE POLICY "Parents send messages" ON parent_teacher_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        parent_id = auth.uid() AND
        sender_id = auth.uid() AND
        sender_role = 'parent'
    );

-- Teachers can send messages
CREATE POLICY "Teachers send messages" ON parent_teacher_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        teacher_id = auth.uid() AND
        sender_id = auth.uid() AND
        sender_role = 'teacher'
    );

-- Both can mark as read
CREATE POLICY "Mark as read" ON parent_teacher_messages
    FOR UPDATE TO authenticated
    USING (parent_id = auth.uid() OR teacher_id = auth.uid());

-- Verify
SELECT 'parent_teacher_messages table created!' as status;

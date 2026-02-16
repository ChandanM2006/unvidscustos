-- =============================================
-- ALTER student_doubts: Add new status values + columns
-- Run this BEFORE the mock data script
-- =============================================

-- 1. Drop the old check constraint and add updated one
ALTER TABLE student_doubts DROP CONSTRAINT IF EXISTS student_doubts_status_check;
ALTER TABLE student_doubts ADD CONSTRAINT student_doubts_status_check
    CHECK (status IN ('open', 'pending', 'ai_answered', 'teacher_answered', 'escalated', 'resolved'));

-- 2. Add new columns that weren't in the original schema
ALTER TABLE student_doubts ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE student_doubts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Create chat_sessions table (for conversation threading)
CREATE TABLE IF NOT EXISTS chat_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
    topic_id UUID REFERENCES lesson_topics(topic_id) ON DELETE SET NULL,
    title TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create chat_messages table (individual messages in a session)
CREATE TABLE IF NOT EXISTS chat_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(session_id) ON DELETE CASCADE NOT NULL,
    role TEXT CHECK (role IN ('user', 'assistant', 'system')) NOT NULL,
    content TEXT NOT NULL,
    photo_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_chat_sessions_student ON chat_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

-- 6. RLS for new tables
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat sessions - students manage own sessions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Students manage own sessions' AND tablename = 'chat_sessions') THEN
        CREATE POLICY "Students manage own sessions" ON chat_sessions
            FOR ALL TO authenticated
            USING (student_id = auth.uid());
    END IF;
END $$;

-- Chat messages - students view own messages
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Students view own messages' AND tablename = 'chat_messages') THEN
        CREATE POLICY "Students view own messages" ON chat_messages
            FOR SELECT TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM chat_sessions
                    WHERE chat_sessions.session_id = chat_messages.session_id
                    AND chat_sessions.student_id = auth.uid()
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Students create messages' AND tablename = 'chat_messages') THEN
        CREATE POLICY "Students create messages" ON chat_messages
            FOR INSERT TO authenticated
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM chat_sessions
                    WHERE chat_sessions.session_id = chat_messages.session_id
                    AND chat_sessions.student_id = auth.uid()
                )
            );
    END IF;
END $$;

-- Verify
SELECT 'student_doubts' as tbl, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'student_doubts'
ORDER BY ordinal_position;

SELECT table_name FROM information_schema.tables
WHERE table_name IN ('chat_sessions', 'chat_messages');

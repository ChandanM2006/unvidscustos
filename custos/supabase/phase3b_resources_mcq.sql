-- =============================================
-- Phase 3B: Topic Resources & MCQ Tables
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. TOPIC RESOURCES TABLE
-- Stores AI-generated resources for each topic
-- =============================================
CREATE TABLE IF NOT EXISTS topic_resources (
    resource_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES lesson_topics(topic_id) ON DELETE CASCADE,
    
    -- 5 Types of AI-generated resources (stored as JSONB)
    lesson_notes JSONB DEFAULT NULL,
    study_guide JSONB DEFAULT NULL,
    worksheet JSONB DEFAULT NULL,
    revision_notes JSONB DEFAULT NULL,
    formulas_list JSONB DEFAULT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(topic_id) -- One resource record per topic
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_topic_resources_topic ON topic_resources(topic_id);

-- RLS
ALTER TABLE topic_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view topic_resources" ON topic_resources
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow teachers and admins to manage topic_resources" ON topic_resources
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin', 'teacher')
        )
    );

-- =============================================
-- 2. MCQ GENERATIONS TABLE
-- Stores AI-generated MCQ sets for each topic
-- =============================================
CREATE TABLE IF NOT EXISTS mcq_generations (
    generation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID REFERENCES lesson_topics(topic_id) ON DELETE CASCADE,
    
    generation_number INTEGER NOT NULL DEFAULT 1,
    mcq_type TEXT CHECK (mcq_type IN ('daily', 'weekly', 'chapter')) DEFAULT 'daily',
    question_count INTEGER DEFAULT 10,
    difficulty_distribution JSONB DEFAULT '{"easy": 3, "medium": 5, "hard": 2}'::jsonb,
    
    -- The actual questions
    questions JSONB NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mcq_generations_topic ON mcq_generations(topic_id);
CREATE INDEX IF NOT EXISTS idx_mcq_generations_type ON mcq_generations(mcq_type);

-- RLS
ALTER TABLE mcq_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view mcq_generations" ON mcq_generations
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow teachers and admins to manage mcq_generations" ON mcq_generations
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin', 'teacher')
        )
    );

-- =============================================
-- 3. STUDENT MCQ ATTEMPTS TABLE
-- Tracks student attempts at MCQ quizzes
-- =============================================
CREATE TABLE IF NOT EXISTS student_mcq_attempts (
    attempt_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    generation_id UUID REFERENCES mcq_generations(generation_id) ON DELETE CASCADE,
    
    answers JSONB NOT NULL, -- {question_id: selected_option}
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    percentage DECIMAL(5,2) NOT NULL,
    time_taken_seconds INTEGER,
    
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_attempts_student ON student_mcq_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_student_attempts_generation ON student_mcq_attempts(generation_id);

-- RLS
ALTER TABLE student_mcq_attempts ENABLE ROW LEVEL SECURITY;

-- Students can view their own attempts
CREATE POLICY "Students can view own attempts" ON student_mcq_attempts
    FOR SELECT TO authenticated
    USING (student_id = auth.uid());

-- Students can insert their own attempts
CREATE POLICY "Students can insert own attempts" ON student_mcq_attempts
    FOR INSERT TO authenticated
    WITH CHECK (student_id = auth.uid());

-- Teachers can view all attempts
CREATE POLICY "Teachers can view all attempts" ON student_mcq_attempts
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin', 'teacher')
        )
    );

-- =============================================
-- VERIFICATION
-- =============================================
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM (
    VALUES ('topic_resources'), ('mcq_generations'), ('student_mcq_attempts')
) as t(table_name);

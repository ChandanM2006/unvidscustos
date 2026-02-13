-- =============================================
-- Student Promotion System Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. STUDENT ACADEMIC HISTORY
-- Tracks a student's journey through years
-- =============================================
CREATE TABLE IF NOT EXISTS student_academic_history (
    history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES academic_years(year_id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(class_id) ON DELETE SET NULL,
    section_id UUID REFERENCES sections(section_id) ON DELETE SET NULL,
    
    -- Status at the end of year
    promotion_status TEXT CHECK (promotion_status IN ('promoted', 'retained', 'transferred', 'graduated', 'dropped')) DEFAULT NULL,
    final_grade TEXT, -- A, B, C, F, etc.
    final_percentage DECIMAL(5,2),
    rank_in_class INTEGER,
    total_students_in_class INTEGER,
    
    -- Remarks
    teacher_remarks TEXT,
    principal_remarks TEXT,
    
    -- Tracking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    promoted_at TIMESTAMP WITH TIME ZONE,
    promoted_by UUID REFERENCES users(user_id),
    
    UNIQUE(student_id, academic_year_id)
);

-- =============================================
-- 2. PROMOTION BATCHES
-- Track bulk promotion operations
-- =============================================
CREATE TABLE IF NOT EXISTS promotion_batches (
    batch_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    from_year_id UUID REFERENCES academic_years(year_id),
    to_year_id UUID REFERENCES academic_years(year_id),
    from_class_id UUID REFERENCES classes(class_id),
    to_class_id UUID REFERENCES classes(class_id),
    
    total_students INTEGER NOT NULL DEFAULT 0,
    promoted_count INTEGER NOT NULL DEFAULT 0,
    retained_count INTEGER NOT NULL DEFAULT 0,
    
    status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
    
    initiated_by UUID REFERENCES users(user_id),
    initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- =============================================
-- 3. PROMOTION RULES (Optional automation)
-- =============================================
CREATE TABLE IF NOT EXISTS promotion_rules (
    rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
    
    from_class_id UUID REFERENCES classes(class_id),
    to_class_id UUID REFERENCES classes(class_id),
    
    -- Criteria
    min_attendance_percentage DECIMAL(5,2) DEFAULT 75.00,
    min_final_percentage DECIMAL(5,2) DEFAULT 35.00,
    required_subjects_pass INTEGER DEFAULT 0, -- 0 = all subjects
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_history_student ON student_academic_history(student_id);
CREATE INDEX IF NOT EXISTS idx_student_history_year ON student_academic_history(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_promotion_batches_year ON promotion_batches(from_year_id, to_year_id);

-- RLS Policies
ALTER TABLE student_academic_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_rules ENABLE ROW LEVEL SECURITY;

-- Students can view their own history
CREATE POLICY "Students view own history" ON student_academic_history
    FOR SELECT TO authenticated
    USING (student_id = auth.uid());

-- Teachers and admins can view all
CREATE POLICY "Staff view all history" ON student_academic_history
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin', 'teacher')
        )
    );

-- Admins can manage history
CREATE POLICY "Admins manage history" ON student_academic_history
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin')
        )
    );

-- Promotion batches - admin only
CREATE POLICY "Admins manage promotion batches" ON promotion_batches
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin')
        )
    );

-- Promotion rules - admin only
CREATE POLICY "Admins manage promotion rules" ON promotion_rules
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin')
        )
    );

-- Verification
SELECT 
    table_name
FROM information_schema.tables 
WHERE table_name IN ('student_academic_history', 'promotion_batches', 'promotion_rules');

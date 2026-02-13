-- =============================================
-- Report Cards Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. EXAM TYPES
-- Quarterly, Half-Yearly, Annual, Unit Tests
-- =============================================
CREATE TABLE IF NOT EXISTS exam_types (
    exam_type_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
    
    name TEXT NOT NULL, -- "Quarterly Exam", "Unit Test 1", etc.
    short_code TEXT, -- "Q1", "UT1", "HY", "ANN"
    weightage DECIMAL(5,2) DEFAULT 100, -- Percentage of final grade
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 2. EXAMS (Specific exam instances)
-- =============================================
CREATE TABLE IF NOT EXISTS exams (
    exam_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_type_id UUID REFERENCES exam_types(exam_type_id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES academic_years(year_id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    status TEXT CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')) DEFAULT 'scheduled',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 3. STUDENT MARKS
-- Individual subject marks for each student
-- =============================================
CREATE TABLE IF NOT EXISTS student_marks (
    mark_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    student_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    exam_id UUID REFERENCES exams(exam_id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(subject_id) ON DELETE CASCADE,
    
    marks_obtained DECIMAL(5,2) NOT NULL,
    max_marks DECIMAL(5,2) DEFAULT 100,
    grade TEXT, -- A+, A, B+, B, C, D, F
    remarks TEXT,
    
    -- Tracking
    entered_by UUID REFERENCES users(user_id),
    entered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(student_id, exam_id, subject_id)
);

-- =============================================
-- 4. REPORT CARDS
-- Generated report cards for students
-- =============================================
CREATE TABLE IF NOT EXISTS report_cards (
    report_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    student_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES academic_years(year_id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(class_id) ON DELETE CASCADE,
    
    -- Aggregate scores
    total_marks DECIMAL(8,2),
    max_total_marks DECIMAL(8,2),
    percentage DECIMAL(5,2),
    overall_grade TEXT,
    rank_in_class INTEGER,
    
    -- Attendance
    total_days INTEGER,
    days_present INTEGER,
    attendance_percentage DECIMAL(5,2),
    
    -- Remarks
    class_teacher_remarks TEXT,
    principal_remarks TEXT,
    
    -- AI-generated summary
    ai_summary JSONB,
    
    -- Status
    status TEXT CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
    published_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(student_id, academic_year_id)
);

-- =============================================
-- 5. GRADING SCALES
-- School-specific grading rules
-- =============================================
CREATE TABLE IF NOT EXISTS grading_scales (
    scale_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
    
    min_percentage DECIMAL(5,2) NOT NULL,
    max_percentage DECIMAL(5,2) NOT NULL,
    grade TEXT NOT NULL,
    grade_point DECIMAL(3,2),
    description TEXT, -- "Excellent", "Good", etc.
    
    UNIQUE(school_id, grade)
);

-- Insert default grading scale
/*
INSERT INTO grading_scales (school_id, min_percentage, max_percentage, grade, grade_point, description)
SELECT 
    (SELECT school_id FROM schools LIMIT 1),
    min_pct, max_pct, grade, gp, desc_text
FROM (VALUES
    (90, 100, 'A+', 10.0, 'Outstanding'),
    (80, 89.99, 'A', 9.0, 'Excellent'),
    (70, 79.99, 'B+', 8.0, 'Very Good'),
    (60, 69.99, 'B', 7.0, 'Good'),
    (50, 59.99, 'C+', 6.0, 'Above Average'),
    (40, 49.99, 'C', 5.0, 'Average'),
    (33, 39.99, 'D', 4.0, 'Below Average'),
    (0, 32.99, 'F', 0.0, 'Needs Improvement')
) AS grades(min_pct, max_pct, grade, gp, desc_text);
*/

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marks_student ON student_marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_exam ON student_marks(exam_id);
CREATE INDEX IF NOT EXISTS idx_reportcard_student ON report_cards(student_id);
CREATE INDEX IF NOT EXISTS idx_exams_year ON exams(academic_year_id);

-- RLS
ALTER TABLE exam_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_scales ENABLE ROW LEVEL SECURITY;

-- View policies
CREATE POLICY "View exam types" ON exam_types
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "View exams" ON exams
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Students view own marks" ON student_marks
    FOR SELECT TO authenticated
    USING (student_id = auth.uid());

CREATE POLICY "Staff view all marks" ON student_marks
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin', 'teacher')
        )
    );

CREATE POLICY "Students view own report" ON report_cards
    FOR SELECT TO authenticated
    USING (student_id = auth.uid());

CREATE POLICY "Staff view all reports" ON report_cards
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin', 'teacher')
        )
    );

-- Manage policies
CREATE POLICY "Staff manage exams" ON exams
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin')
        )
    );

CREATE POLICY "Teachers enter marks" ON student_marks
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin', 'teacher')
        )
    );

CREATE POLICY "Staff update marks" ON student_marks
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin', 'teacher')
        )
    );

CREATE POLICY "Staff manage reports" ON report_cards
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin')
        )
    );

CREATE POLICY "View grading scales" ON grading_scales
    FOR SELECT TO authenticated USING (true);

-- Verification
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('exam_types', 'exams', 'student_marks', 'report_cards', 'grading_scales');

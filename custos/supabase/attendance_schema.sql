-- =============================================
-- Attendance Tracking Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. ATTENDANCE RECORDS
-- Daily attendance for each student
-- =============================================
CREATE TABLE IF NOT EXISTS attendance_records (
    attendance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(class_id) ON DELETE CASCADE,
    section_id UUID REFERENCES sections(section_id) ON DELETE CASCADE,
    
    attendance_date DATE NOT NULL,
    status TEXT CHECK (status IN ('present', 'absent', 'late', 'excused', 'half_day')) NOT NULL,
    
    -- Optional details
    check_in_time TIME,
    check_out_time TIME,
    remarks TEXT,
    
    -- Tracking
    marked_by UUID REFERENCES users(user_id),
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(student_id, attendance_date)
);

-- =============================================
-- 2. ATTENDANCE SUMMARY (Monthly aggregates)
-- =============================================
CREATE TABLE IF NOT EXISTS attendance_summary (
    summary_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES academic_years(year_id) ON DELETE CASCADE,
    month INTEGER CHECK (month >= 1 AND month <= 12),
    year INTEGER,
    
    total_days INTEGER DEFAULT 0,
    present_days INTEGER DEFAULT 0,
    absent_days INTEGER DEFAULT 0,
    late_days INTEGER DEFAULT 0,
    excused_days INTEGER DEFAULT 0,
    
    percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN total_days > 0 THEN (present_days::DECIMAL / total_days) * 100 ELSE 0 END
    ) STORED,
    
    UNIQUE(student_id, academic_year_id, month, year)
);

-- =============================================
-- 3. LEAVE REQUESTS
-- Student leave applications
-- =============================================
CREATE TABLE IF NOT EXISTS leave_requests (
    request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    leave_type TEXT CHECK (leave_type IN ('sick', 'personal', 'family', 'other')) DEFAULT 'personal',
    
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    approved_by UUID REFERENCES users(user_id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_class ON attendance_records(class_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_leave_student ON leave_requests(student_id);

-- RLS
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

-- Attendance - students see own, staff see all
CREATE POLICY "Students view own attendance" ON attendance_records
    FOR SELECT TO authenticated
    USING (student_id = auth.uid());

CREATE POLICY "Staff view all attendance" ON attendance_records
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin', 'teacher')
        )
    );

CREATE POLICY "Teachers mark attendance" ON attendance_records
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin', 'teacher')
        )
    );

CREATE POLICY "Teachers update attendance" ON attendance_records
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin', 'teacher')
        )
    );

-- Summary - same as attendance
CREATE POLICY "View attendance summary" ON attendance_summary
    FOR SELECT TO authenticated
    USING (
        student_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin', 'teacher')
        )
    );

-- Leave requests
CREATE POLICY "Students manage own leave" ON leave_requests
    FOR ALL TO authenticated
    USING (student_id = auth.uid());

CREATE POLICY "Staff view all leave requests" ON leave_requests
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin', 'teacher')
        )
    );

CREATE POLICY "Staff approve leave" ON leave_requests
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin', 'teacher')
        )
    );

-- Verification
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('attendance_records', 'attendance_summary', 'leave_requests');

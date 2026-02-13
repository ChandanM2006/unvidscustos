-- =============================================
-- Teacher Timetable Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. TIMETABLE SLOTS
-- Time periods for the school day
-- =============================================
CREATE TABLE IF NOT EXISTS timetable_slots (
    slot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
    
    slot_number INTEGER NOT NULL, -- 1, 2, 3, etc.
    slot_name TEXT, -- "Period 1", "Lunch", etc.
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_break BOOLEAN DEFAULT false, -- Lunch, recess, etc.
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(school_id, slot_number)
);

-- =============================================
-- 2. TIMETABLE ENTRIES
-- What subject/teacher in which slot
-- =============================================
CREATE TABLE IF NOT EXISTS timetable_entries (
    entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    class_id UUID REFERENCES classes(class_id) ON DELETE CASCADE,
    section_id UUID REFERENCES sections(section_id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(subject_id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sun, 1=Mon, etc.
    slot_id UUID REFERENCES timetable_slots(slot_id) ON DELETE CASCADE,
    
    -- Optional overrides
    room_number TEXT,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(class_id, section_id, day_of_week, slot_id)
);

-- =============================================
-- 3. TEACHER AVAILABILITY
-- Track teacher's free periods
-- =============================================
CREATE TABLE IF NOT EXISTS teacher_availability (
    availability_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    slot_id UUID REFERENCES timetable_slots(slot_id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('available', 'busy', 'leave')) DEFAULT 'available',
    
    UNIQUE(teacher_id, day_of_week, slot_id)
);

-- =============================================
-- 4. SUBSTITUTIONS
-- Track substitute teachers
-- =============================================
CREATE TABLE IF NOT EXISTS timetable_substitutions (
    substitution_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID REFERENCES timetable_entries(entry_id) ON DELETE CASCADE,
    
    original_date DATE NOT NULL,
    substitute_teacher_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    reason TEXT,
    
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_timetable_class ON timetable_entries(class_id, section_id);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON timetable_entries(teacher_id);
CREATE INDEX IF NOT EXISTS idx_timetable_day ON timetable_entries(day_of_week);
CREATE INDEX IF NOT EXISTS idx_availability_teacher ON teacher_availability(teacher_id);

-- RLS
ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_substitutions ENABLE ROW LEVEL SECURITY;

-- Everyone can view timetable
CREATE POLICY "View timetable slots" ON timetable_slots
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "View timetable entries" ON timetable_entries
    FOR SELECT TO authenticated USING (true);

-- Admins manage timetable
CREATE POLICY "Admins manage slots" ON timetable_slots
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin')
        )
    );

CREATE POLICY "Admins manage timetable" ON timetable_entries
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin')
        )
    );

-- Teachers manage own availability
CREATE POLICY "Teachers manage availability" ON teacher_availability
    FOR ALL TO authenticated
    USING (teacher_id = auth.uid());

CREATE POLICY "Admins view all availability" ON teacher_availability
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin')
        )
    );

-- Substitutions
CREATE POLICY "View substitutions" ON timetable_substitutions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage substitutions" ON timetable_substitutions
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin')
        )
    );

-- Insert default time slots (sample for Indian schools)
-- Run after creating tables:
/*
INSERT INTO timetable_slots (school_id, slot_number, slot_name, start_time, end_time, is_break)
SELECT 
    (SELECT school_id FROM schools LIMIT 1),
    slot_number,
    slot_name,
    start_time::TIME,
    end_time::TIME,
    is_break
FROM (VALUES
    (1, 'Period 1', '08:00', '08:45', false),
    (2, 'Period 2', '08:45', '09:30', false),
    (3, 'Period 3', '09:30', '10:15', false),
    (4, 'Short Break', '10:15', '10:30', true),
    (5, 'Period 4', '10:30', '11:15', false),
    (6, 'Period 5', '11:15', '12:00', false),
    (7, 'Lunch', '12:00', '12:45', true),
    (8, 'Period 6', '12:45', '13:30', false),
    (9, 'Period 7', '13:30', '14:15', false),
    (10, 'Period 8', '14:15', '15:00', false)
) AS slots(slot_number, slot_name, start_time, end_time, is_break);
*/

-- Verification
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('timetable_slots', 'timetable_entries', 'teacher_availability', 'timetable_substitutions');

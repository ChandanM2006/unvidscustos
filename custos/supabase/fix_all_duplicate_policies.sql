-- =============================================
-- MASTER FIX: Drop All Duplicate Policies
-- Safe version - handles missing tables
-- =============================================

-- ========== ATTENDANCE POLICIES ==========
DO $$ BEGIN
    DROP POLICY IF EXISTS "Students view own attendance" ON attendance_records;
    DROP POLICY IF EXISTS "Staff view all attendance" ON attendance_records;
    DROP POLICY IF EXISTS "Teachers mark attendance" ON attendance_records;
    DROP POLICY IF EXISTS "Teachers update attendance" ON attendance_records;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "View attendance summary" ON attendance_summary;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Students manage own leave" ON leave_requests;
    DROP POLICY IF EXISTS "Staff view all leave requests" ON leave_requests;
    DROP POLICY IF EXISTS "Staff approve leave" ON leave_requests;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ========== STUDENT PROMOTION POLICIES ==========
DO $$ BEGIN
    DROP POLICY IF EXISTS "Students view own history" ON student_academic_history;
    DROP POLICY IF EXISTS "Staff view all history" ON student_academic_history;
    DROP POLICY IF EXISTS "Admins manage history" ON student_academic_history;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Admins manage promotion batches" ON promotion_batches;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Admins manage promotion rules" ON promotion_rules;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ========== TIMETABLE POLICIES ==========
DO $$ BEGIN
    DROP POLICY IF EXISTS "View timetable slots" ON timetable_slots;
    DROP POLICY IF EXISTS "Admins manage slots" ON timetable_slots;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "View timetable entries" ON timetable_entries;
    DROP POLICY IF EXISTS "Admins manage timetable" ON timetable_entries;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Teachers manage availability" ON teacher_availability;
    DROP POLICY IF EXISTS "Admins view all availability" ON teacher_availability;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "View substitutions" ON timetable_substitutions;
    DROP POLICY IF EXISTS "Admins manage substitutions" ON timetable_substitutions;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ========== REPORT CARDS POLICIES ==========
DO $$ BEGIN
    DROP POLICY IF EXISTS "View exam types" ON exam_types;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "View exams" ON exams;
    DROP POLICY IF EXISTS "Staff manage exams" ON exams;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Students view own marks" ON student_marks;
    DROP POLICY IF EXISTS "Staff view all marks" ON student_marks;
    DROP POLICY IF EXISTS "Teachers enter marks" ON student_marks;
    DROP POLICY IF EXISTS "Staff update marks" ON student_marks;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Students view own report" ON report_cards;
    DROP POLICY IF EXISTS "Staff view all reports" ON report_cards;
    DROP POLICY IF EXISTS "Staff manage reports" ON report_cards;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "View grading scales" ON grading_scales;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

SELECT 'All existing duplicate policies dropped safely!' as status;

-- ============================================
-- CUSTOS Brain: Schema Migration for Weekly & Lesson Tests
-- 
-- Adds columns needed for timed tests and lesson association:
--   1. time_limit_minutes → countdown timer config
--   2. lesson_plan_id     → links lesson tests to their lesson plan
-- ============================================

-- Add time_limit_minutes (nullable: NULL means no timer)
ALTER TABLE assessment_phases
    ADD COLUMN IF NOT EXISTS time_limit_minutes INTEGER DEFAULT NULL;

-- Add lesson_plan_id (links lesson tests to the lesson plan)
ALTER TABLE assessment_phases
    ADD COLUMN IF NOT EXISTS lesson_plan_id UUID DEFAULT NULL;

-- Add index for lesson_plan_id lookups (find all tests for a lesson)
CREATE INDEX IF NOT EXISTS idx_ap_lesson_plan
    ON assessment_phases(lesson_plan_id)
    WHERE lesson_plan_id IS NOT NULL;

-- Add composite index for student + phase_type + status (analytics queries)
CREATE INDEX IF NOT EXISTS idx_ap_student_type_status
    ON assessment_phases(student_id, phase_type, status);

-- Add composite index for student + status + date (trend queries)
CREATE INDEX IF NOT EXISTS idx_ap_student_status_date
    ON assessment_phases(student_id, status, scheduled_date);

-- ============================================
-- DONE! Run this in Supabase SQL Editor before
-- using weekly/lesson test features.
-- ============================================

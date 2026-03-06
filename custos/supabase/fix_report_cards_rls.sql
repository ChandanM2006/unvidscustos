-- =============================================
-- Fix RLS policies for Report Cards tables
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. exam_types: Add INSERT/UPDATE/DELETE for admins
DROP POLICY IF EXISTS "Staff manage exam types" ON exam_types;
CREATE POLICY "Staff manage exam types" ON exam_types
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin')
        )
    );

-- 2. exams: Make sure the FOR ALL policy has WITH CHECK too
DROP POLICY IF EXISTS "Staff manage exams" ON exams;
CREATE POLICY "Staff manage exams" ON exams
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin')
        )
    );

-- 3. grading_scales: Add management policy
DROP POLICY IF EXISTS "Staff manage grading scales" ON grading_scales;
CREATE POLICY "Staff manage grading scales" ON grading_scales
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin')
        )
    );

-- 4. report_cards: Add management policy with WITH CHECK
DROP POLICY IF EXISTS "Staff manage reports" ON report_cards;
CREATE POLICY "Staff manage reports" ON report_cards
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin')
        )
    );

-- Verify
SELECT tablename, policyname, permissive, cmd 
FROM pg_policies 
WHERE tablename IN ('exam_types', 'exams', 'student_marks', 'report_cards', 'grading_scales')
ORDER BY tablename, policyname;

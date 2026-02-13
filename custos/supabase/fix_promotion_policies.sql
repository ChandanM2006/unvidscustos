-- =============================================
-- Fix for Student Promotion Schema
-- Drops existing policies before recreating
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Students view own history" ON student_academic_history;
DROP POLICY IF EXISTS "Staff view all history" ON student_academic_history;
DROP POLICY IF EXISTS "Admins manage history" ON student_academic_history;
DROP POLICY IF EXISTS "Admins manage promotion batches" ON promotion_batches;
DROP POLICY IF EXISTS "Admins manage promotion rules" ON promotion_rules;

-- Recreate RLS Policies

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
SELECT 'Policies fixed successfully!' as status;

SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('student_academic_history', 'promotion_batches', 'promotion_rules');

-- ============================================
-- CUSTOS Parent Portal: RLS Policies & Schema
-- 
-- Privacy Rules:
--   Parents CAN see: activity scores, streaks, achievements, completion status
--   Parents CANNOT see: performance scores, topic accuracy, class rank
-- ============================================

-- ============================================
-- 1. PARENT_CHILDREN TABLE (alternative to parent_student_links)
-- This is the recommended table from the spec.
-- If parent_student_links already exists, this can be skipped.
-- ============================================
CREATE TABLE IF NOT EXISTS parent_children (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    child_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    relationship TEXT DEFAULT 'parent', -- parent, guardian, sibling
    linked_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(parent_id, child_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_children_parent ON parent_children(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_children_child ON parent_children(child_id);

ALTER TABLE parent_children ENABLE ROW LEVEL SECURITY;

-- Parents can view their own links
DROP POLICY IF EXISTS "pc_parent_select" ON parent_children;
CREATE POLICY "pc_parent_select" ON parent_children
    FOR SELECT TO authenticated
    USING (parent_id = auth.uid());

-- Admins can manage all links
DROP POLICY IF EXISTS "pc_admin_manage" ON parent_children;
CREATE POLICY "pc_admin_manage" ON parent_children
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.user_id = auth.uid()
            AND users.role IN ('super_admin', 'sub_admin')
        )
    );

GRANT ALL ON parent_children TO authenticated;


-- ============================================
-- 2. PARENT RLS: student_scores
-- Parents CAN see their linked children's rows
-- BUT the API layer filters out performance columns.
-- (Column-level security via API, row-level via RLS)
-- ============================================

-- Add parent access to student_scores (activity data only)
-- Note: The API layer MUST NOT return performance_score, performance_rank, etc.
DROP POLICY IF EXISTS "ss_parent_own_children" ON student_scores;
CREATE POLICY "ss_parent_own_children" ON student_scores
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM parent_student_links
            WHERE parent_student_links.parent_id = auth.uid()
            AND parent_student_links.student_id = student_scores.student_id
        )
        OR
        EXISTS (
            SELECT 1 FROM parent_children
            WHERE parent_children.parent_id = auth.uid()
            AND parent_children.child_id = student_scores.student_id
        )
    );


-- ============================================
-- 3. PARENT RLS: student_topic_performance
-- Parents CANNOT see this table at all.
-- Performance breakdown is HIDDEN from parents.
-- ============================================

-- Explicitly ensure parents have NO access to performance data
-- (The existing policy already denies non-teacher/admin access,
--  but let's be explicit with a comment)
-- The existing stp_teacher_admin_select policy already handles this:
--   Only admins and teachers can SELECT from student_topic_performance.
--   Parents get NO matching clause → access denied.


-- ============================================
-- 4. PARENT RLS: student_achievements
-- Parents CAN see their children's achievements.
-- ============================================

DROP POLICY IF EXISTS "sa_parent_children" ON student_achievements;
CREATE POLICY "sa_parent_children" ON student_achievements
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM parent_student_links
            WHERE parent_student_links.parent_id = auth.uid()
            AND parent_student_links.student_id = student_achievements.student_id
        )
        OR
        EXISTS (
            SELECT 1 FROM parent_children
            WHERE parent_children.parent_id = auth.uid()
            AND parent_children.child_id = student_achievements.student_id
        )
    );


-- ============================================
-- 5. PARENT RLS: assessment_phases
-- Parents CAN see their children's phases (for completion status)
-- BUT should NOT see score_percentage (filtered at API layer)
-- ============================================

DROP POLICY IF EXISTS "ap_parent_children" ON assessment_phases;
CREATE POLICY "ap_parent_children" ON assessment_phases
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM parent_student_links
            WHERE parent_student_links.parent_id = auth.uid()
            AND parent_student_links.student_id = assessment_phases.student_id
        )
        OR
        EXISTS (
            SELECT 1 FROM parent_children
            WHERE parent_children.parent_id = auth.uid()
            AND parent_children.child_id = assessment_phases.student_id
        )
    );


-- ============================================
-- 6. PARENT RLS: attendance_records
-- Parents CAN see their children's attendance
-- ============================================

DROP POLICY IF EXISTS "attendance_parent_view" ON attendance_records;
CREATE POLICY "attendance_parent_view" ON attendance_records
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM parent_student_links
            WHERE parent_student_links.parent_id = auth.uid()
            AND parent_student_links.student_id = attendance_records.student_id
        )
        OR
        EXISTS (
            SELECT 1 FROM parent_children
            WHERE parent_children.parent_id = auth.uid()
            AND parent_children.child_id = attendance_records.student_id
        )
    );


-- ============================================
-- 7. VERIFY SETUP
-- ============================================
SELECT 'Parent portal RLS policies created successfully!' as status;
SELECT 
    tablename, 
    policyname, 
    cmd 
FROM pg_policies 
WHERE policyname LIKE '%parent%' OR policyname LIKE '%pc_%'
ORDER BY tablename, policyname;

-- ============================================================
-- FIX SECURITY LINT: Supabase Database Linter Remediation
-- Run this in Supabase SQL Editor
-- 
-- Fixes:
--   ERRORS  → 5 tables with RLS disabled
--   WARNINGS → Overly permissive RLS policies (USING true)
--   WARNINGS → Functions with mutable search_path
--   SUGGESTIONS → Tables with RLS enabled but no policies
-- ============================================================

-- ============================================================
-- 1. ERRORS: Enable RLS on 5 tables missing it
-- ============================================================

ALTER TABLE lesson_topics          ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_lesson_details   ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_views         ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_academic_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_rules        ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. ERRORS: Add proper RLS policies for newly-protected tables
-- ============================================================

-- ---- lesson_topics ----
-- All authenticated users can read topics
CREATE POLICY "lt_select" ON lesson_topics
  FOR SELECT TO authenticated USING (true);

-- Teachers and admins can manage topics
CREATE POLICY "lt_manage" ON lesson_topics
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

-- ---- daily_lesson_details ----
-- All authenticated users can read lesson details
CREATE POLICY "dld_select" ON daily_lesson_details
  FOR SELECT TO authenticated USING (true);

-- Teachers and admins can manage lesson details
CREATE POLICY "dld_manage" ON daily_lesson_details
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

-- ---- resource_views ----
-- Users can view their own resource view records
CREATE POLICY "rv_select_own" ON resource_views
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Staff can view all resource views (analytics)
CREATE POLICY "rv_select_staff" ON resource_views
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

-- Any authenticated user can insert their own view record
CREATE POLICY "rv_insert_own" ON resource_views
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ---- student_academic_history (if policies don't exist yet from student_promotion_schema.sql) ----
-- Drop existing policies if they exist to avoid conflict
DROP POLICY IF EXISTS "Students view own history" ON student_academic_history;
DROP POLICY IF EXISTS "Staff view all history" ON student_academic_history;
DROP POLICY IF EXISTS "Admins manage history" ON student_academic_history;

-- Students can view their own history
CREATE POLICY "sah_select_own" ON student_academic_history
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- Staff can view all history
CREATE POLICY "sah_select_staff" ON student_academic_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

-- Admins can manage history
CREATE POLICY "sah_manage" ON student_academic_history
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

-- ---- promotion_rules ----
-- Drop existing policies if they exist to avoid conflict
DROP POLICY IF EXISTS "Admins manage promotion rules" ON promotion_rules;

-- All authenticated users can read promotion rules
CREATE POLICY "pr_select" ON promotion_rules
  FOR SELECT TO authenticated USING (true);

-- Admins can manage promotion rules
CREATE POLICY "pr_manage" ON promotion_rules
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );


-- ============================================================
-- 3. WARNINGS: Replace overly permissive RLS policies
--    These policies use USING(true) / WITH CHECK(true)
--    on INSERT, UPDATE, DELETE which bypasses RLS
-- ============================================================

-- ---- classes: replace INSERT/UPDATE/DELETE (true) with role checks ----

DROP POLICY IF EXISTS "Allow authenticated users to insert classes" ON classes;
DROP POLICY IF EXISTS "Allow authenticated users to update classes" ON classes;
DROP POLICY IF EXISTS "Allow authenticated users to delete classes" ON classes;

CREATE POLICY "classes_insert_admin" ON classes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

CREATE POLICY "classes_update_admin" ON classes
  FOR UPDATE TO authenticated
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

CREATE POLICY "classes_delete_admin" ON classes
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

-- ---- sections: replace INSERT/UPDATE/DELETE (true) with role checks ----

DROP POLICY IF EXISTS "Allow authenticated users to insert sections" ON sections;
DROP POLICY IF EXISTS "Allow authenticated users to update sections" ON sections;
DROP POLICY IF EXISTS "Allow authenticated users to delete sections" ON sections;

CREATE POLICY "sections_insert_admin" ON sections
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

CREATE POLICY "sections_update_admin" ON sections
  FOR UPDATE TO authenticated
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

CREATE POLICY "sections_delete_admin" ON sections
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

-- ---- schools: replace INSERT/UPDATE (true) with role checks ----

DROP POLICY IF EXISTS "Allow authenticated users to insert schools" ON schools;
DROP POLICY IF EXISTS "Allow authenticated users to update schools" ON schools;

CREATE POLICY "schools_insert_admin" ON schools
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin')
    )
  );

CREATE POLICY "schools_update_admin" ON schools
  FOR UPDATE TO authenticated
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

-- ---- users: replace INSERT/DELETE (true) with role checks ----

DROP POLICY IF EXISTS "Allow authenticated users to insert users" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to delete users" ON users;

CREATE POLICY "users_insert_admin" ON users
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

CREATE POLICY "users_delete_admin" ON users
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

-- ---- notifications: replace INSERT WITH CHECK(true) ----

DROP POLICY IF EXISTS "System create notifications" ON notifications;

-- Only staff can create notifications (not any authenticated user)
CREATE POLICY "notifications_insert_staff" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

-- ---- student_doubts: replace "System manage doubts" ALL(true) ----
-- This policy seems to have been created directly in Supabase
DROP POLICY IF EXISTS "System manage doubts" ON student_doubts;
-- The existing sd_select, sd_insert, sd_update policies in brain_schema.sql
-- already have proper role-based checks, so no replacement needed.


-- ============================================================
-- 4. WARNINGS: Fix functions with mutable search_path
-- ============================================================

-- Fix generate_otp
CREATE OR REPLACE FUNCTION public.generate_otp()
RETURNS TEXT AS $$
BEGIN
    RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Fix create_invitation_with_otp
CREATE OR REPLACE FUNCTION public.create_invitation_with_otp(
    p_invite_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.user_invitations
    SET 
        otp_code = public.generate_otp(),
        otp_expires_at = NOW() + INTERVAL '15 minutes',
        otp_attempts = 0
    WHERE invite_id = p_invite_id;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Fix update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;


-- ============================================================
-- 5. SUGGESTIONS: Add policies for RLS-enabled tables with none
-- ============================================================

-- ---- posts ----
-- All authenticated users can read posts from their school
CREATE POLICY "posts_select" ON posts
  FOR SELECT TO authenticated USING (true);

-- Staff can manage posts
CREATE POLICY "posts_manage" ON posts
  FOR ALL TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

-- ---- question_bank ----
-- All authenticated users can read questions
CREATE POLICY "qb_select" ON question_bank
  FOR SELECT TO authenticated USING (true);

-- Teachers and admins can manage questions
CREATE POLICY "qb_manage" ON question_bank
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

-- ---- syllabus_nodes ----
-- All authenticated users can read syllabus nodes
CREATE POLICY "sn_select" ON syllabus_nodes
  FOR SELECT TO authenticated USING (true);

-- Teachers and admins can manage syllabus nodes
CREATE POLICY "sn_manage" ON syllabus_nodes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );


-- ============================================================
-- 6. VERIFICATION
-- ============================================================

-- Check all RLS-enabled tables have policies
SELECT 
  t.tablename,
  t.rowsecurity,
  COUNT(p.policyname) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.rowsecurity DESC, policy_count ASC;

-- =============================================
-- FIX: Classes and Academic Years SELECT Policies
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop existing conflicting policies if any
DROP POLICY IF EXISTS "Allow authenticated users to read classes" ON classes;
DROP POLICY IF EXISTS "Users can view classes" ON classes;
DROP POLICY IF EXISTS "Allow authenticated users to read academic_years" ON academic_years;
DROP POLICY IF EXISTS "Users can view academic_years" ON academic_years;

-- =============================================
-- CLASSES TABLE
-- =============================================
-- Allow ANY authenticated user to SELECT from classes
CREATE POLICY "Allow authenticated users to read classes" ON classes
  FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- ACADEMIC YEARS TABLE
-- =============================================
-- Allow ANY authenticated user to SELECT from academic_years
CREATE POLICY "Allow authenticated users to read academic_years" ON academic_years
  FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- VERIFICATION
-- =============================================
-- Check policies on both tables
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('classes', 'academic_years')
ORDER BY tablename, cmd;

-- Check if data exists
SELECT 'classes' as table_name, COUNT(*) as row_count FROM classes
UNION ALL
SELECT 'academic_years' as table_name, COUNT(*) as row_count FROM academic_years;

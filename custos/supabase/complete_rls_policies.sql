-- ============================================
-- COMPLETE RLS POLICIES FOR ALL TABLES
-- Run this to ensure all CRUD operations work
-- ============================================

-- Drop existing policies if they exist to avoid duplicates
DROP POLICY IF EXISTS "Allow authenticated users to read classes" ON classes;
DROP POLICY IF EXISTS "Allow authenticated users to insert classes" ON classes;
DROP POLICY IF EXISTS "Allow authenticated users to update classes" ON classes;
DROP POLICY IF EXISTS "Allow authenticated users to delete classes" ON classes;

DROP POLICY IF EXISTS "Allow authenticated users to read sections" ON sections;
DROP POLICY IF EXISTS "Allow authenticated users to insert sections" ON sections;
DROP POLICY IF EXISTS "Allow authenticated users to update sections" ON sections;
DROP POLICY IF EXISTS "Allow authenticated users to delete sections" ON sections;

DROP POLICY IF EXISTS "Allow authenticated users to read schools" ON schools;
DROP POLICY IF EXISTS "Allow authenticated users to insert schools" ON schools;
DROP POLICY IF EXISTS "Allow authenticated users to update schools" ON schools;

DROP POLICY IF EXISTS "Allow authenticated users to read users" ON users;
DROP POLICY IF EXISTS "Allow authenticated users to delete users" ON users;

DROP POLICY IF EXISTS "Allow authenticated users to read subjects" ON subjects;
DROP POLICY IF EXISTS "Allow authenticated users to insert subjects" ON subjects;
DROP POLICY IF EXISTS "Allow authenticated users to update subjects" ON subjects;
DROP POLICY IF EXISTS "Allow authenticated users to delete subjects" ON subjects;

-- ============================================
-- CLASSES TABLE - Full CRUD
-- ============================================

CREATE POLICY "Allow authenticated users to read classes" ON classes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert classes" ON classes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update classes" ON classes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete classes" ON classes
  FOR DELETE TO authenticated USING (true);

-- ============================================
-- SECTIONS TABLE - Full CRUD
-- ============================================

CREATE POLICY "Allow authenticated users to read sections" ON sections
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert sections" ON sections
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update sections" ON sections
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete sections" ON sections
  FOR DELETE TO authenticated USING (true);

-- ============================================
-- SCHOOLS TABLE - Read, Insert, Update
-- ============================================

CREATE POLICY "Allow authenticated users to read schools" ON schools
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert schools" ON schools
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update schools" ON schools
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- USERS TABLE - Read and Delete
-- ============================================

CREATE POLICY "Allow authenticated users to read users" ON users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete users" ON users
  FOR DELETE TO authenticated USING (true);

-- ============================================
-- SUBJECTS TABLE - Full CRUD (for future use)
-- ============================================

CREATE POLICY "Allow authenticated users to read subjects" ON subjects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert subjects" ON subjects
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update subjects" ON subjects
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete subjects" ON subjects
  FOR DELETE TO authenticated USING (true);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, cmd;

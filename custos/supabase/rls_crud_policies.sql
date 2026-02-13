-- Fix RLS Policies for CRUD Operations
-- This adds INSERT, UPDATE, DELETE policies for all tables

-- ============================================
-- CLASSES TABLE POLICIES
-- ============================================

-- Allow authenticated users to insert classes
CREATE POLICY "Allow authenticated users to insert classes" ON classes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update classes
CREATE POLICY "Allow authenticated users to update classes" ON classes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete classes
CREATE POLICY "Allow authenticated users to delete classes" ON classes
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- SECTIONS TABLE POLICIES
-- ============================================

-- Allow authenticated users to insert sections
CREATE POLICY "Allow authenticated users to insert sections" ON sections
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update sections
CREATE POLICY "Allow authenticated users to update sections" ON sections
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete sections
CREATE POLICY "Allow authenticated users to delete sections" ON sections
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- SCHOOLS TABLE POLICIES
-- ============================================

-- Allow authenticated users to insert schools
CREATE POLICY "Allow authenticated users to insert schools" ON schools
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update schools
CREATE POLICY "Allow authenticated users to update schools" ON schools
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Allow authenticated users to delete users
CREATE POLICY "Allow authenticated users to delete users" ON users
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- SUBJECTS TABLE POLICIES (for future use)
-- ============================================

-- Allow authenticated users to read subjects
CREATE POLICY "Allow authenticated users to read subjects" ON subjects
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert subjects
CREATE POLICY "Allow authenticated users to insert subjects" ON subjects
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update subjects
CREATE POLICY "Allow authenticated users to update subjects" ON subjects
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete subjects
CREATE POLICY "Allow authenticated users to delete subjects" ON subjects
  FOR DELETE
  TO authenticated
  USING (true);

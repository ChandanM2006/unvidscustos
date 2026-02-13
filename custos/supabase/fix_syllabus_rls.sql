-- ============================================
-- FIX: Add missing RLS policies for syllabus_documents
-- This version drops existing policies first to avoid conflicts
-- ============================================

-- Drop existing policies if they exist (ignore errors if they don't)
DROP POLICY IF EXISTS "Allow admins and teachers to create syllabus" ON syllabus_documents;
DROP POLICY IF EXISTS "Allow admins and teachers to update syllabus" ON syllabus_documents;
DROP POLICY IF EXISTS "Allow admins to delete syllabus" ON syllabus_documents;

-- Add INSERT policy
CREATE POLICY "Allow admins and teachers to create syllabus" ON syllabus_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

-- Add UPDATE policy  
CREATE POLICY "Allow admins and teachers to update syllabus" ON syllabus_documents
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

-- Add DELETE policy
CREATE POLICY "Allow admins to delete syllabus" ON syllabus_documents
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

-- DONE! Now try uploading syllabus again.

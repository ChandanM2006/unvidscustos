-- FIXED RLS POLICIES - No Recursion
-- This version uses auth.uid() directly without recursive queries

-- 1. Drop all existing policies
DROP POLICY IF EXISTS "Users can view their school users" ON users;
DROP POLICY IF EXISTS "Users can view own row" ON users;
DROP POLICY IF EXISTS "Users can view school mates" ON users;
DROP POLICY IF EXISTS "Users can view their school" ON schools;
DROP POLICY IF EXISTS "Users can view their school data" ON schools;

-- 2. IMPORTANT: First, we need to link auth.uid() to our users table
-- Update the user_id in the users table to match the Supabase Auth UID
-- Run this query to see the auth UIDs:
-- SELECT id, email FROM auth.users;

-- Then update your users table (replace the UUID with the actual auth UID):
-- UPDATE users 
-- SET user_id = (SELECT id FROM auth.users WHERE email = users.email)
-- WHERE email = 'admin@demo.school';

-- 3. Create simple, non-recursive policies
-- For users table: Allow users to see all users in the system (simplified for now)
CREATE POLICY "Allow authenticated users to read users" ON users
  FOR SELECT 
  TO authenticated
  USING (true);

-- For schools table: Allow authenticated users to read schools
CREATE POLICY "Allow authenticated users to read schools" ON schools
  FOR SELECT
  TO authenticated
  USING (true);

-- Note: These are permissive policies for development.
-- In production, you'd want stricter policies based on school_id matching.

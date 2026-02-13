-- Fix: Add INSERT policy for users table to allow bulk import

-- Drop existing INSERT policy if any
DROP POLICY IF EXISTS "Allow authenticated users to insert users" ON users;

-- Create INSERT policy for users table
CREATE POLICY "Allow authenticated users to insert users" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Verify policies
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY cmd, policyname;

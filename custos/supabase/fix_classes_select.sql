-- Add SELECT policy for classes table (may have been missed)
CREATE POLICY "Allow authenticated users to read classes" ON classes
  FOR SELECT
  TO authenticated
  USING (true);

-- Verify and fix any classes that may have NULL school_id
-- First, let's check what's in the classes table:
SELECT * FROM classes;

-- If any classes have NULL school_id, fix them:
UPDATE classes
SET school_id = (
  SELECT school_id FROM schools LIMIT 1
)
WHERE school_id IS NULL;

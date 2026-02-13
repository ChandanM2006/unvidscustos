-- Add SELECT policy for sections table
CREATE POLICY "Allow authenticated users to read sections" ON sections
  FOR SELECT
  TO authenticated
  USING (true);

-- Verify sections can be read
SELECT * FROM sections;

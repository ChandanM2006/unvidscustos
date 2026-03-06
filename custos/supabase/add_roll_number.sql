-- Add roll_number column to users table
-- Roll number is a student's unique identifier within a school
ALTER TABLE users ADD COLUMN IF NOT EXISTS roll_number TEXT;

-- Create a unique index so roll numbers are unique per school
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_roll_number_school
    ON users(school_id, roll_number)
    WHERE roll_number IS NOT NULL AND role = 'student';

-- Add a comment
COMMENT ON COLUMN users.roll_number IS 'Student unique roll number / admission number within the school';

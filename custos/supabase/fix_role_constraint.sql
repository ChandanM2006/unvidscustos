-- Fix users_role_check constraint to include 'parent' role
-- Run this in Supabase SQL Editor

-- First, drop the existing constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add the new constraint with all roles including 'parent'
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('super_admin', 'sub_admin', 'teacher', 'student', 'parent'));

-- Verify the constraint
SELECT 
    constraint_name,
    check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'users_role_check';

SELECT 'Constraint updated! You can now create parent users.' as status;

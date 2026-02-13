-- Fix: Add admin user to users table
-- Run this in Supabase SQL Editor

-- First, let's find the admin's auth UID
-- Look at Authentication tab to get the UID for admin@demo.school

-- Then insert the admin into users table
-- Replace 'YOUR_ADMIN_AUTH_UID' with the actual UID from Authentication tab

-- Option 1: If you know the admin's auth UID
-- Get it from Supabase Authentication > Users > admin@demo.school > UID column
-- INSERT INTO users (user_id, email, full_name, role, school_id)
-- VALUES (
--     'YOUR_ADMIN_AUTH_UID_HERE',
--     'admin@demo.school',
--     'Super Admin',
--     'super_admin',
--     (SELECT school_id FROM schools LIMIT 1)
-- );

-- Option 2: Auto-match by email (safer)
DO $$
DECLARE
    admin_uid UUID;
    school UUID;
BEGIN
    -- Get school ID
    SELECT school_id INTO school FROM schools LIMIT 1;
    
    -- Try to find admin UID from auth.users (requires service role)
    -- This query might fail if you don't have access to auth schema
    -- In that case, manually copy the UID from Supabase Dashboard
    
    -- Check if admin@demo.school already exists in users table
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@demo.school') THEN
        -- Get the UID from auth.users
        SELECT id INTO admin_uid FROM auth.users WHERE email = 'admin@demo.school' LIMIT 1;
        
        IF admin_uid IS NOT NULL THEN
            INSERT INTO users (user_id, email, full_name, role, school_id)
            VALUES (admin_uid, 'admin@demo.school', 'Super Admin', 'super_admin', school);
            
            RAISE NOTICE 'Admin user inserted successfully!';
        ELSE
            RAISE NOTICE 'Could not find admin in auth.users. Please insert manually.';
        END IF;
    ELSE
        RAISE NOTICE 'Admin user already exists in users table.';
    END IF;
END $$;

-- Verify
SELECT * FROM users WHERE email = 'admin@demo.school';

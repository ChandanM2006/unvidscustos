-- Add target_audience column to allow filtering announcements by role
ALTER TABLE posts ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'all';

-- Drop any existing views if they depend on posts table heavily (usually not necessary)

-- Backfill existing posts to be visible to all
UPDATE posts SET target_audience = 'all' WHERE target_audience IS NULL;

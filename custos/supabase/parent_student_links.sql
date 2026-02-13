-- Parent-Student Links Table for CUSTOS
-- This table links parents to their children (students)

-- Create the table if not exists
CREATE TABLE IF NOT EXISTS parent_student_links (
    link_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    relationship VARCHAR(50) DEFAULT 'parent', -- parent, guardian, etc.
    is_primary BOOLEAN DEFAULT true, -- primary contact
    created_at TIMESTAMP DEFAULT NOW(),
    school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
    UNIQUE(parent_id, student_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_parent_student_links_parent ON parent_student_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_links_student ON parent_student_links(student_id);

-- Enable RLS
ALTER TABLE parent_student_links ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Parent can view own links" ON parent_student_links;
DROP POLICY IF EXISTS "Admin can manage links" ON parent_student_links;

-- RLS Policies
CREATE POLICY "Parent can view own links"
ON parent_student_links FOR SELECT
TO authenticated
USING (parent_id = auth.uid());

CREATE POLICY "Admin can manage links"
ON parent_student_links FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.user_id = auth.uid() 
        AND users.role IN ('super_admin', 'sub_admin')
    )
);

-- Grant permissions
GRANT ALL ON parent_student_links TO authenticated;

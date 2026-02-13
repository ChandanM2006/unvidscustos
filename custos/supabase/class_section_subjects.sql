-- Add class-section-subject linking table
-- Run this AFTER phase3_schema.sql

CREATE TABLE IF NOT EXISTS class_section_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  subject_id UUID REFERENCES subjects(subject_id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(class_id) ON DELETE CASCADE,
  section_id UUID REFERENCES sections(section_id) ON DELETE CASCADE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(subject_id, class_id, section_id)
);

-- Index for fast lookups
CREATE INDEX idx_class_section_subjects_subject ON class_section_subjects(subject_id);
CREATE INDEX idx_class_section_subjects_class ON class_section_subjects(class_id);
CREATE INDEX idx_class_section_subjects_section ON class_section_subjects(section_id);

-- RLS policy
ALTER TABLE class_section_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to view class_section_subjects" ON class_section_subjects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admins to manage class_section_subjects" ON class_section_subjects
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

COMMENT ON TABLE class_section_subjects IS 'Links subjects to specific class-section combinations';

-- ============================================
-- LESSON RESOURCES SCHEMA
-- Per-lesson (chapter) study materials
-- Generated after brain loop completes
-- Teacher edits → publishes → students see
-- ============================================

CREATE TABLE IF NOT EXISTS lesson_resources (
  resource_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links to the syllabus document (lesson/chapter)
  document_id    UUID NOT NULL REFERENCES syllabus_documents(document_id) ON DELETE CASCADE,
  
  -- Class context (which class/section this was generated for)
  class_id       UUID REFERENCES classes(class_id) ON DELETE SET NULL,
  subject_id     UUID REFERENCES subjects(subject_id) ON DELETE SET NULL,
  
  -- The 5 core text resources (covering ALL topics in the lesson)
  lesson_notes    JSONB,        -- Detailed formatted notes for entire lesson
  study_guide     JSONB,        -- Summary & key points
  worksheet       JSONB,        -- Practice problems with answers
  revision_notes  JSONB,        -- Ultra-condensed cheat sheet
  formulas_list   JSONB,        -- All formulas & definitions
  
  -- Additional resources
  youtube_links   TEXT[],       -- Suggested videos
  teacher_uploads JSONB,        -- Custom materials added by teacher
  
  -- Publish workflow
  status          TEXT CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
  published_at    TIMESTAMP,
  
  -- Metadata
  ai_generated    BOOLEAN DEFAULT true,
  generated_by    UUID REFERENCES users(user_id) ON DELETE SET NULL,
  edited_by       UUID REFERENCES users(user_id) ON DELETE SET NULL,
  last_edited_at  TIMESTAMP,
  version         INTEGER DEFAULT 1,
  
  -- Access tracking
  view_count      INTEGER DEFAULT 0,
  
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  
  -- One resource set per lesson per class
  UNIQUE(document_id, class_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lr_document   ON lesson_resources(document_id);
CREATE INDEX IF NOT EXISTS idx_lr_class      ON lesson_resources(class_id);
CREATE INDEX IF NOT EXISTS idx_lr_status     ON lesson_resources(status);
CREATE INDEX IF NOT EXISTS idx_lr_subject    ON lesson_resources(subject_id);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_lr_updated_at
  BEFORE UPDATE ON lesson_resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE lesson_resources ENABLE ROW LEVEL SECURITY;

-- Teachers/admins can view all
CREATE POLICY "lr_teacher_select" ON lesson_resources FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

-- Teachers/admins can insert/update
CREATE POLICY "lr_teacher_insert" ON lesson_resources FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

CREATE POLICY "lr_teacher_update" ON lesson_resources FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

-- Students can only see PUBLISHED resources for their class
CREATE POLICY "lr_student_select" ON lesson_resources FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role = 'student'
      AND users.class_id = lesson_resources.class_id
    )
  );

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE lesson_resources IS 'AI-generated study resources per lesson/chapter. Generated after brain loop completes, edited by teacher, then published for students.';

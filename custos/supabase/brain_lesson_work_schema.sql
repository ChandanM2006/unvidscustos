-- ============================================
-- BRAIN LESSON-WISE WORK SCHEMA
-- Sub-Module 3: Lesson/Chapter Summative Test
--
-- Tables:
--   1. brain_lesson_work       (generated chapter test per class/subject)
--   2. brain_lesson_responses  (per-student answers + teacher marks)
--
-- Flow:
--   ALL daily + weekly data for a lesson/chapter
--     → teacher triggers lesson test generation
--     → AI performs deepest analysis of student data
--     → Comprehensive chapter test with all question types
--     → Same correction process as weekly (spreadsheet + OCR)
--     → Marks complete the data collection cycle for reports
-- ============================================

-- 1. BRAIN LESSON WORK
CREATE TABLE IF NOT EXISTS brain_lesson_work (
  work_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Class context
  class_id       UUID NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  section_id     UUID REFERENCES sections(section_id) ON DELETE SET NULL,
  subject_id     UUID NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,

  -- Chapter / Lesson reference
  document_id    UUID REFERENCES syllabus_documents(document_id) ON DELETE SET NULL,
  chapter_title  TEXT,
  chapter_number INTEGER,

  -- All topics in this lesson/chapter
  topics_included JSONB NOT NULL DEFAULT '[]',
  -- [{topic_id, topic_title, difficulty_level}]

  -- Full analysis: daily + weekly combined
  combined_analysis JSONB DEFAULT '{}',
  -- {weak_topics, strong_topics, daily_count, weekly_count,
  --  avg_daily_score, avg_weekly_score, coverage_percent}

  -- Pre-condition status
  daily_work_count   INTEGER DEFAULT 0,
  weekly_work_count  INTEGER DEFAULT 0,
  all_daily_complete BOOLEAN DEFAULT false,
  all_weekly_complete BOOLEAN DEFAULT false,

  -- Generated test paper (same structure as weekly)
  questions      JSONB NOT NULL DEFAULT '[]',
  question_count INTEGER DEFAULT 0,
  total_marks    INTEGER DEFAULT 0,

  -- Printable grading index
  grading_index  JSONB DEFAULT '[]',

  -- Status (same as weekly)
  status         TEXT CHECK (status IN (
    'generated', 'published', 'in_progress', 'corrected', 'completed'
  )) DEFAULT 'generated',

  generated_at   TIMESTAMP DEFAULT NOW(),
  published_at   TIMESTAMP,
  corrected_at   TIMESTAMP,

  created_by     UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW(),

  UNIQUE(class_id, section_id, subject_id, document_id)
);

-- 2. BRAIN LESSON RESPONSES
CREATE TABLE IF NOT EXISTS brain_lesson_responses (
  response_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id        UUID NOT NULL REFERENCES brain_lesson_work(work_id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  total_marks_obtained INTEGER DEFAULT 0,
  total_marks_possible INTEGER DEFAULT 0,
  percentage     NUMERIC(5,2) DEFAULT 0,

  question_marks JSONB DEFAULT '[]',

  grading_method TEXT CHECK (grading_method IN ('manual', 'ocr', 'hybrid')) DEFAULT 'manual',
  ocr_confidence NUMERIC(5,2),

  status         TEXT CHECK (status IN ('pending', 'graded', 'verified')) DEFAULT 'pending',
  graded_by      UUID REFERENCES users(user_id) ON DELETE SET NULL,
  graded_at      TIMESTAMP,
  verified_at    TIMESTAMP,

  teacher_notes  TEXT,

  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW(),

  UNIQUE(work_id, student_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_blw_class      ON brain_lesson_work(class_id);
CREATE INDEX IF NOT EXISTS idx_blw_subject    ON brain_lesson_work(subject_id);
CREATE INDEX IF NOT EXISTS idx_blw_document   ON brain_lesson_work(document_id);
CREATE INDEX IF NOT EXISTS idx_blw_status     ON brain_lesson_work(status);

CREATE INDEX IF NOT EXISTS idx_blr_work       ON brain_lesson_responses(work_id);
CREATE INDEX IF NOT EXISTS idx_blr_student    ON brain_lesson_responses(student_id);
CREATE INDEX IF NOT EXISTS idx_blr_status     ON brain_lesson_responses(status);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_blw_updated_at
  BEFORE UPDATE ON brain_lesson_work
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blr_updated_at
  BEFORE UPDATE ON brain_lesson_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE brain_lesson_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_lesson_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blw_teacher_select" ON brain_lesson_work FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE users.user_id = auth.uid() AND users.role IN ('super_admin','sub_admin'))
    OR EXISTS (SELECT 1 FROM timetable_entries WHERE timetable_entries.teacher_id = auth.uid() AND timetable_entries.class_id = brain_lesson_work.class_id)
  );

CREATE POLICY "blw_teacher_insert" ON brain_lesson_work FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.user_id = auth.uid() AND users.role IN ('super_admin','sub_admin','teacher'))
  );

CREATE POLICY "blw_teacher_update" ON brain_lesson_work FOR UPDATE
  TO authenticated USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE users.user_id = auth.uid() AND users.role IN ('super_admin','sub_admin'))
  );

CREATE POLICY "blw_teacher_delete" ON brain_lesson_work FOR DELETE
  TO authenticated USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE users.user_id = auth.uid() AND users.role IN ('super_admin','sub_admin'))
  );

CREATE POLICY "blw_student_select" ON brain_lesson_work FOR SELECT
  TO authenticated USING (
    status IN ('published','in_progress','corrected','completed')
    AND EXISTS (SELECT 1 FROM users WHERE users.user_id = auth.uid() AND users.role = 'student' AND users.class_id = brain_lesson_work.class_id)
  );

CREATE POLICY "blr_teacher_all" ON brain_lesson_responses FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE users.user_id = auth.uid() AND users.role IN ('super_admin','sub_admin','teacher'))
  );

CREATE POLICY "blr_student_own" ON brain_lesson_responses FOR SELECT
  TO authenticated USING (student_id = auth.uid());

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE brain_lesson_work IS 'Lesson/chapter summative test. Deepest AI analysis using all daily + weekly data. Completes the data collection cycle.';
COMMENT ON TABLE brain_lesson_responses IS 'Per-student lesson test marks. Same grading as weekly (manual spreadsheet or OCR).';

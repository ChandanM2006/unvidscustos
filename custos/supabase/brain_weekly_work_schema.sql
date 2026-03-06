-- ============================================
-- BRAIN WEEKLY WORK SCHEMA
-- Sub-Module 2: Weekly Test (Formal Written)
--
-- Tables:
--   1. brain_weekly_work       (generated weekly test per class/subject)
--   2. brain_weekly_responses  (per-student answers + teacher marks)
--
-- Flow:
--   daily_work data collected all week
--     → teacher triggers weekly test generation (or auto on Sunday)
--     → AI generates paper (60% weak topics, 40% strong) from CLASS-WIDE data
--     → Mix of short answer, long answer, critical thinking
--     → Teacher reviews/edits → prints paper → gives in class
--     → Correction: manual spreadsheet or print-upload-OCR
--     → Marks update student_topic_performance
-- ============================================

-- 1. BRAIN WEEKLY WORK
-- Each row = one week's test paper for a class/subject
CREATE TABLE IF NOT EXISTS brain_weekly_work (
  work_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Class context
  class_id       UUID NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  section_id     UUID REFERENCES sections(section_id) ON DELETE SET NULL,
  subject_id     UUID NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,

  -- Week range
  week_start     DATE NOT NULL,
  week_end       DATE NOT NULL,
  week_label     TEXT,  -- e.g. "Week 3 (Feb 10-14, 2026)"

  -- Topics covered this week (from daily work data)
  topics_covered JSONB NOT NULL DEFAULT '[]',
  -- [{topic_id, topic_title, daily_avg_score, is_weak}]

  -- CLASS-WIDE weakness analysis (aggregated from all students' daily data)
  class_analysis JSONB DEFAULT '{}',
  -- {weak_topics: [{topic_id, title, avg_score}], strong_topics: [...]}

  -- Generated test paper
  -- Each question: {question_id, topic_id, question_text, question_type,
  --   marks, difficulty, bloom_type, expected_answer, marking_rubric}
  -- question_type: 'short_answer' | 'long_answer' | 'critical_thinking' | 'diagram' | 'numerical'
  questions      JSONB NOT NULL DEFAULT '[]',
  question_count INTEGER DEFAULT 0,
  total_marks    INTEGER DEFAULT 0,

  -- The printable grading index template
  -- [{q_no, topic_title, difficulty, bloom_type, marks, correct_indicator}]
  grading_index  JSONB DEFAULT '[]',

  -- Status
  status         TEXT CHECK (status IN (
    'generated',     -- AI generated, teacher reviewing
    'published',     -- Teacher approved, ready to print/give
    'in_progress',   -- Test given, correction ongoing
    'corrected',     -- All corrections done
    'completed'      -- Final data pushed to student_topic_performance
  )) DEFAULT 'generated',

  generated_at   TIMESTAMP DEFAULT NOW(),
  published_at   TIMESTAMP,
  corrected_at   TIMESTAMP,

  -- Who generated it
  created_by     UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW(),

  -- One test per class/section/subject/week
  UNIQUE(class_id, section_id, subject_id, week_start)
);

-- 2. BRAIN WEEKLY RESPONSES
-- Per-student grading for each weekly test
CREATE TABLE IF NOT EXISTS brain_weekly_responses (
  response_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id        UUID NOT NULL REFERENCES brain_weekly_work(work_id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  -- Overall marks
  total_marks_obtained INTEGER DEFAULT 0,
  total_marks_possible INTEGER DEFAULT 0,
  percentage     NUMERIC(5,2) DEFAULT 0,

  -- Per-question marks (teacher fills this)
  -- [{question_id, q_no, marks_obtained, marks_possible,
  --   is_correct (true/false/partial), topic_id, difficulty, bloom_type, notes}]
  question_marks JSONB DEFAULT '[]',

  -- Grading method used
  grading_method TEXT CHECK (grading_method IN ('manual', 'ocr', 'hybrid')) DEFAULT 'manual',
  ocr_confidence NUMERIC(5,2),  -- If OCR was used, confidence %

  -- Status
  status         TEXT CHECK (status IN ('pending', 'graded', 'verified')) DEFAULT 'pending',
  graded_by      UUID REFERENCES users(user_id) ON DELETE SET NULL,
  graded_at      TIMESTAMP,
  verified_at    TIMESTAMP,

  -- Teacher notes
  teacher_notes  TEXT,

  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW(),

  UNIQUE(work_id, student_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_bww_class      ON brain_weekly_work(class_id);
CREATE INDEX IF NOT EXISTS idx_bww_subject    ON brain_weekly_work(subject_id);
CREATE INDEX IF NOT EXISTS idx_bww_week       ON brain_weekly_work(week_start);
CREATE INDEX IF NOT EXISTS idx_bww_status     ON brain_weekly_work(status);
CREATE INDEX IF NOT EXISTS idx_bww_class_week ON brain_weekly_work(class_id, week_start);

CREATE INDEX IF NOT EXISTS idx_bwr_work       ON brain_weekly_responses(work_id);
CREATE INDEX IF NOT EXISTS idx_bwr_student    ON brain_weekly_responses(student_id);
CREATE INDEX IF NOT EXISTS idx_bwr_status     ON brain_weekly_responses(status);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_bww_updated_at
  BEFORE UPDATE ON brain_weekly_work
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bwr_updated_at
  BEFORE UPDATE ON brain_weekly_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE brain_weekly_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_weekly_responses ENABLE ROW LEVEL SECURITY;

-- Teachers can view/manage weekly work for their classes
CREATE POLICY "bww_teacher_select" ON brain_weekly_work FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
    OR EXISTS (
      SELECT 1 FROM timetable_entries
      WHERE timetable_entries.teacher_id = auth.uid()
      AND timetable_entries.class_id = brain_weekly_work.class_id
    )
  );

CREATE POLICY "bww_teacher_insert" ON brain_weekly_work FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

CREATE POLICY "bww_teacher_update" ON brain_weekly_work FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

CREATE POLICY "bww_teacher_delete" ON brain_weekly_work FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

-- Students can view published weekly work for their class
CREATE POLICY "bww_student_select" ON brain_weekly_work FOR SELECT
  TO authenticated
  USING (
    status IN ('published', 'in_progress', 'corrected', 'completed')
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role = 'student'
      AND users.class_id = brain_weekly_work.class_id
    )
  );

-- Teachers can view/manage all responses
CREATE POLICY "bwr_teacher_all" ON brain_weekly_responses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

-- Students can view their own responses
CREATE POLICY "bwr_student_own" ON brain_weekly_responses FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE brain_weekly_work IS 'Weekly test papers generated from class-wide daily work data. 60/40 weak/strong topic split. Written exam format.';
COMMENT ON TABLE brain_weekly_responses IS 'Per-student weekly test marks. Graded manually by teacher (spreadsheet or OCR from printed index).';
COMMENT ON COLUMN brain_weekly_work.questions IS 'JSONB array of test questions. Each: {question_id, topic_id, question_text, question_type, marks, difficulty, bloom_type, expected_answer, marking_rubric}';
COMMENT ON COLUMN brain_weekly_work.grading_index IS 'Printable grading index template. Each: {q_no, topic_title, difficulty, bloom_type, marks, correct_indicator}';
COMMENT ON COLUMN brain_weekly_responses.question_marks IS 'Per-question marks. Each: {question_id, q_no, marks_obtained, marks_possible, is_correct, topic_id, difficulty, bloom_type, notes}';

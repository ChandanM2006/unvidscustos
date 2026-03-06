-- ============================================
-- BRAIN DAILY WORK SCHEMA
-- Sub-Module 1: Daily Work Generation
--
-- Tables:
--   1. brain_daily_work        (generated daily homework per class/section/subject)
--   2. brain_daily_responses   (per-student MCQ answers + homework status)
--
-- Flow:
--   lesson_plan → daily_lesson_details (topic scheduled for today)
--     → teacher marks topic as covered
--     → brain_daily_work generated (10 MCQs + 3 homework Qs)
--     → students complete MCQs online
--     → data feeds into student_topic_performance
-- ============================================

-- 1. BRAIN DAILY WORK
-- Each row = one day's generated work for a class/section/subject
CREATE TABLE IF NOT EXISTS brain_daily_work (
  work_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links to lesson plan
  plan_id        UUID REFERENCES lesson_plans(plan_id) ON DELETE SET NULL,
  detail_id      UUID REFERENCES daily_lesson_details(detail_id) ON DELETE SET NULL,
  
  -- Class context
  class_id       UUID NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  section_id     UUID REFERENCES sections(section_id) ON DELETE SET NULL,
  subject_id     UUID NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  topic_id       UUID REFERENCES lesson_topics(topic_id) ON DELETE SET NULL,
  
  -- Date
  work_date      DATE NOT NULL,
  
  -- PART 1: MCQs (Online, auto-graded, max 10)
  -- Each question has: question_id, topic_id, question_text, options[], 
  -- correct_answer, difficulty, type, explanation
  mcq_questions  JSONB NOT NULL DEFAULT '[]',
  mcq_count      INTEGER DEFAULT 0,
  
  -- PART 2: Homework (Offline, view online, write in notebook, max 3-5)
  -- Each question has: question_id, topic_id, question_text,
  -- difficulty, type, expected_answer_guide
  homework_questions JSONB NOT NULL DEFAULT '[]',
  homework_count     INTEGER DEFAULT 0,
  
  -- Status
  status         TEXT CHECK (status IN ('generated', 'published', 'completed')) DEFAULT 'generated',
  generated_at   TIMESTAMP DEFAULT NOW(),
  published_at   TIMESTAMP,
  
  -- Who generated it
  created_by     UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW(),
  
  -- One work per class/section/subject/date
  UNIQUE(class_id, section_id, subject_id, work_date)
);

-- 2. BRAIN DAILY RESPONSES
-- Per-student tracking for each daily work
CREATE TABLE IF NOT EXISTS brain_daily_responses (
  response_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id        UUID NOT NULL REFERENCES brain_daily_work(work_id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- MCQ Part (auto-graded)
  -- Array of: {question_id, student_answer, is_correct, time_taken_seconds}
  mcq_answers    JSONB DEFAULT '[]',
  mcq_score      INTEGER DEFAULT 0,   -- correct count
  mcq_total      INTEGER DEFAULT 0,   -- total questions
  mcq_completed  BOOLEAN DEFAULT false,
  mcq_started_at  TIMESTAMP,
  mcq_completed_at TIMESTAMP,
  mcq_time_seconds INTEGER DEFAULT 0,
  
  -- Homework Part
  homework_viewed  BOOLEAN DEFAULT false,
  homework_viewed_at TIMESTAMP,
  
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(work_id, student_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_bdw_class     ON brain_daily_work(class_id);
CREATE INDEX IF NOT EXISTS idx_bdw_date      ON brain_daily_work(work_date);
CREATE INDEX IF NOT EXISTS idx_bdw_topic     ON brain_daily_work(topic_id);
CREATE INDEX IF NOT EXISTS idx_bdw_plan      ON brain_daily_work(plan_id);
CREATE INDEX IF NOT EXISTS idx_bdw_status    ON brain_daily_work(status);
CREATE INDEX IF NOT EXISTS idx_bdw_class_date ON brain_daily_work(class_id, work_date);

CREATE INDEX IF NOT EXISTS idx_bdr_work      ON brain_daily_responses(work_id);
CREATE INDEX IF NOT EXISTS idx_bdr_student   ON brain_daily_responses(student_id);
CREATE INDEX IF NOT EXISTS idx_bdr_completed ON brain_daily_responses(mcq_completed);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_bdw_updated_at
  BEFORE UPDATE ON brain_daily_work
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bdr_updated_at
  BEFORE UPDATE ON brain_daily_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE brain_daily_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_daily_responses ENABLE ROW LEVEL SECURITY;

-- Teachers can view/manage daily work for their classes
CREATE POLICY "bdw_teacher_select" ON brain_daily_work FOR SELECT
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
      AND timetable_entries.class_id = brain_daily_work.class_id
    )
  );

CREATE POLICY "bdw_teacher_insert" ON brain_daily_work FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

CREATE POLICY "bdw_teacher_update" ON brain_daily_work FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

-- Students can view published daily work for their class
CREATE POLICY "bdw_student_select" ON brain_daily_work FOR SELECT
  TO authenticated
  USING (
    status IN ('published', 'completed')
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role = 'student'
      AND users.class_id = brain_daily_work.class_id
    )
  );

-- Students can see/manage their own responses
CREATE POLICY "bdr_student_own" ON brain_daily_responses FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

CREATE POLICY "bdr_student_insert" ON brain_daily_responses FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "bdr_student_update" ON brain_daily_responses FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid());

-- Teachers can view all responses for their classes
CREATE POLICY "bdr_teacher_select" ON brain_daily_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE brain_daily_work IS 'Daily homework generated from lesson plan topics. Two parts: MCQs (online) + Homework (offline/notebook)';
COMMENT ON TABLE brain_daily_responses IS 'Individual student responses to daily work. MCQ answers are auto-graded, homework is view-only.';
COMMENT ON COLUMN brain_daily_work.mcq_questions IS 'JSONB array of MCQ questions. Each: {question_id, topic_id, question_text, options, correct_answer, difficulty, type, explanation}';
COMMENT ON COLUMN brain_daily_work.homework_questions IS 'JSONB array of theory questions. Each: {question_id, topic_id, question_text, difficulty, type, expected_answer_guide}';

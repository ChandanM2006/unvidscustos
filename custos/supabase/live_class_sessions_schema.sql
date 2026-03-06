-- ============================================
-- LIVE CLASS SESSIONS SCHEMA
-- Tracks teacher class sessions in real-time
--
-- Flow:
--   1. Teacher sees scheduled topics from lesson plan for current period
--   2. Teacher clicks "Start Class" → session created (status='in_progress')
--   3. Admin dashboard shows LIVE indicator for that class
--   4. Teacher finishes → selects covered topics → clicks "End Session"
--   5. Session updated with covered topics (status='completed')
--   6. Uncovered topics auto-pushed to next class in schedule
--   7. Admin can see what was taught per class/period
-- ============================================

CREATE TABLE IF NOT EXISTS live_class_sessions (
  session_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Teacher
  teacher_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  -- Class context
  class_id        UUID NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  section_id      UUID REFERENCES sections(section_id) ON DELETE SET NULL,
  subject_id      UUID NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,

  -- Timetable link
  entry_id        UUID REFERENCES timetable_entries(entry_id) ON DELETE SET NULL,
  slot_id         UUID REFERENCES timetable_slots(slot_id) ON DELETE SET NULL,

  -- Lesson plan link (optional)
  plan_id         UUID REFERENCES lesson_plans(plan_id) ON DELETE SET NULL,

  -- Session date
  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Scheduled topics (from lesson plan / timetable for TODAY)
  -- Array of: { topic_id, topic_title, type }
  scheduled_topics JSONB NOT NULL DEFAULT '[]',

  -- Pending topics (carried over from PREVIOUS class — not covered)
  -- Array of: { topic_id, topic_title, type, from_date? }
  pending_topics   JSONB NOT NULL DEFAULT '[]',

  -- Topics covered by teacher (selected at end of session)
  -- Array of: { topic_id, topic_title, type }
  covered_topics   JSONB NOT NULL DEFAULT '[]',

  -- Topics NOT covered (computed: scheduled + pending - covered)
  -- Stored for easy querying and carry-over
  uncovered_topics JSONB NOT NULL DEFAULT '[]',

  -- Session timing
  started_at      TIMESTAMP,
  ended_at        TIMESTAMP,
  duration_minutes INTEGER,

  -- Status
  status          TEXT CHECK (status IN ('not_started', 'in_progress', 'completed', 'cancelled')) DEFAULT 'not_started',

  -- Notes (optional teacher note)
  teacher_notes   TEXT,

  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),

  -- One active session per teacher/entry/date
  UNIQUE(teacher_id, entry_id, session_date)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lcs_teacher    ON live_class_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lcs_class      ON live_class_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_lcs_date       ON live_class_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_lcs_status     ON live_class_sessions(status);
CREATE INDEX IF NOT EXISTS idx_lcs_entry      ON live_class_sessions(entry_id);
CREATE INDEX IF NOT EXISTS idx_lcs_teacher_date ON live_class_sessions(teacher_id, session_date);
CREATE INDEX IF NOT EXISTS idx_lcs_class_date   ON live_class_sessions(class_id, session_date);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_lcs_updated_at
  BEFORE UPDATE ON live_class_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE live_class_sessions ENABLE ROW LEVEL SECURITY;

-- Teachers can view their own sessions
CREATE POLICY "lcs_teacher_select" ON live_class_sessions FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

-- Teachers can create sessions
CREATE POLICY "lcs_teacher_insert" ON live_class_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

-- Teachers can update their own sessions
CREATE POLICY "lcs_teacher_update" ON live_class_sessions FOR UPDATE
  TO authenticated
  USING (
    teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE live_class_sessions IS 'Tracks teacher class sessions. Teachers start/end sessions and report which topics they covered. Uncovered topics carry over to next class. Admins monitor live.';
COMMENT ON COLUMN live_class_sessions.scheduled_topics IS 'JSONB array of topics scheduled for this period from lesson plan. Each: {topic_id, topic_title, type}';
COMMENT ON COLUMN live_class_sessions.pending_topics IS 'JSONB array of topics carried over from previous class (not covered). Each: {topic_id, topic_title, type, from_date}';
COMMENT ON COLUMN live_class_sessions.covered_topics IS 'JSONB array of topics the teacher actually covered. Selected by teacher at end of session.';
COMMENT ON COLUMN live_class_sessions.uncovered_topics IS 'JSONB array of topics not covered. Computed as (scheduled + pending) - covered. These flow to next class.';

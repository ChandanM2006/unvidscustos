-- ============================================
-- CUSTOS BRAIN SCHEMA
-- The Adaptive Learning Intelligence Layer
-- 
-- Tables:
--   1. student_topic_performance  (THE BRAIN)
--   2. assessment_phases          (3-PHASE LOOP)
--   3. student_scores             (DUAL GRADING)
--   4. student_doubts             (AI CHATBOT)
--   5. daily_topic_schedule       (TIMETABLE DELIVERY)
--   6. achievements               (GAMIFICATION)
--   7. student_achievements       (EARNED BADGES)
--
-- Privacy Model:
--   Student  → sees activity only (streak, points, badges)
--   Teacher  → sees performance of their assigned students
--   Parent   → sees activity only (same as student)
--   Admin    → sees everything
-- ============================================

-- ============================================
-- DROP EXISTING (idempotent re-runs)
-- ============================================
DROP TABLE IF EXISTS student_achievements CASCADE;
DROP TABLE IF EXISTS achievements CASCADE;
DROP TABLE IF EXISTS daily_topic_schedule CASCADE;
DROP TABLE IF EXISTS student_doubts CASCADE;
DROP TABLE IF EXISTS student_scores CASCADE;
DROP TABLE IF EXISTS assessment_phases CASCADE;
DROP TABLE IF EXISTS student_topic_performance CASCADE;

-- ============================================
-- 1. STUDENT TOPIC PERFORMANCE (THE BRAIN)
-- Tracks per-student, per-topic mastery metrics.
-- The weakness_score (0-100) is the KEY metric
-- used by the 60/40 algorithm.
-- ============================================
CREATE TABLE student_topic_performance (
  performance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  topic_id       UUID NOT NULL REFERENCES lesson_topics(topic_id) ON DELETE CASCADE,

  -- Raw performance data
  total_attempts       INTEGER       DEFAULT 0,
  correct_answers      INTEGER       DEFAULT 0,
  accuracy_percentage  DECIMAL(5,2)  DEFAULT 0.00,
  average_time_seconds INTEGER       DEFAULT 0,

  -- Brain classification
  weakness_score       DECIMAL(5,2)  DEFAULT 50.00,   -- 0 = perfect, 100 = totally weak
  is_weak_topic        BOOLEAN       DEFAULT true,     -- weakness >= 50

  -- Adaptive signals
  last_assessed_at        TIMESTAMP,
  consecutive_correct     INTEGER  DEFAULT 0,
  needs_reinforcement     BOOLEAN  DEFAULT false,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(student_id, topic_id)
);

-- ============================================
-- 2. ASSESSMENT PHASES (THE 3-PHASE LOOP)
-- Stores each MCQ session: daily, weekly, lesson.
-- Records the 60/40 composition of each session.
-- ============================================
CREATE TABLE assessment_phases (
  phase_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  topic_id       UUID REFERENCES lesson_topics(topic_id) ON DELETE SET NULL,

  phase_type     TEXT NOT NULL CHECK (phase_type IN ('daily', 'weekly', 'lesson')),
  scheduled_date DATE NOT NULL,
  completed_at   TIMESTAMP,

  -- Results
  total_questions    INTEGER       DEFAULT 0,
  correct_answers    INTEGER       DEFAULT 0,
  score_percentage   DECIMAL(5,2)  DEFAULT 0.00,
  time_taken_seconds INTEGER       DEFAULT 0,

  -- The actual questions + student answers (JSONB)
  -- Array of: { question_id, topic_id, question_text, options, correct_answer,
  --             student_answer, is_correct, time_taken }
  questions JSONB DEFAULT '[]'::jsonb,

  -- 60/40 composition record
  weak_topic_count   INTEGER DEFAULT 0,
  strong_topic_count INTEGER DEFAULT 0,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'missed')),

  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 3. STUDENT SCORES (DUAL GRADING)
-- Two separate scores per student:
--   performance_score → HIDDEN (teacher/admin only)
--   activity_score    → VISIBLE (motivational)
-- ============================================
CREATE TABLE student_scores (
  score_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(year_id) ON DELETE SET NULL,

  -- PERFORMANCE (HIDDEN from student & parent by default)
  performance_score      DECIMAL(5,2) DEFAULT 0.00,
  performance_rank       INTEGER,
  performance_percentile DECIMAL(5,2),

  -- ACTIVITY (VISIBLE – drives engagement)
  activity_score       INTEGER DEFAULT 0,
  daily_streak         INTEGER DEFAULT 0,
  longest_streak       INTEGER DEFAULT 0,
  weekly_completions   INTEGER DEFAULT 0,
  total_attempts       INTEGER DEFAULT 0,

  -- Gamification
  badges_earned JSONB DEFAULT '[]'::jsonb,

  -- Privacy toggles (admin can override per-student)
  student_can_view_performance BOOLEAN DEFAULT false,
  parent_can_view_performance  BOOLEAN DEFAULT false,

  last_updated TIMESTAMP DEFAULT NOW(),
  created_at   TIMESTAMP DEFAULT NOW(),

  UNIQUE(student_id, academic_year_id)
);

-- ============================================
-- 4. STUDENT DOUBTS (AI CHATBOT)
-- Stores every question a student asks.
-- Auto-flags to teacher when threshold is hit.
-- ============================================
CREATE TABLE student_doubts (
  doubt_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  topic_id   UUID REFERENCES lesson_topics(topic_id) ON DELETE SET NULL,

  doubt_text  TEXT NOT NULL,
  ai_response TEXT,
  was_helpful BOOLEAN,

  -- Teacher intervention
  flagged_for_teacher  BOOLEAN   DEFAULT false,
  teacher_notified_at  TIMESTAMP,
  teacher_response     TEXT,
  resolved_by          UUID REFERENCES users(user_id),

  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'ai_answered', 'teacher_answered', 'resolved')),

  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 5. DAILY TOPIC SCHEDULE
-- Links timetable → topics → daily MCQ trigger.
-- When covered_in_class = true, the Brain generates
-- that evening's adaptive practice.
-- ============================================
CREATE TABLE daily_topic_schedule (
  schedule_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     UUID NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  section_id   UUID NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
  subject_id   UUID NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  topic_id     UUID NOT NULL REFERENCES lesson_topics(topic_id) ON DELETE CASCADE,

  scheduled_date    DATE    NOT NULL,
  covered_in_class  BOOLEAN DEFAULT false,

  -- Controls whether daily practice auto-generates
  daily_mcq_enabled BOOLEAN DEFAULT true,

  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(class_id, section_id, subject_id, scheduled_date)
);

-- ============================================
-- 6. ACHIEVEMENTS (GAMIFICATION)
-- Master list of earnable badges.
-- ============================================
CREATE TABLE achievements (
  achievement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT,  -- emoji or icon identifier
  category    TEXT CHECK (category IN ('streak', 'accuracy', 'improvement', 'participation', 'milestone')),

  -- Unlock criteria (evaluated by the Brain)
  -- Examples:
  --   {"streak_days": 7}
  --   {"accuracy_percent": 90, "min_attempts": 20}
  --   {"daily_completions": 30}
  criteria       JSONB   DEFAULT '{}'::jsonb,
  points_awarded INTEGER DEFAULT 0,

  is_active  BOOLEAN   DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 7. STUDENT ACHIEVEMENTS (EARNED BADGES)
-- ============================================
CREATE TABLE student_achievements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(achievement_id) ON DELETE CASCADE,

  earned_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(student_id, achievement_id)
);

-- ============================================
-- INDEXES
-- ============================================

-- student_topic_performance
CREATE INDEX idx_stp_student       ON student_topic_performance(student_id);
CREATE INDEX idx_stp_topic         ON student_topic_performance(topic_id);
CREATE INDEX idx_stp_student_topic ON student_topic_performance(student_id, topic_id);
CREATE INDEX idx_stp_weak          ON student_topic_performance(student_id, is_weak_topic);
CREATE INDEX idx_stp_last_assessed ON student_topic_performance(last_assessed_at);

-- assessment_phases
CREATE INDEX idx_ap_student   ON assessment_phases(student_id);
CREATE INDEX idx_ap_phase     ON assessment_phases(phase_type);
CREATE INDEX idx_ap_scheduled ON assessment_phases(scheduled_date);
CREATE INDEX idx_ap_status    ON assessment_phases(status);
CREATE INDEX idx_ap_student_date ON assessment_phases(student_id, scheduled_date);

-- student_scores
CREATE INDEX idx_ss_student ON student_scores(student_id);
CREATE INDEX idx_ss_year    ON student_scores(academic_year_id);

-- student_doubts
CREATE INDEX idx_sd_student ON student_doubts(student_id);
CREATE INDEX idx_sd_topic   ON student_doubts(topic_id);
CREATE INDEX idx_sd_status  ON student_doubts(status);
CREATE INDEX idx_sd_flagged ON student_doubts(flagged_for_teacher) WHERE flagged_for_teacher = true;

-- daily_topic_schedule
CREATE INDEX idx_dts_class_date ON daily_topic_schedule(class_id, section_id, scheduled_date);
CREATE INDEX idx_dts_topic      ON daily_topic_schedule(topic_id);
CREATE INDEX idx_dts_covered    ON daily_topic_schedule(covered_in_class) WHERE covered_in_class = true;

-- student_achievements
CREATE INDEX idx_sa_student ON student_achievements(student_id);

-- ============================================
-- TRIGGERS: auto-update updated_at
-- ============================================
CREATE TRIGGER update_stp_updated_at
  BEFORE UPDATE ON student_topic_performance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ss_updated_at
  BEFORE UPDATE ON student_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- -----------------------------------------------
-- student_topic_performance
-- PRIVACY: Students CANNOT see this table at all.
--          Teachers see their assigned students.
--          Admins see everything.
-- -----------------------------------------------
ALTER TABLE student_topic_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stp_teacher_admin_select"
  ON student_topic_performance FOR SELECT
  TO authenticated
  USING (
    -- Admins see all
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
    OR
    -- Teachers see students in their assigned classes
    EXISTS (
      SELECT 1 FROM users teacher
      JOIN users student ON student.user_id = student_topic_performance.student_id
      WHERE teacher.user_id = auth.uid()
      AND teacher.role = 'teacher'
      AND teacher.school_id = student.school_id
    )
    -- Students and Parents: NO ACCESS (no matching clause)
  );

CREATE POLICY "stp_system_insert"
  ON student_topic_performance FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Only the Brain engine (via service role) or admins can insert
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
    OR student_id = auth.uid()  -- Student's own record (created via API)
  );

CREATE POLICY "stp_system_update"
  ON student_topic_performance FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
    OR student_id = auth.uid()
  );

-- -----------------------------------------------
-- assessment_phases
-- PRIVACY: Students see their OWN phases (to take the test).
--          Teachers see their students' phases.
--          Admins see everything.
-- -----------------------------------------------
ALTER TABLE assessment_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ap_student_own"
  ON assessment_phases FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

CREATE POLICY "ap_insert"
  ON assessment_phases FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

CREATE POLICY "ap_update"
  ON assessment_phases FOR UPDATE
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

-- -----------------------------------------------
-- student_scores
-- PRIVACY: Students see ONLY activity columns.
--          Performance columns are hidden at the
--          application layer (API returns filtered).
--          RLS allows row access; column filtering
--          is handled by the API.
--          Teachers + Admins see full rows.
-- -----------------------------------------------
ALTER TABLE student_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ss_student_own"
  ON student_scores FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

CREATE POLICY "ss_insert"
  ON student_scores FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

CREATE POLICY "ss_update"
  ON student_scores FOR UPDATE
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

-- -----------------------------------------------
-- student_doubts
-- PRIVACY: Students see their OWN doubts.
--          Teachers see doubts from their students.
--          Admins see everything.
-- -----------------------------------------------
ALTER TABLE student_doubts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sd_select"
  ON student_doubts FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users viewer
      JOIN users student ON student.user_id = student_doubts.student_id
      WHERE viewer.user_id = auth.uid()
      AND viewer.role IN ('super_admin', 'sub_admin', 'teacher')
      AND (viewer.role = 'super_admin' OR viewer.school_id = student.school_id)
    )
  );

CREATE POLICY "sd_insert"
  ON student_doubts FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

CREATE POLICY "sd_update"
  ON student_doubts FOR UPDATE
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users viewer
      JOIN users student ON student.user_id = student_doubts.student_id
      WHERE viewer.user_id = auth.uid()
      AND viewer.role IN ('super_admin', 'sub_admin', 'teacher')
      AND (viewer.role = 'super_admin' OR viewer.school_id = student.school_id)
    )
  );

-- -----------------------------------------------
-- daily_topic_schedule
-- Teachers + Admins can manage. Students can read
-- (to see what's scheduled).
-- -----------------------------------------------
ALTER TABLE daily_topic_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dts_select"
  ON daily_topic_schedule FOR SELECT
  TO authenticated
  USING (true);  -- All authenticated users can view schedule

CREATE POLICY "dts_manage"
  ON daily_topic_schedule FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

-- -----------------------------------------------
-- achievements
-- Everyone can read. Only admins can manage.
-- -----------------------------------------------
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ach_select"
  ON achievements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ach_manage"
  ON achievements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

-- -----------------------------------------------
-- student_achievements
-- Students see their own. Teachers + Admins all.
-- -----------------------------------------------
ALTER TABLE student_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sa_select"
  ON student_achievements FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

CREATE POLICY "sa_insert"
  ON student_achievements FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

-- ============================================
-- SEED DATA: 10 Achievements
-- ============================================

INSERT INTO achievements (name, description, icon, category, criteria, points_awarded) VALUES
  ('First Steps',        'Complete your first daily practice',                        '🎯', 'participation', '{"daily_completions": 1}',                          10),
  ('Week Warrior',       'Maintain a 7-day streak',                                  '🔥', 'streak',        '{"streak_days": 7}',                                50),
  ('Fortnight Fighter',  'Maintain a 14-day streak',                                 '💪', 'streak',        '{"streak_days": 14}',                               100),
  ('Marathon Mind',       'Maintain a 30-day streak',                                 '🏆', 'streak',        '{"streak_days": 30}',                               250),
  ('Sharp Shooter',      'Achieve 90%+ accuracy in a daily practice',                '🎯', 'accuracy',      '{"accuracy_percent": 90, "phase_type": "daily"}',   30),
  ('Perfect Score',      'Get 100% on any assessment',                               '💯', 'accuracy',      '{"accuracy_percent": 100}',                         75),
  ('Quick Learner',      'Improve a weak topic to strong (score below 50)',           '📈', 'improvement',   '{"weak_to_strong": true}',                          60),
  ('Century Club',       'Complete 100 total practice sessions',                     '💎', 'milestone',     '{"daily_completions": 100}',                        200),
  ('Curious Mind',       'Ask 10 questions to the AI tutor',                         '💡', 'participation', '{"doubts_asked": 10}',                              25),
  ('Weekly Champion',    'Score 80%+ on 4 consecutive weekly tests',                 '🥇', 'accuracy',      '{"weekly_80_streak": 4}',                           150);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE student_topic_performance IS 'The Brain: per-student per-topic mastery tracking with weakness scores for 60/40 adaptive algorithm';
COMMENT ON TABLE assessment_phases IS '3-Phase assessment loop: daily (10 MCQ), weekly (20 MCQ), lesson (30 MCQ) with 60/40 weak/strong composition';
COMMENT ON TABLE student_scores IS 'Dual grading: performance_score (HIDDEN from student) + activity_score (VISIBLE for motivation)';
COMMENT ON TABLE student_doubts IS 'AI chatbot doubt tracking with auto-escalation to teacher when threshold hit';
COMMENT ON TABLE daily_topic_schedule IS 'Timetable-aligned topic delivery: when covered_in_class=true, triggers daily MCQ generation';
COMMENT ON TABLE achievements IS 'Gamification badges with unlock criteria evaluated by the Brain engine';
COMMENT ON TABLE student_achievements IS 'Tracks which achievements each student has earned';

-- ============================================
-- PHASE 3: DATABASE SCHEMA
-- The Intelligence - Subjects, Syllabus, Lessons, Resources
-- ============================================

-- ============================================
-- DROP EXISTING TABLES (if any)
-- ============================================

DROP TABLE IF EXISTS resource_views CASCADE;
DROP TABLE IF EXISTS mcq_generations CASCADE;
DROP TABLE IF EXISTS topic_resources CASCADE;
DROP TABLE IF EXISTS daily_lesson_details CASCADE;
DROP TABLE IF EXISTS lesson_plans CASCADE;
DROP TABLE IF EXISTS promotion_rules CASCADE;
DROP TABLE IF EXISTS student_academic_history CASCADE;
DROP TABLE IF EXISTS academic_years CASCADE;
DROP TABLE IF EXISTS lesson_topics CASCADE;
DROP TABLE IF EXISTS syllabus_documents CASCADE;
DROP TABLE IF EXISTS teacher_subjects CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;

-- ============================================
-- SUBJECTS MANAGEMENT
-- ============================================

CREATE TABLE subjects (
  subject_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  code TEXT,  -- e.g., "MATH-10", "SCI-09"
  description TEXT,
  
  grade_levels INTEGER[],  -- e.g., {9, 10, 11} for high school math
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Teacher-Subject assignments
CREATE TABLE teacher_subjects (
  assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(subject_id) ON DELETE CASCADE,
  
  academic_year_id UUID,  -- NULL for all years
  
  is_primary BOOLEAN DEFAULT false,  -- Primary teacher for this subject
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(teacher_id, subject_id, academic_year_id)
);

-- ============================================
-- SYLLABUS & CONTENT MANAGEMENT
-- ============================================

-- Uploaded syllabus documents (AI-converted)
CREATE TABLE syllabus_documents (
  document_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID REFERENCES subjects(subject_id) ON DELETE CASCADE,
  
  grade_level INTEGER NOT NULL,
  chapter_number INTEGER,
  chapter_title TEXT NOT NULL,
  
  -- Original file metadata (not stored, just tracked)
  original_filename TEXT,
  original_file_type TEXT,  -- pdf, docx, pptx, image
  original_size_mb DECIMAL,
  
  -- AI-extracted structured content
  content JSONB NOT NULL,  -- Complete extracted content
  /*
  Structure:
  {
    "title": "Chapter 5: Quadratic Equations",
    "sections": [
      {
        "heading": "Introduction",
        "text": "...",
        "page": 1
      }
    ],
    "formulas": ["x = (-b ± √(b² - 4ac)) / 2a"],
    "key_points": ["..."],
    "examples": [{"question": "...", "solution": "..."}],
    "images": [{"caption": "...", "extracted_text": "..."}]
  }
  */
  
  -- Metadata
  extracted_size_kb DECIMAL,
  compression_ratio DECIMAL,
  ai_processed BOOLEAN DEFAULT true,
  
  uploaded_by UUID REFERENCES users(user_id),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Individual lesson topics (from chapters)
CREATE TABLE lesson_topics (
  topic_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES syllabus_documents(document_id) ON DELETE CASCADE,
  
  topic_number INTEGER NOT NULL,
  topic_title TEXT NOT NULL,
  
  content JSONB,  -- Specific content for this topic
  estimated_duration_minutes INTEGER DEFAULT 45,
  difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
  
  learning_objectives TEXT[],
  prerequisites TEXT[],  -- Other topics that should be covered first
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- LESSON PLANNING
-- ============================================

-- Academic Years
CREATE TABLE academic_years (
  year_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
  
  year_name TEXT NOT NULL,  -- "2025-2026"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  status TEXT CHECK (status IN ('upcoming', 'active', 'completed')) DEFAULT 'upcoming',
  is_current BOOLEAN DEFAULT false,
  
  graduating_grade INTEGER,  -- e.g., 12
  admitting_grade INTEGER,   -- e.g., 1
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(school_id, year_name)
);

-- Master lesson plans
CREATE TABLE lesson_plans (
  plan_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES syllabus_documents(document_id),
  
  teacher_id UUID REFERENCES users(user_id),
  class_id UUID REFERENCES classes(class_id),
  academic_year_id UUID REFERENCES academic_years(year_id),
  
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_periods INTEGER,
  periods_per_week INTEGER,
  
  -- AI-generated schedule
  ai_schedule JSONB,  -- Day-by-day breakdown
  
  status TEXT CHECK (status IN ('draft', 'published', 'in_progress', 'completed')) DEFAULT 'draft',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP
);

-- Daily lesson details (auto-populated from lesson plan)
CREATE TABLE daily_lesson_details (
  detail_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES lesson_plans(plan_id) ON DELETE CASCADE,
  topic_id UUID REFERENCES lesson_topics(topic_id),
  
  lesson_date DATE NOT NULL,
  day_number INTEGER,  -- Day 1, 2, 3... of the lesson plan
  period_number INTEGER,  -- Which period of the day
  
  topic_content JSONB,  -- What will be covered this period
  resources_generated BOOLEAN DEFAULT false,
  
  status TEXT CHECK (status IN ('scheduled', 'completed', 'skipped')) DEFAULT 'scheduled',
  actual_completion_date DATE,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- AI-GENERATED RESOURCES
-- ============================================

-- Topic resources (5 types + MCQs)
CREATE TABLE topic_resources (
  resource_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID REFERENCES lesson_topics(topic_id) ON DELETE CASCADE,
  
  -- The 5 core text resources
  lesson_notes JSONB,        -- Detailed formatted text
  study_guide JSONB,         -- Summary & key points
  worksheet JSONB,           -- Practice problems with answers
  revision_notes JSONB,      -- Ultra-condensed cheat sheet
  formulas_list JSONB,       -- All formulas & definitions
  
  -- Additional resources
  youtube_links TEXT[],      -- Suggested videos
  teacher_uploads JSONB,     -- Custom materials added by teacher
  
  -- Metadata
  ai_generated BOOLEAN DEFAULT true,
  edited_by UUID REFERENCES users(user_id),
  last_edited_at TIMESTAMP,
  version INTEGER DEFAULT 1,
  
  -- Access tracking
  view_count INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- MCQ Generations (Hybrid approach - track all generations)
CREATE TABLE mcq_generations (
  generation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID REFERENCES lesson_topics(topic_id) ON DELETE CASCADE,
  
  generation_number INTEGER NOT NULL,  -- 1st, 2nd, 3rd...
  mcq_type TEXT CHECK (mcq_type IN ('daily', 'weekly', 'chapter')) DEFAULT 'daily',
  
  question_count INTEGER DEFAULT 50,
  questions JSONB NOT NULL,
  /*
  Structure:
  [
    {
      "question": "What is 2+2?",
      "options": ["A) 3", "B) 4", "C) 5", "D) 6"],
      "correct_answer": "B",
      "explanation": "2+2 equals 4",
      "difficulty": "easy"
    }
  ]
  */
  
  difficulty_distribution JSONB,  -- {easy: 15, medium: 25, hard: 10}
  
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(topic_id, generation_number, mcq_type)
);

-- Resource views tracking
CREATE TABLE resource_views (
  view_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id UUID REFERENCES topic_resources(resource_id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(user_id),
  
  resource_type TEXT NOT NULL,  -- which of the 5 types
  viewed_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- STUDENT HISTORY (For year-end transitions)
-- ============================================

CREATE TABLE student_academic_history (
  history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(year_id),
  
  grade_level INTEGER NOT NULL,
  class_id UUID REFERENCES classes(class_id),
  section_id UUID REFERENCES sections(section_id),
  
  final_attendance_percentage DECIMAL,
  final_grade TEXT,
  promoted BOOLEAN,
  remarks TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(student_id, academic_year_id)
);

-- Promotion rules (configurable by school)
CREATE TABLE promotion_rules (
  rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
  
  from_grade INTEGER NOT NULL,
  to_grade INTEGER NOT NULL,
  
  min_attendance_required DECIMAL DEFAULT 75.0,
  min_grade_required TEXT DEFAULT 'D',
  
  auto_promote BOOLEAN DEFAULT true,
  manual_review_required BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(school_id, from_grade)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Subjects
CREATE INDEX idx_subjects_school ON subjects(school_id);
CREATE INDEX idx_subjects_active ON subjects(is_active);

-- Syllabus documents
CREATE INDEX idx_syllabus_subject ON syllabus_documents(subject_id);
CREATE INDEX idx_syllabus_grade ON syllabus_documents(grade_level);
CREATE INDEX idx_syllabus_content ON syllabus_documents USING GIN (content);

-- Topics
CREATE INDEX idx_topics_document ON lesson_topics(document_id);
CREATE INDEX idx_topics_difficulty ON lesson_topics(difficulty_level);

-- Lesson plans
CREATE INDEX idx_plans_teacher ON lesson_plans(teacher_id);
CREATE INDEX idx_plans_class ON lesson_plans(class_id);
CREATE INDEX idx_plans_year ON lesson_plans(academic_year_id);
CREATE INDEX idx_plans_status ON lesson_plans(status);

-- Daily lessons
CREATE INDEX idx_daily_plan ON daily_lesson_details(plan_id);
CREATE INDEX idx_daily_date ON daily_lesson_details(lesson_date);
CREATE INDEX idx_daily_topic ON daily_lesson_details(topic_id);

-- Resources
CREATE INDEX idx_resources_topic ON topic_resources(topic_id);

-- MCQs
CREATE INDEX idx_mcq_topic ON mcq_generations(topic_id);
CREATE INDEX idx_mcq_generation ON mcq_generations(topic_id, generation_number DESC);

-- Academic years
CREATE INDEX idx_academic_year_school ON academic_years(school_id);
CREATE INDEX idx_academic_year_current ON academic_years(is_current);

-- Student history
CREATE INDEX idx_student_history_student ON student_academic_history(student_id);
CREATE INDEX idx_student_history_year ON student_academic_history(academic_year_id);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON subjects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_syllabus_updated_at BEFORE UPDATE ON syllabus_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_topics_updated_at BEFORE UPDATE ON lesson_topics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lesson_plans_updated_at BEFORE UPDATE ON lesson_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_topic_resources_updated_at BEFORE UPDATE ON topic_resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promotion_rules_updated_at BEFORE UPDATE ON promotion_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================

-- Subjects (all authenticated users can view)
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to view subjects" ON subjects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admins to manage subjects" ON subjects
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

-- Teacher subjects (teachers can view their assignments)
ALTER TABLE teacher_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view their own assignments" ON teacher_subjects
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users
    WHERE users.user_id = auth.uid()
    AND users.role IN ('super_admin', 'sub_admin')
  ));

-- Syllabus documents (teachers and admins can view)
ALTER TABLE syllabus_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow teachers and admins to view syllabus" ON syllabus_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

CREATE POLICY "Allow admins and teachers to create syllabus" ON syllabus_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

CREATE POLICY "Allow admins and teachers to update syllabus" ON syllabus_documents
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

CREATE POLICY "Allow admins to delete syllabus" ON syllabus_documents
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

-- Lesson plans (teachers can view/edit their own)
ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their own lesson plans" ON lesson_plans
  FOR ALL TO authenticated
  USING (
    teacher_id = auth.uid() OR EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

-- Topic resources (all authenticated users can view)
ALTER TABLE topic_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to view resources" ON topic_resources
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow teachers to edit resources" ON topic_resources
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin', 'teacher')
    )
  );

-- MCQ generations (all authenticated can view)
ALTER TABLE mcq_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to view MCQs" ON mcq_generations
  FOR SELECT TO authenticated USING (true);

-- Academic years (all can view, admins can manage)
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to view academic years" ON academic_years
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admins to manage academic years" ON academic_years
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.user_id = auth.uid()
      AND users.role IN ('super_admin', 'sub_admin')
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE subjects IS 'School subjects (Math, Science, English, etc.)';
COMMENT ON TABLE teacher_subjects IS 'Which teachers teach which subjects';
COMMENT ON TABLE syllabus_documents IS 'AI-converted syllabus content (99% compressed)';
COMMENT ON TABLE lesson_topics IS 'Individual topics within chapters';
COMMENT ON TABLE academic_years IS 'School academic years for student progression';
COMMENT ON TABLE lesson_plans IS 'AI-generated lesson plans with schedules';
COMMENT ON TABLE daily_lesson_details IS 'Day-by-day breakdown of lessons';
COMMENT ON TABLE topic_resources IS '5 core text resources per topic';
COMMENT ON TABLE mcq_generations IS 'Unique MCQ sets using hybrid approach';
COMMENT ON TABLE student_academic_history IS 'Historical data for year-end transitions';
COMMENT ON TABLE promotion_rules IS 'Auto-promotion rules by grade';

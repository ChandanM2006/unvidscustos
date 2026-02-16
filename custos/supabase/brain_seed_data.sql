-- ============================================
-- CUSTOS BRAIN: Complete Seed Data
-- Creates subjects → syllabus docs → topics → brain data
-- Pulls real school_id, class_id, student IDs from your DB
-- ============================================

DO $$
DECLARE
  v_school_id    UUID;
  v_class_id     UUID;
  v_teacher_id   UUID;
  v_students     UUID[];
  v_subject_math UUID;
  v_subject_sci  UUID;
  v_subject_eng  UUID;
  v_doc_math     UUID;
  v_doc_sci      UUID;
  v_doc_eng      UUID;
  v_topic_ids    UUID[];
  v_sid          UUID;
BEGIN

  -- ═══════════════════════════════════════════
  -- STEP 1: Get existing IDs from your database
  -- ═══════════════════════════════════════════

  -- Get school
  SELECT school_id INTO v_school_id FROM schools LIMIT 1;
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'No school found. Please create a school first.';
  END IF;
  RAISE NOTICE '✅ School: %', v_school_id;

  -- Get a class
  SELECT class_id INTO v_class_id FROM classes WHERE school_id = v_school_id LIMIT 1;
  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'No class found. Please create a class first.';
  END IF;
  RAISE NOTICE '✅ Class: %', v_class_id;

  -- Get teacher
  SELECT user_id INTO v_teacher_id FROM users WHERE role = 'teacher' AND school_id = v_school_id LIMIT 1;
  RAISE NOTICE '📝 Teacher: %', COALESCE(v_teacher_id::text, 'none found');

  -- Get students
  SELECT ARRAY(
    SELECT user_id FROM users
    WHERE role = 'student' AND school_id = v_school_id
    ORDER BY created_at LIMIT 5
  ) INTO v_students;

  IF array_length(v_students, 1) IS NULL OR array_length(v_students, 1) = 0 THEN
    RAISE EXCEPTION 'No students found. Please create at least 1 student user.';
  END IF;
  RAISE NOTICE '✅ Students found: %', array_length(v_students, 1);

  -- ═══════════════════════════════════════════
  -- STEP 2: Create 3 Subjects (if they don't exist)
  -- ═══════════════════════════════════════════

  -- Mathematics
  SELECT subject_id INTO v_subject_math FROM subjects
  WHERE school_id = v_school_id AND name = 'Mathematics' LIMIT 1;

  IF v_subject_math IS NULL THEN
    INSERT INTO subjects (school_id, name, code, description, grade_levels, is_active)
    VALUES (v_school_id, 'Mathematics', 'MATH-10', 'Core Mathematics including Algebra, Geometry, and Arithmetic', ARRAY[9,10], true)
    RETURNING subject_id INTO v_subject_math;
    RAISE NOTICE '✅ Created subject: Mathematics';
  ELSE
    RAISE NOTICE '📝 Using existing subject: Mathematics';
  END IF;

  -- Science
  SELECT subject_id INTO v_subject_sci FROM subjects
  WHERE school_id = v_school_id AND name = 'Science' LIMIT 1;

  IF v_subject_sci IS NULL THEN
    INSERT INTO subjects (school_id, name, code, description, grade_levels, is_active)
    VALUES (v_school_id, 'Science', 'SCI-10', 'General Science covering Physics, Chemistry, and Biology', ARRAY[9,10], true)
    RETURNING subject_id INTO v_subject_sci;
    RAISE NOTICE '✅ Created subject: Science';
  ELSE
    RAISE NOTICE '📝 Using existing subject: Science';
  END IF;

  -- English
  SELECT subject_id INTO v_subject_eng FROM subjects
  WHERE school_id = v_school_id AND name = 'English' LIMIT 1;

  IF v_subject_eng IS NULL THEN
    INSERT INTO subjects (school_id, name, code, description, grade_levels, is_active)
    VALUES (v_school_id, 'English', 'ENG-10', 'English Language and Literature', ARRAY[9,10], true)
    RETURNING subject_id INTO v_subject_eng;
    RAISE NOTICE '✅ Created subject: English';
  ELSE
    RAISE NOTICE '📝 Using existing subject: English';
  END IF;

  -- ═══════════════════════════════════════════
  -- STEP 3: Create Syllabus Documents (chapters)
  -- ═══════════════════════════════════════════

  -- Math Chapter: Fractions & Algebra
  INSERT INTO syllabus_documents (subject_id, grade_level, chapter_number, chapter_title, original_filename, content, uploaded_by)
  VALUES (
    v_subject_math, 10, 1, 'Fractions and Algebra',
    'math_ch1.pdf',
    '{"title": "Chapter 1: Fractions and Algebra", "sections": [{"heading": "Basic Fractions", "text": "Understanding numerators and denominators"}, {"heading": "Adding Fractions", "text": "Finding common denominators"}, {"heading": "Algebra Basics", "text": "Introduction to variables and expressions"}], "key_points": ["Fractions represent parts of a whole", "LCM is used for adding fractions", "Variables represent unknown values"]}'::jsonb,
    COALESCE(v_teacher_id, v_students[1])
  ) RETURNING document_id INTO v_doc_math;

  -- Science Chapter: Motion & Force
  INSERT INTO syllabus_documents (subject_id, grade_level, chapter_number, chapter_title, original_filename, content, uploaded_by)
  VALUES (
    v_subject_sci, 10, 1, 'Motion and Force',
    'science_ch1.pdf',
    '{"title": "Chapter 1: Motion and Force", "sections": [{"heading": "Types of Motion", "text": "Linear, circular, periodic motion"}, {"heading": "Speed and Velocity", "text": "Difference between speed and velocity"}, {"heading": "Newtons Laws", "text": "Three laws of motion"}], "key_points": ["Speed = Distance/Time", "Velocity has direction", "F = ma"]}'::jsonb,
    COALESCE(v_teacher_id, v_students[1])
  ) RETURNING document_id INTO v_doc_sci;

  -- English Chapter: Grammar
  INSERT INTO syllabus_documents (subject_id, grade_level, chapter_number, chapter_title, original_filename, content, uploaded_by)
  VALUES (
    v_subject_eng, 10, 1, 'Grammar Fundamentals',
    'eng_ch1.pdf',
    '{"title": "Chapter 1: Grammar Fundamentals", "sections": [{"heading": "Parts of Speech", "text": "Nouns, verbs, adjectives, adverbs"}, {"heading": "Tenses", "text": "Past, present, future tenses"}, {"heading": "Sentence Structure", "text": "Subject-verb-object pattern"}], "key_points": ["8 parts of speech", "12 tenses in English", "Every sentence needs a subject and verb"]}'::jsonb,
    COALESCE(v_teacher_id, v_students[1])
  ) RETURNING document_id INTO v_doc_eng;

  RAISE NOTICE '✅ Created 3 syllabus documents';

  -- ═══════════════════════════════════════════
  -- STEP 4: Create 9 Lesson Topics (3 per subject)
  -- ═══════════════════════════════════════════

  v_topic_ids := ARRAY[]::UUID[];

  -- Math Topics
  INSERT INTO lesson_topics (document_id, topic_number, topic_title, difficulty_level, estimated_duration_minutes, learning_objectives, content)
  VALUES
    (v_doc_math, 1, 'Basic Fractions', 'easy', 40, ARRAY['Understand numerator and denominator', 'Convert between fractions and decimals'], '{"summary": "Understanding the basics of fractions"}'::jsonb)
  RETURNING topic_id INTO v_sid;
  v_topic_ids := array_append(v_topic_ids, v_sid);

  INSERT INTO lesson_topics (document_id, topic_number, topic_title, difficulty_level, estimated_duration_minutes, learning_objectives, content)
  VALUES
    (v_doc_math, 2, 'Adding & Subtracting Fractions', 'medium', 45, ARRAY['Find LCM of denominators', 'Add fractions with different denominators'], '{"summary": "Operations with fractions"}'::jsonb)
  RETURNING topic_id INTO v_sid;
  v_topic_ids := array_append(v_topic_ids, v_sid);

  INSERT INTO lesson_topics (document_id, topic_number, topic_title, difficulty_level, estimated_duration_minutes, learning_objectives, content)
  VALUES
    (v_doc_math, 3, 'Introduction to Algebra', 'medium', 50, ARRAY['Understand variables', 'Solve simple equations'], '{"summary": "Basic algebraic concepts"}'::jsonb)
  RETURNING topic_id INTO v_sid;
  v_topic_ids := array_append(v_topic_ids, v_sid);

  -- Science Topics
  INSERT INTO lesson_topics (document_id, topic_number, topic_title, difficulty_level, estimated_duration_minutes, learning_objectives, content)
  VALUES
    (v_doc_sci, 1, 'Types of Motion', 'easy', 35, ARRAY['Identify linear motion', 'Identify circular and periodic motion'], '{"summary": "Understanding different types of motion"}'::jsonb)
  RETURNING topic_id INTO v_sid;
  v_topic_ids := array_append(v_topic_ids, v_sid);

  INSERT INTO lesson_topics (document_id, topic_number, topic_title, difficulty_level, estimated_duration_minutes, learning_objectives, content)
  VALUES
    (v_doc_sci, 2, 'Speed and Velocity', 'medium', 45, ARRAY['Calculate speed', 'Differentiate speed and velocity'], '{"summary": "Speed, velocity, and their measurement"}'::jsonb)
  RETURNING topic_id INTO v_sid;
  v_topic_ids := array_append(v_topic_ids, v_sid);

  INSERT INTO lesson_topics (document_id, topic_number, topic_title, difficulty_level, estimated_duration_minutes, learning_objectives, content)
  VALUES
    (v_doc_sci, 3, 'Newton''s Laws of Motion', 'hard', 55, ARRAY['State all three laws', 'Solve F=ma problems'], '{"summary": "Three laws governing motion and forces"}'::jsonb)
  RETURNING topic_id INTO v_sid;
  v_topic_ids := array_append(v_topic_ids, v_sid);

  -- English Topics
  INSERT INTO lesson_topics (document_id, topic_number, topic_title, difficulty_level, estimated_duration_minutes, learning_objectives, content)
  VALUES
    (v_doc_eng, 1, 'Parts of Speech', 'easy', 35, ARRAY['Identify nouns, verbs, adjectives', 'Use parts of speech correctly'], '{"summary": "The 8 parts of speech"}'::jsonb)
  RETURNING topic_id INTO v_sid;
  v_topic_ids := array_append(v_topic_ids, v_sid);

  INSERT INTO lesson_topics (document_id, topic_number, topic_title, difficulty_level, estimated_duration_minutes, learning_objectives, content)
  VALUES
    (v_doc_eng, 2, 'Tenses', 'medium', 45, ARRAY['Use present, past, and future tenses', 'Identify tense in sentences'], '{"summary": "Understanding and using all 12 tenses"}'::jsonb)
  RETURNING topic_id INTO v_sid;
  v_topic_ids := array_append(v_topic_ids, v_sid);

  INSERT INTO lesson_topics (document_id, topic_number, topic_title, difficulty_level, estimated_duration_minutes, learning_objectives, content)
  VALUES
    (v_doc_eng, 3, 'Sentence Structure', 'medium', 40, ARRAY['Construct proper sentences', 'Identify subject-verb-object'], '{"summary": "Building correct sentence structure"}'::jsonb)
  RETURNING topic_id INTO v_sid;
  v_topic_ids := array_append(v_topic_ids, v_sid);

  RAISE NOTICE '✅ Created 9 lesson topics';
  RAISE NOTICE '   Topic IDs: %', v_topic_ids;

  -- ═══════════════════════════════════════════
  -- STEP 5: Seed Brain Performance Data
  -- Uses first 3 topics for performance tracking
  -- ═══════════════════════════════════════════

  -- ─── Student 1: Mixed (Weak in Fractions ops & Algebra, Strong in Basic Fractions) ───
  v_sid := v_students[1];

  INSERT INTO student_topic_performance (student_id, topic_id, total_attempts, correct_answers, accuracy_percentage, average_time_seconds, weakness_score, is_weak_topic, last_assessed_at, consecutive_correct, needs_reinforcement)
  VALUES
    (v_sid, v_topic_ids[1], 20, 17, 85.00, 18, 12.00, false, NOW() - INTERVAL '1 day', 5, false),
    (v_sid, v_topic_ids[2], 15, 8,  53.33, 32, 62.00, true,  NOW() - INTERVAL '2 days', 0, true),
    (v_sid, v_topic_ids[3], 10, 4,  40.00, 35, 72.00, true,  NOW() - INTERVAL '5 days', 0, true)
  ON CONFLICT (student_id, topic_id) DO NOTHING;

  INSERT INTO student_scores (student_id, performance_score, activity_score, daily_streak, longest_streak, weekly_completions, total_attempts, badges_earned)
  VALUES (v_sid, 59.44, 247, 6, 12, 3, 45, '["First Steps", "Week Warrior"]')
  ON CONFLICT (student_id, academic_year_id) DO NOTHING;

  -- Completed daily test yesterday + pending today
  INSERT INTO assessment_phases (student_id, topic_id, phase_type, scheduled_date, completed_at, total_questions, correct_answers, score_percentage, time_taken_seconds, weak_topic_count, strong_topic_count, status, questions)
  VALUES
    (v_sid, v_topic_ids[1], 'daily', CURRENT_DATE - 1, NOW() - INTERVAL '20 hours', 10, 7, 70.00, 180, 6, 4, 'completed',
     jsonb_build_array(jsonb_build_object(
       'question_id', 'q1',
       'topic_id', v_topic_ids[1]::text,
       'question_text', 'What is 3/4 in decimal?',
       'options', jsonb_build_array('A) 0.75', 'B) 0.50', 'C) 0.25', 'D) 1.00'),
       'correct_answer', 'A',
       'difficulty', 'easy',
       'student_answer', 'A',
       'is_correct', true,
       'time_taken', 12
     ))),
    (v_sid, v_topic_ids[2], 'daily', CURRENT_DATE, NULL, 10, 0, 0.00, 0, 6, 4, 'pending',
     jsonb_build_array(jsonb_build_object(
       'question_id', 'q2',
       'topic_id', v_topic_ids[2]::text,
       'question_text', 'What is 1/2 + 1/3?',
       'options', jsonb_build_array('A) 5/6', 'B) 2/5', 'C) 1/6', 'D) 3/5'),
       'correct_answer', 'A',
       'difficulty', 'medium'
     )));

  -- Sample doubt
  INSERT INTO student_doubts (student_id, topic_id, doubt_text, ai_response, was_helpful, status)
  VALUES (v_sid, v_topic_ids[3], 'How do I solve x + 5 = 12?',
          'To solve x + 5 = 12, subtract 5 from both sides: x = 12 - 5 = 7. Always do the same operation on both sides!',
          true, 'ai_answered');

  RAISE NOTICE '✅ Student 1 seeded: %', v_sid;

  -- ─── Student 2: Strong all around ───
  IF array_length(v_students, 1) >= 2 THEN
    v_sid := v_students[2];

    INSERT INTO student_topic_performance (student_id, topic_id, total_attempts, correct_answers, accuracy_percentage, average_time_seconds, weakness_score, is_weak_topic, last_assessed_at, consecutive_correct, needs_reinforcement)
    VALUES
      (v_sid, v_topic_ids[1], 25, 23, 92.00, 15, 8.00,  false, NOW() - INTERVAL '1 day', 7, false),
      (v_sid, v_topic_ids[2], 20, 18, 90.00, 20, 12.00, false, NOW(), 5, false),
      (v_sid, v_topic_ids[3], 18, 15, 83.33, 22, 18.50, false, NOW() - INTERVAL '2 days', 2, false)
    ON CONFLICT (student_id, topic_id) DO NOTHING;

    INSERT INTO student_scores (student_id, performance_score, activity_score, daily_streak, longest_streak, weekly_completions, total_attempts, badges_earned)
    VALUES (v_sid, 88.44, 892, 14, 14, 8, 63, '["First Steps", "Week Warrior", "Fortnight Fighter", "Sharp Shooter"]')
    ON CONFLICT (student_id, academic_year_id) DO NOTHING;

    -- Weekly test completed
    INSERT INTO assessment_phases (student_id, phase_type, scheduled_date, completed_at, total_questions, correct_answers, score_percentage, time_taken_seconds, weak_topic_count, strong_topic_count, status)
    VALUES (v_sid, 'weekly', CURRENT_DATE - 2, NOW() - INTERVAL '2 days', 20, 18, 90.00, 420, 4, 16, 'completed');

    RAISE NOTICE '✅ Student 2 seeded: %', v_sid;
  END IF;

  -- ─── Daily Topic Schedule (for today + next 3 days) ───
  BEGIN
    INSERT INTO daily_topic_schedule (class_id, section_id, subject_id, topic_id, scheduled_date, covered_in_class, daily_mcq_enabled, created_by)
    SELECT 
      v_class_id,
      s.section_id,
      v_subject_math,
      v_topic_ids[1],
      CURRENT_DATE,
      true,
      true,
      v_teacher_id
    FROM sections s WHERE s.class_id = v_class_id LIMIT 1
    ON CONFLICT (class_id, section_id, subject_id, scheduled_date) DO NOTHING;

    RAISE NOTICE '✅ Daily schedule seeded for today';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️  Daily schedule insert skipped (may need sections): %', SQLERRM;
  END;

  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════';
  RAISE NOTICE '🧠 BRAIN SEED DATA COMPLETE!';
  RAISE NOTICE '══════════════════════════════════════';
  RAISE NOTICE '  Subjects:  3 (Math, Science, English)';
  RAISE NOTICE '  Chapters:  3 (one per subject)';
  RAISE NOTICE '  Topics:    9 (three per chapter)';
  RAISE NOTICE '  Students seeded: %', LEAST(array_length(v_students, 1), 2);
  RAISE NOTICE '══════════════════════════════════════';

END;
$$;

-- ============================================
-- VERIFICATION QUERIES (run these to confirm)
-- ============================================

-- 1. Topics created
SELECT lt.topic_title, lt.difficulty_level, sd.chapter_title, s.name as subject
FROM lesson_topics lt
JOIN syllabus_documents sd ON sd.document_id = lt.document_id
JOIN subjects s ON s.subject_id = sd.subject_id
ORDER BY s.name, lt.topic_number;

-- 2. Student performance data
SELECT u.full_name, lt.topic_title, stp.accuracy_percentage, stp.weakness_score, stp.is_weak_topic
FROM student_topic_performance stp
JOIN users u ON u.user_id = stp.student_id
JOIN lesson_topics lt ON lt.topic_id = stp.topic_id
ORDER BY u.full_name, stp.weakness_score DESC;

-- 3. Dual scores
SELECT u.full_name, ss.performance_score AS "perf (hidden)", ss.activity_score AS "activity (visible)", ss.daily_streak, ss.badges_earned
FROM student_scores ss
JOIN users u ON u.user_id = ss.student_id
ORDER BY ss.performance_score DESC;

-- 4. Assessment phases
SELECT u.full_name, ap.phase_type, ap.scheduled_date, ap.status, ap.score_percentage
FROM assessment_phases ap
JOIN users u ON u.user_id = ap.student_id
ORDER BY ap.scheduled_date DESC;

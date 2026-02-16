-- =============================================
-- Mock Data for Teacher Dashboard + Chatbot
-- Run AFTER migrate_chatbot.sql
-- =============================================

DO $$
DECLARE
    v_student_id   UUID;
    v_student2_id  UUID;
    v_student3_id  UUID;
    v_teacher_id   UUID;
    v_topic_id     UUID;
    v_topic2_id    UUID;
    v_session_id   UUID;
BEGIN

-- ─── 1. Find Users ──────────────────────────────────────
-- Pick first 3 students
SELECT user_id INTO v_student_id
FROM users WHERE role = 'student' LIMIT 1;

SELECT user_id INTO v_student2_id
FROM users WHERE role = 'student' AND user_id != v_student_id LIMIT 1;

SELECT user_id INTO v_student3_id
FROM users WHERE role = 'student' AND user_id != v_student_id AND user_id != v_student2_id LIMIT 1;

-- Pick a teacher
SELECT user_id INTO v_teacher_id
FROM users WHERE role = 'teacher' LIMIT 1;

-- Pick first 2 topics
SELECT topic_id INTO v_topic_id
FROM lesson_topics LIMIT 1;

SELECT topic_id INTO v_topic2_id
FROM lesson_topics WHERE topic_id != v_topic_id LIMIT 1;

IF v_student_id IS NULL OR v_teacher_id IS NULL THEN
    RAISE NOTICE 'Need at least 1 student and 1 teacher in users table!';
    RETURN;
END IF;

RAISE NOTICE 'Student 1: %, Student 2: %, Student 3: %',
    v_student_id, v_student2_id, v_student3_id;
RAISE NOTICE 'Teacher: %', v_teacher_id;

-- ─── 2. Seed Student Doubts (for chatbot + teacher doubts) ───

-- Student 1: Struggling with fractions (3+ doubts = auto-escalate)
INSERT INTO student_doubts (student_id, topic_id, doubt_text, ai_response, status, flagged_for_teacher, created_at)
VALUES
    (v_student_id, v_topic_id,
     'How do I add fractions with different denominators?',
     'Great question! To add fractions with different denominators: 1) Find the LCD 2) Convert each fraction 3) Add numerators. Example: 1/2 + 1/3 → LCD=6 → 3/6 + 2/6 = 5/6 ✅',
     'ai_answered', false,
     NOW() - INTERVAL '5 days'),

    (v_student_id, v_topic_id,
     'I still don''t understand LCD. What is it?',
     'LCD (Least Common Denominator) is the smallest number that both denominators divide into evenly. For 2 and 3: multiples of 2 are 2,4,6,8... multiples of 3 are 3,6,9... The first common one is 6! 🎯',
     'ai_answered', false,
     NOW() - INTERVAL '3 days'),

    (v_student_id, v_topic_id,
     'Can you give me another example of LCD?',
     'Sure! For 4 and 6: multiples of 4 are 4,8,12... multiples of 6 are 6,12... LCD = 12! So 1/4 + 1/6 = 3/12 + 2/12 = 5/12 ✅',
     'escalated', true,
     NOW() - INTERVAL '1 day');

-- Student 2: General question (not escalated)
IF v_student2_id IS NOT NULL AND v_topic2_id IS NOT NULL THEN
    INSERT INTO student_doubts (student_id, topic_id, doubt_text, ai_response, status, created_at)
    VALUES
        (v_student2_id, v_topic2_id,
         'What is the formula for area of a triangle?',
         'The area of a triangle = 1/2 × base × height. Remember: base is the bottom side and height is the perpendicular distance from base to the top vertex! 📐',
         'ai_answered',
         NOW() - INTERVAL '2 days');
END IF;

-- Student 3: Teacher-answered doubt
IF v_student3_id IS NOT NULL THEN
    INSERT INTO student_doubts (student_id, topic_id, doubt_text, ai_response, teacher_response, status, flagged_for_teacher, created_at)
    VALUES
        (v_student3_id, v_topic_id,
         'I keep getting confused between improper fractions and mixed numbers',
         'An improper fraction has a numerator larger than denominator (like 7/3). A mixed number separates the whole part: 7/3 = 2 and 1/3. To convert: divide the numerator by denominator!',
         'Great question! Remember the trick: divide top by bottom. The quotient is the whole number, remainder is the new numerator. Practice 5 problems tonight and show me tomorrow! 😊',
         'teacher_answered', false,
         NOW() - INTERVAL '4 days');
END IF;

-- ─── 3. Seed Chat Sessions + Messages ───────────────────

INSERT INTO chat_sessions (session_id, student_id, topic_id, title, created_at)
VALUES (gen_random_uuid(), v_student_id, v_topic_id, 'Help with fractions', NOW() - INTERVAL '5 days')
RETURNING session_id INTO v_session_id;

INSERT INTO chat_messages (session_id, role, content, created_at)
VALUES
    (v_session_id, 'user', 'How do I add fractions with different denominators?', NOW() - INTERVAL '5 days'),
    (v_session_id, 'assistant', 'Great question! To add fractions with different denominators:

1. Find the LCD (Least Common Denominator)
2. Convert each fraction to have the LCD
3. Add the numerators
4. Simplify if possible

**Example:** 1/2 + 1/3
- LCD of 2 and 3 = 6
- 1/2 = 3/6
- 1/3 = 2/6
- 3/6 + 2/6 = **5/6** ✅

Would you like to try a practice problem? 😊', NOW() - INTERVAL '5 days' + INTERVAL '30 seconds'),

    (v_session_id, 'user', 'Yes, give me a practice problem!', NOW() - INTERVAL '5 days' + INTERVAL '2 minutes'),
    (v_session_id, 'assistant', 'Try this: What is 2/5 + 1/3?

**Hint:** First find the LCD of 5 and 3. What multiples do they share?

Take your time! 🧠', NOW() - INTERVAL '5 days' + INTERVAL '2 minutes 30 seconds'),

    (v_session_id, 'user', 'LCD is 15, so 6/15 + 5/15 = 11/15?', NOW() - INTERVAL '5 days' + INTERVAL '5 minutes'),
    (v_session_id, 'assistant', 'Perfect! 🎉 You got it!

2/5 = 6/15 ✅
1/3 = 5/15 ✅
6/15 + 5/15 = **11/15** ✅

You''re getting the hang of it! Want another one? 😊', NOW() - INTERVAL '5 days' + INTERVAL '5 minutes 30 seconds');

-- ─── 4. Seed Notifications ─────────────────────────────

-- Teacher gets notified about struggling student
INSERT INTO notifications (user_id, title, message, type, action_url, action_label, created_at)
VALUES
    (v_teacher_id,
     '⚠️ Student Needs Help',
     'A student has asked 3 questions about the same topic this week. They may need extra support.',
     'alert',
     '/dashboard/teacher/students/' || v_student_id,
     'View Student',
     NOW() - INTERVAL '1 day'),

    (v_teacher_id,
     '📊 Weekly Performance Report',
     'Class 10-A weekly performance report is ready. Average: 74.5%. 7 students need attention.',
     'info',
     '/dashboard/teacher/performance',
     'View Report',
     NOW() - INTERVAL '2 days');

-- Student gets notifications
INSERT INTO notifications (user_id, title, message, type, action_url, is_read, created_at)
VALUES
    (v_student_id,
     '🎯 Daily Practice Ready',
     'Your personalized practice for today is ready! 10 questions waiting.',
     'info',
     '/dashboard/student/practice',
     true,
     NOW() - INTERVAL '1 day'),

    (v_student_id,
     '🔥 Streak Milestone!',
     'Amazing! You''ve maintained a 5-day practice streak!',
     'success',
     '/dashboard/student/analytics',
     true,
     NOW() - INTERVAL '3 days'),

    (v_student_id,
     '📝 Weekly Test Available',
     'Your weekly test covering this week''s topics is now available. 30 mins, 20 questions.',
     'info',
     '/dashboard/student/practice?type=weekly',
     false,
     NOW());

-- Teacher doubt response notification to student
IF v_student3_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, action_url, created_at)
    VALUES
        (v_student3_id,
         '👨‍🏫 Teacher Responded!',
         'Your teacher has answered your doubt about fractions. Check it out!',
         'info',
         '/dashboard/student/tutor',
         NOW() - INTERVAL '3 days');
END IF;

RAISE NOTICE '✅ Mock data created: doubts, chat sessions, notifications';

END $$;

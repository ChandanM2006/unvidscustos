-- ============================================================
-- CUSTOS: Mock Activity Data for Analytics Testing
-- ============================================================
-- Automatically picks the FIRST student in your database.
-- No manual replacement needed!
-- ============================================================

DO $$
DECLARE
    student_uuid UUID;
    d INTEGER;
    test_date DATE;
    score_pct NUMERIC;
    correct_count INTEGER;
    total_q INTEGER := 10;
    time_secs INTEGER;
    ach_id UUID;
BEGIN
    -- ─── 0. Auto-detect a real student ────────────────────
    SELECT user_id INTO student_uuid
    FROM users
    WHERE role = 'student'
    LIMIT 1;

    IF student_uuid IS NULL THEN
        RAISE EXCEPTION 'No student found in users table. Please seed users first.';
    END IF;

    RAISE NOTICE 'Using student: %', student_uuid;

    -- ─── 1. Ensure student_scores row exists ──────────────
    INSERT INTO student_scores (student_id, activity_score, daily_streak, longest_streak, weekly_completions, total_attempts, badges_earned)
    VALUES (student_uuid, 847, 12, 15, 4, 156, '["first_practice", "weekly_warrior", "streak_7", "accuracy_star"]'::jsonb)
    ON CONFLICT (student_id, academic_year_id) DO UPDATE SET
        activity_score = 847,
        daily_streak = 12,
        longest_streak = 15,
        weekly_completions = 4,
        total_attempts = 156,
        badges_earned = '["first_practice", "weekly_warrior", "streak_7", "accuracy_star"]'::jsonb;

    -- ─── 2. Insert 30 days of daily assessment_phases ─────
    -- Last 12 days: all completed (current streak)
    FOR d IN 0..11 LOOP
        test_date := CURRENT_DATE - d;
        score_pct := 60 + floor(random() * 40);
        correct_count := round(score_pct / 100.0 * total_q)::INTEGER;
        time_secs := 180 + floor(random() * 300)::INTEGER;

        INSERT INTO assessment_phases (
            student_id, phase_type, scheduled_date, total_questions,
            correct_answers, score_percentage, status, time_taken_seconds,
            questions, weak_topic_count, strong_topic_count
        ) VALUES (
            student_uuid, 'daily', test_date, total_q,
            correct_count, score_pct, 'completed', time_secs,
            '[]'::jsonb, 6, 4
        )
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- Days 13-14: missed (natural break before streak)

    -- Days 15-25: partial completion (skip days 17, 20, 23)
    FOR d IN 15..25 LOOP
        test_date := CURRENT_DATE - d;
        IF d NOT IN (17, 20, 23) THEN
            score_pct := 50 + floor(random() * 40);
            correct_count := round(score_pct / 100.0 * total_q)::INTEGER;
            time_secs := 200 + floor(random() * 250)::INTEGER;

            INSERT INTO assessment_phases (
                student_id, phase_type, scheduled_date, total_questions,
                correct_answers, score_percentage, status, time_taken_seconds,
                questions, weak_topic_count, strong_topic_count
            ) VALUES (
                student_uuid, 'daily', test_date, total_q,
                correct_count, score_pct, 'completed', time_secs,
                '[]'::jsonb, 7, 3
            )
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    -- Days 26-29: sparse (only days 26, 28)
    FOR d IN 26..29 LOOP
        test_date := CURRENT_DATE - d;
        IF d IN (26, 28) THEN
            score_pct := 45 + floor(random() * 35);
            correct_count := round(score_pct / 100.0 * total_q)::INTEGER;
            time_secs := 150 + floor(random() * 200)::INTEGER;

            INSERT INTO assessment_phases (
                student_id, phase_type, scheduled_date, total_questions,
                correct_answers, score_percentage, status, time_taken_seconds,
                questions, weak_topic_count, strong_topic_count
            ) VALUES (
                student_uuid, 'daily', test_date, total_q,
                correct_count, score_pct, 'completed', time_secs,
                '[]'::jsonb, 8, 2
            )
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    -- ─── 3. Insert weekly test phases ─────────────────────
    INSERT INTO assessment_phases (
        student_id, phase_type, scheduled_date, total_questions,
        correct_answers, score_percentage, status, time_taken_seconds,
        questions, weak_topic_count, strong_topic_count
    ) VALUES
    (student_uuid, 'weekly', CURRENT_DATE - 7,  20, 16, 80.0, 'completed', 1450, '[]'::jsonb, 12, 8),
    (student_uuid, 'weekly', CURRENT_DATE - 14, 20, 14, 70.0, 'completed', 1620, '[]'::jsonb, 13, 7),
    (student_uuid, 'weekly', CURRENT_DATE - 21, 20, 12, 60.0, 'completed', 1700, '[]'::jsonb, 14, 6),
    (student_uuid, 'weekly', CURRENT_DATE - 28, 20, 15, 75.0, 'completed', 1500, '[]'::jsonb, 12, 8)
    ON CONFLICT DO NOTHING;

    -- ─── 4. Insert topic performance (strong topics) ──────
    -- Pick 3 random topics as "strong"
    FOR ach_id IN
        SELECT topic_id FROM lesson_topics ORDER BY random() LIMIT 3
    LOOP
        INSERT INTO student_topic_performance (
            student_id, topic_id, total_attempts, correct_answers,
            accuracy_percentage, average_time_seconds, is_weak_topic,
            weakness_score, last_assessed_at, consecutive_correct, needs_reinforcement
        ) VALUES (
            student_uuid, ach_id,
            15 + floor(random() * 10)::INTEGER,
            12 + floor(random() * 10)::INTEGER,
            85 + floor(random() * 15),
            15 + floor(random() * 10)::INTEGER,
            FALSE,
            10 + floor(random() * 20),
            CURRENT_TIMESTAMP - (floor(random() * 3) || ' days')::INTERVAL,
            3 + floor(random() * 5)::INTEGER,
            FALSE
        )
        ON CONFLICT (student_id, topic_id) DO UPDATE SET
            total_attempts = EXCLUDED.total_attempts,
            accuracy_percentage = EXCLUDED.accuracy_percentage,
            is_weak_topic = FALSE,
            weakness_score = EXCLUDED.weakness_score,
            last_assessed_at = EXCLUDED.last_assessed_at;
    END LOOP;

    -- ─── 5. Insert topic performance (weak topics) ────────
    -- Pick 2 different random topics as "weak"
    FOR ach_id IN
        SELECT topic_id FROM lesson_topics
        WHERE topic_id NOT IN (
            SELECT topic_id FROM student_topic_performance
            WHERE student_id = student_uuid
        )
        ORDER BY random() LIMIT 2
    LOOP
        INSERT INTO student_topic_performance (
            student_id, topic_id, total_attempts, correct_answers,
            accuracy_percentage, average_time_seconds, is_weak_topic,
            weakness_score, last_assessed_at, consecutive_correct, needs_reinforcement
        ) VALUES (
            student_uuid, ach_id,
            3 + floor(random() * 5)::INTEGER,
            1 + floor(random() * 3)::INTEGER,
            40 + floor(random() * 20),
            25 + floor(random() * 15)::INTEGER,
            TRUE,
            60 + floor(random() * 30),
            CURRENT_TIMESTAMP - ((3 + floor(random() * 7))::INTEGER || ' days')::INTERVAL,
            0,
            TRUE
        )
        ON CONFLICT (student_id, topic_id) DO UPDATE SET
            total_attempts = EXCLUDED.total_attempts,
            accuracy_percentage = EXCLUDED.accuracy_percentage,
            is_weak_topic = TRUE,
            weakness_score = EXCLUDED.weakness_score,
            last_assessed_at = EXCLUDED.last_assessed_at;
    END LOOP;

    -- ─── 6. Seed base achievements (if not already) ──────
    INSERT INTO achievements (name, description, icon, category, criteria, points_awarded, is_active)
    VALUES
        ('First Steps',       'Complete your first daily practice',           '🌱', 'milestone',     '{"daily_completions": 1}'::jsonb,                        10, TRUE),
        ('Week Warrior',      'Complete 5 days in a row',                     '⚔️', 'streak',        '{"streak_days": 5}'::jsonb,                              25, TRUE),
        ('Streak Master',     'Maintain a 7-day streak',                      '🔥', 'streak',        '{"streak_days": 7}'::jsonb,                              50, TRUE),
        ('Accuracy Star',     '90%+ accuracy on 20+ questions',              '🎯', 'accuracy',      '{"accuracy": 90, "min_questions": 20}'::jsonb,           40, TRUE),
        ('Practice Pro',      'Complete 10 daily practices',                  '💪', 'participation', '{"daily_completions": 10}'::jsonb,                       30, TRUE),
        ('Knowledge Seeker',  'Ask your first question',                      '🤔', 'participation', '{"doubts_asked": 1}'::jsonb,                             15, TRUE),
        ('Comeback Kid',      'Improve from weak to strong on a topic',      '📈', 'improvement',   '{"weak_to_strong": true}'::jsonb,                        60, TRUE),
        ('Century Club',      'Earn 100 activity points',                     '💯', 'milestone',     '{"min_score": 100}'::jsonb,                              20, TRUE)
    ON CONFLICT DO NOTHING;

    -- ─── 7. Award achievements to the test student ────────
    FOR ach_id IN
        SELECT achievement_id FROM achievements
        WHERE name IN ('First Steps', 'Week Warrior', 'Streak Master',
                       'Practice Pro', 'Accuracy Star', 'Comeback Kid',
                       'Century Club', 'Knowledge Seeker')
    LOOP
        INSERT INTO student_achievements (student_id, achievement_id, earned_at)
        VALUES (student_uuid, ach_id, CURRENT_TIMESTAMP - (floor(random() * 20) || ' days')::INTERVAL)
        ON CONFLICT (student_id, achievement_id) DO NOTHING;
    END LOOP;

    RAISE NOTICE 'Done! Mock data seeded for student: %', student_uuid;
END $$;

-- ============================================================
-- DONE! Navigate to /dashboard/student/analytics to see the data.
-- ============================================================

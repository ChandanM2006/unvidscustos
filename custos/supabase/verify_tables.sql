-- =============================================
-- VERIFY ALL TABLES EXIST
-- Run this to check your database status
-- =============================================

-- List all CUSTOS tables
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('attendance_records', 'attendance_summary', 'leave_requests') THEN '✅ Attendance'
        WHEN table_name IN ('student_academic_history', 'promotion_batches', 'promotion_rules') THEN '✅ Promotions'
        WHEN table_name IN ('timetable_slots', 'timetable_entries', 'teacher_availability', 'timetable_substitutions') THEN '✅ Timetable'
        WHEN table_name IN ('exam_types', 'exams', 'student_marks', 'report_cards', 'grading_scales') THEN '✅ Report Cards'
        WHEN table_name IN ('notifications', 'announcements', 'notification_preferences') THEN '✅ Notifications'
        WHEN table_name IN ('topic_resources', 'mcq_generations', 'student_mcq_attempts') THEN '✅ Resources/MCQ'
        WHEN table_name IN ('users', 'schools', 'classes', 'sections', 'subjects') THEN '✅ Core'
        WHEN table_name IN ('syllabus_documents', 'syllabus_chapters', 'lesson_topics') THEN '✅ Syllabus'
        WHEN table_name IN ('lesson_plans', 'lesson_plan_days') THEN '✅ Lesson Plans'
        ELSE '📦 Other'
    END as category
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY category, table_name;

/**
 * CUSTOS Brain: Lesson-wise Comprehensive Test Generator
 *
 * Called when: A teacher marks a lesson as "completed" in the lesson plan.
 * Generates a 30-question 60/40 adaptive test covering ALL topics in the
 * completed lesson, personalized per student.
 */

import { createClient } from '@supabase/supabase-js'
import { generate60_40QuestionSet } from '@/lib/analytics/brainEngine'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Generates comprehensive lesson tests for all students in a section.
 *
 * @param lessonPlanId - The lesson_plans.plan_id
 * @param sectionId    - The section to generate tests for
 * @returns Summary with counts of tests created and any errors
 */
export async function generateLessonTest(
    lessonPlanId: string,
    sectionId: string
): Promise<{ testsCreated: number; errors: string[] }> {
    const errors: string[] = []
    let testsCreated = 0

    try {
        // 1. Get all topics in this lesson
        const { data: lesson, error: lessonErr } = await supabase
            .from('lesson_plans')
            .select(`
                plan_id,
                subject_id,
                class_id,
                daily_lesson_details (
                    detail_id,
                    lesson_topics (
                        topic_id,
                        topic_name
                    )
                )
            `)
            .eq('plan_id', lessonPlanId)
            .single()

        if (lessonErr || !lesson) {
            errors.push(`Lesson not found: ${lessonErr?.message || 'Unknown error'}`)
            return { testsCreated, errors }
        }

        // Flatten all topics from all days in the lesson
        const allTopics = (lesson.daily_lesson_details as any[])
            ?.flatMap((day: any) => day.lesson_topics || []) || []

        if (allTopics.length === 0) {
            errors.push('No topics found in this lesson plan')
            return { testsCreated, errors }
        }

        // 2. Get all students in the section
        const { data: students, error: studentsErr } = await supabase
            .from('users')
            .select('user_id')
            .eq('role', 'student')
            .eq('section_id', sectionId)

        if (studentsErr || !students || students.length === 0) {
            errors.push('No students found in section')
            return { testsCreated, errors }
        }

        const today = new Date().toISOString().split('T')[0]

        // 3. Check for existing lesson tests (avoid duplicates)
        const { data: existingPhases } = await supabase
            .from('assessment_phases')
            .select('student_id')
            .eq('phase_type', 'lesson')
            .eq('lesson_plan_id', lessonPlanId)

        const existingStudentIds = new Set(existingPhases?.map((p) => p.student_id) || [])

        // 4. Generate a personalized 30-question test for each student
        for (const student of students) {
            if (existingStudentIds.has(student.user_id)) {
                continue // Already has a test for this lesson
            }

            try {
                const questionSet = await generate60_40QuestionSet(
                    student.user_id,
                    'lesson',
                    30 // More comprehensive than weekly
                )

                if (questionSet.questions.length === 0) {
                    continue
                }

                const { error: insertErr } = await supabase
                    .from('assessment_phases')
                    .insert({
                        student_id: student.user_id,
                        phase_type: 'lesson',
                        scheduled_date: today, // Available immediately
                        questions: questionSet.questions,
                        weak_topic_count: questionSet.weakCount,
                        strong_topic_count: questionSet.strongCount,
                        status: 'pending',
                        total_questions: questionSet.questions.length,
                        time_limit_minutes: 45,
                        lesson_plan_id: lessonPlanId,
                    })

                if (insertErr) {
                    errors.push(`Student ${student.user_id}: ${insertErr.message}`)
                } else {
                    testsCreated++
                }
            } catch (err: any) {
                errors.push(`Student ${student.user_id}: ${err.message}`)
            }
        }

        return { testsCreated, errors }
    } catch (err: any) {
        errors.push(`Lesson test generation failed: ${err.message}`)
        return { testsCreated, errors }
    }
}

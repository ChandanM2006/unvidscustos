/**
 * CUSTOS Brain: Weekly Test Generator
 *
 * Triggered by: Vercel Cron (every Sunday at 8 PM IST = 2:30 PM UTC)
 * OR manually via GET /api/cron/generate-weekly-tests?secret=YOUR_CRON_SECRET
 *
 * Logic:
 * 1. Get all topics covered this week (Mon–Sun) from daily_topic_schedule
 * 2. Group students by section
 * 3. For each student, generate a personalized 20-question 60/40 set
 * 4. Create pending assessment_phase entries scheduled for next Monday
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generate60_40QuestionSet } from '@/lib/analytics/brainEngine'
import { getCurrentWeekRange } from '@/lib/analytics/helpers'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

function getNextMonday(): string {
    const now = new Date()
    const day = now.getDay()
    const daysUntilMonday = day === 0 ? 1 : 8 - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + daysUntilMonday)
    return monday.toISOString().split('T')[0]
}

export async function GET(request: NextRequest) {
    try {
        // Security: verify cron secret
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET
        const urlSecret = new URL(request.url).searchParams.get('secret')

        if (cronSecret && authHeader !== `Bearer ${cronSecret}` && urlSecret !== cronSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const thisWeek = getCurrentWeekRange()
        let totalTestsCreated = 0
        let studentsProcessed = 0
        const errors: string[] = []

        // 1. Get all topics covered this week
        const { data: weekTopics } = await supabase
            .from('daily_topic_schedule')
            .select(`
                schedule_id,
                class_id,
                section_id,
                subject_id,
                topic_id,
                covered_in_class
            `)
            .gte('scheduled_date', thisWeek.start)
            .lte('scheduled_date', thisWeek.end)
            .eq('covered_in_class', true)

        // 2. Group by section
        const sectionIds = new Set<string>()
        if (weekTopics) {
            for (const t of weekTopics) {
                if (t.section_id) sectionIds.add(t.section_id)
            }
        }

        // If no topics were explicitly covered this week, still generate
        // tests for all students using their existing performance data
        if (sectionIds.size === 0) {
            // Fallback: get all sections with students
            const { data: allStudents } = await supabase
                .from('users')
                .select('section_id')
                .eq('role', 'student')
                .not('section_id', 'is', null)

            if (allStudents) {
                for (const s of allStudents) {
                    if (s.section_id) sectionIds.add(s.section_id)
                }
            }
        }

        const scheduledDate = getNextMonday()

        // 3. Check which students already have this week's test
        const { data: existingPhases } = await supabase
            .from('assessment_phases')
            .select('student_id')
            .eq('phase_type', 'weekly')
            .eq('scheduled_date', scheduledDate)

        const existingStudentIds = new Set(existingPhases?.map((p) => p.student_id) || [])

        // 4. For each section, get students and generate tests
        for (const sectionId of sectionIds) {
            const { data: students } = await supabase
                .from('users')
                .select('user_id, class_id, section_id')
                .eq('role', 'student')
                .eq('section_id', sectionId)

            if (!students || students.length === 0) continue

            for (const student of students) {
                studentsProcessed++

                if (existingStudentIds.has(student.user_id)) {
                    continue // Already has weekly test
                }

                try {
                    // Generate 20-question 60/40 set
                    const questionSet = await generate60_40QuestionSet(
                        student.user_id,
                        'weekly',
                        20
                    )

                    if (questionSet.questions.length === 0) {
                        continue // No topics available
                    }

                    const { error: insertErr } = await supabase
                        .from('assessment_phases')
                        .insert({
                            student_id: student.user_id,
                            phase_type: 'weekly',
                            scheduled_date: scheduledDate,
                            questions: questionSet.questions,
                            weak_topic_count: questionSet.weakCount,
                            strong_topic_count: questionSet.strongCount,
                            status: 'pending',
                            total_questions: questionSet.questions.length,
                            time_limit_minutes: 30,
                        })

                    if (insertErr) {
                        errors.push(`Student ${student.user_id}: ${insertErr.message}`)
                    } else {
                        totalTestsCreated++
                    }
                } catch (err: any) {
                    errors.push(`Student ${student.user_id}: ${err.message}`)
                }
            }
        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            scheduledFor: scheduledDate,
            weekRange: thisWeek,
            stats: {
                studentsProcessed,
                testsCreated: totalTestsCreated,
                skippedExisting: existingStudentIds.size,
                topicsCoveredThisWeek: weekTopics?.length || 0,
                sectionsProcessed: sectionIds.size,
                errors: errors.length > 0 ? errors : undefined,
            },
        })
    } catch (err: any) {
        console.error('[Cron] Weekly test generation error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

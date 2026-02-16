/**
 * CUSTOS Brain: Daily Practice Auto-Generator
 *
 * Triggered by: Vercel Cron (every day at 6 PM IST = 12:30 PM UTC)
 * OR manually via GET /api/cron/generate-daily-practice?secret=YOUR_CRON_SECRET
 *
 * Logic:
 * 1. Get today's covered topics from daily_topic_schedule
 * 2. Group students by section
 * 3. For each student, generate personalized 60/40 question set
 * 4. Create pending assessment_phase entries
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generate60_40QuestionSet } from '@/lib/analytics/brainEngine'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        // Security: verify cron secret (Vercel sends this automatically)
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET
        const urlSecret = new URL(request.url).searchParams.get('secret')

        if (cronSecret && authHeader !== `Bearer ${cronSecret}` && urlSecret !== cronSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const today = new Date().toISOString().split('T')[0]
        let studentsProcessed = 0
        let phasesCreated = 0
        let errors: string[] = []

        // 1. Get today's covered topics
        const { data: todaySchedule } = await supabase
            .from('daily_topic_schedule')
            .select(`
        schedule_id,
        class_id,
        section_id,
        subject_id,
        topic_id,
        covered_in_class,
        daily_mcq_enabled
      `)
            .eq('scheduled_date', today)
            .eq('daily_mcq_enabled', true)

        // 2. If no topics covered today, still generate practice for all students
        // using their existing performance data (the Brain adapts)
        const { data: allStudents } = await supabase
            .from('users')
            .select('user_id, class_id, section_id')
            .eq('role', 'student')

        if (!allStudents || allStudents.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No students found',
                stats: { studentsProcessed: 0, phasesCreated: 0 },
            })
        }

        // 3. Check which students already have today's practice
        const { data: existingPhases } = await supabase
            .from('assessment_phases')
            .select('student_id')
            .eq('phase_type', 'daily')
            .eq('scheduled_date', today)

        const existingStudentIds = new Set(existingPhases?.map((p) => p.student_id) || [])

        // 4. For each student without today's practice
        for (const student of allStudents) {
            studentsProcessed++

            if (existingStudentIds.has(student.user_id)) {
                continue // Already has today's practice
            }

            try {
                // Find the primary topic for today (if any)
                const todayTopic = todaySchedule?.find(
                    (s) =>
                        s.class_id === student.class_id &&
                        s.section_id === student.section_id
                )

                // Generate 60/40 question set (Brain's core algorithm)
                const questionSet = await generate60_40QuestionSet(
                    student.user_id,
                    'daily',
                    10 // 10 questions for daily practice
                )

                if (questionSet.questions.length === 0) {
                    continue // No topics available for this student
                }

                // Create assessment phase
                const { error: insertErr } = await supabase
                    .from('assessment_phases')
                    .insert({
                        student_id: student.user_id,
                        topic_id: todayTopic?.topic_id || null,
                        phase_type: 'daily',
                        scheduled_date: today,
                        questions: questionSet.questions,
                        weak_topic_count: questionSet.weakCount,
                        strong_topic_count: questionSet.strongCount,
                        status: 'pending',
                        total_questions: questionSet.questions.length,
                    })

                if (insertErr) {
                    errors.push(`Student ${student.user_id}: ${insertErr.message}`)
                } else {
                    phasesCreated++
                }
            } catch (err: any) {
                errors.push(`Student ${student.user_id}: ${err.message}`)
            }
        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            stats: {
                studentsProcessed,
                phasesCreated,
                skippedExisting: existingStudentIds.size,
                topicsCoveredToday: todaySchedule?.length || 0,
                errors: errors.length > 0 ? errors : undefined,
            },
        })
    } catch (err: any) {
        console.error('[Cron] Daily practice generation error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

// GET: Fetch teacher's sessions for today
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const teacherId = searchParams.get('teacherId')

        if (!teacherId) {
            return NextResponse.json({ error: 'teacherId required' }, { status: 400 })
        }

        const today = new Date().toISOString().split('T')[0]

        const { data: sessions, error } = await supabase
            .from('live_class_sessions')
            .select('*')
            .eq('teacher_id', teacherId)
            .eq('session_date', today)
            .order('created_at', { ascending: true })

        if (error) throw error

        return NextResponse.json({ sessions: sessions || [] })
    } catch (error: any) {
        console.error('GET live-session error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST: Start a new session
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const {
            teacher_id,
            entry_id,
            class_id,
            section_id,
            subject_id,
            slot_id,
            plan_id,
            scheduled_topics,
            pending_topics
        } = body

        if (!class_id || !subject_id || !entry_id || !teacher_id) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const today = new Date().toISOString().split('T')[0]

        // Check if session already exists for this entry today
        const { data: existing } = await supabase
            .from('live_class_sessions')
            .select('session_id, status')
            .eq('teacher_id', teacher_id)
            .eq('entry_id', entry_id)
            .eq('session_date', today)
            .single()

        if (existing) {
            if (existing.status === 'in_progress') {
                return NextResponse.json({ error: 'Session already in progress', session_id: existing.session_id }, { status: 409 })
            }
            if (existing.status === 'completed') {
                return NextResponse.json({ error: 'Session already completed for this period today' }, { status: 409 })
            }
        }

        // Create or update session
        const sessionData = {
            teacher_id,
            class_id,
            section_id: section_id || null,
            subject_id,
            entry_id,
            slot_id: slot_id || null,
            plan_id: plan_id || null,
            session_date: today,
            scheduled_topics: scheduled_topics || [],
            pending_topics: pending_topics || [],
            covered_topics: [],
            started_at: new Date().toISOString(),
            status: 'in_progress'
        }

        let result
        if (existing) {
            // Resume / restart
            const { data, error } = await supabase
                .from('live_class_sessions')
                .update({
                    started_at: new Date().toISOString(),
                    status: 'in_progress',
                    ended_at: null,
                    covered_topics: [],
                    pending_topics: pending_topics || [],
                })
                .eq('session_id', existing.session_id)
                .select()
                .single()
            if (error) throw error
            result = data
        } else {
            const { data, error } = await supabase
                .from('live_class_sessions')
                .insert(sessionData)
                .select()
                .single()
            if (error) throw error
            result = data
        }

        return NextResponse.json({ session: result })
    } catch (error: any) {
        console.error('POST live-session error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PATCH: End session / update covered topics + rearrange schedule
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json()
        const { session_id, covered_topics, teacher_notes, action } = body

        if (!session_id) {
            return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
        }

        // Get existing session
        const { data: existing } = await supabase
            .from('live_class_sessions')
            .select('*')
            .eq('session_id', session_id)
            .single()

        if (!existing) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 })
        }

        if (action === 'end') {
            const endedAt = new Date()
            const startedAt = new Date(existing.started_at)
            const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000)

            // Find uncovered topics
            const allScheduled = [...(existing.scheduled_topics || []), ...(existing.pending_topics || [])]
            const coveredIds = new Set((covered_topics || []).map((t: any) => t.topic_id))
            const uncoveredTopics = allScheduled.filter((t: any) => !coveredIds.has(t.topic_id))

            const { data, error } = await supabase
                .from('live_class_sessions')
                .update({
                    status: 'completed',
                    ended_at: endedAt.toISOString(),
                    duration_minutes: durationMinutes,
                    covered_topics: covered_topics || [],
                    teacher_notes: teacher_notes || null,
                    uncovered_topics: uncoveredTopics,
                })
                .eq('session_id', session_id)
                .select()
                .single()

            if (error) throw error

            // ── Rearrange lesson plan schedule if there are uncovered topics ──
            if (uncoveredTopics.length > 0 && existing.plan_id) {
                try {
                    await rearrangeSchedule(
                        existing.plan_id,
                        existing.class_id,
                        existing.teacher_id,
                        uncoveredTopics
                    )
                } catch (rearrangeError) {
                    console.error('Schedule rearrange failed (non-fatal):', rearrangeError)
                    // Non-fatal — session still completed successfully
                }
            }

            return NextResponse.json({ session: data, uncovered_topics: uncoveredTopics })
        }

        if (action === 'cancel') {
            const { data, error } = await supabase
                .from('live_class_sessions')
                .update({
                    status: 'cancelled',
                    ended_at: new Date().toISOString(),
                })
                .eq('session_id', session_id)
                .select()
                .single()

            if (error) throw error
            return NextResponse.json({ session: data })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch (error: any) {
        console.error('PATCH live-session error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// ── Rearrange schedule: push uncovered topics to next days ──
async function rearrangeSchedule(
    planId: string,
    classId: string,
    teacherId: string,
    uncoveredTopics: any[]
) {
    // Get the lesson plan
    const { data: plan, error: planError } = await supabase
        .from('lesson_plans')
        .select('plan_id, ai_schedule, start_date, end_date')
        .eq('plan_id', planId)
        .single()

    if (planError || !plan || !plan.ai_schedule) return

    const schedule = plan.ai_schedule.schedule || plan.ai_schedule
    if (!Array.isArray(schedule) || schedule.length === 0) return

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    // Helper: calculate date from plan start_date + day offset
    function getDateForDay(startDate: string, dayNum: number): string {
        const d = new Date(startDate + 'T12:00:00')
        d.setDate(d.getDate() + dayNum - 1)
        return d.toISOString().split('T')[0]
    }

    // Find today's day number in the schedule
    let todayDayNum = -1
    for (const item of schedule) {
        const dayNum = item.day || item.day_number
        if (!dayNum || !plan.start_date) continue
        const itemDate = getDateForDay(plan.start_date, dayNum)
        if (itemDate === todayStr) {
            todayDayNum = dayNum
            break
        }
    }

    if (todayDayNum === -1) return

    // Find the next day in schedule after today
    const futureDays = schedule
        .filter((item: any) => {
            const dayNum = item.day || item.day_number
            return dayNum > todayDayNum
        })
        .sort((a: any, b: any) => (a.day || a.day_number) - (b.day || b.day_number))

    if (futureDays.length === 0) return // No more days to push to

    // Build new schedule: inject uncovered topics into next day's schedule
    const updatedSchedule = schedule.map((item: any) => {
        const dayNum = item.day || item.day_number
        const nextDay = futureDays[0]
        const nextDayNum = nextDay.day || nextDay.day_number

        if (dayNum === nextDayNum) {
            // Add uncovered topics as "pending" prefix
            const pendingTopicTitles = uncoveredTopics.map((t: any) => t.topic_title)
            return {
                ...item,
                pending_from_previous: pendingTopicTitles,
                has_pending: true,
                original_topic_title: item.topic_title,
                notes: `Pending from previous class: ${pendingTopicTitles.join(', ')}`
            }
        }
        return item
    })

    // Save back the rearranged schedule
    const newAiSchedule = plan.ai_schedule.schedule
        ? { ...plan.ai_schedule, schedule: updatedSchedule, last_rearranged: todayStr }
        : updatedSchedule

    await supabase
        .from('lesson_plans')
        .update({
            ai_schedule: newAiSchedule,
            updated_at: new Date().toISOString()
        })
        .eq('plan_id', planId)
}

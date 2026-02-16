/**
 * CUSTOS Parent API: Get Single Child Detail
 *
 * GET /api/parent/child/[id]?parentId=...
 *     → Returns detailed ACTIVITY data for one child
 *     → NO performance scores, NO rankings, NO accuracy
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: childId } = await params
        const { searchParams } = new URL(request.url)
        const parentId = searchParams.get('parentId')

        if (!parentId || !childId) {
            return NextResponse.json({ error: 'parentId and childId required' }, { status: 400 })
        }

        // Verify parent role
        const { data: parentUser } = await supabase
            .from('users')
            .select('user_id, role, school_id')
            .eq('user_id', parentId)
            .single()

        if (!parentUser || parentUser.role !== 'parent') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Verify parent-child link
        const { data: link } = await supabase
            .from('parent_student_links')
            .select('link_id')
            .eq('parent_id', parentId)
            .eq('student_id', childId)
            .single()

        // If no link and links exist, deny
        if (!link) {
            const { count } = await supabase
                .from('parent_student_links')
                .select('*', { count: 'exact', head: true })
                .eq('parent_id', parentId)

            if ((count || 0) > 0) {
                return NextResponse.json({ error: 'Not your child' }, { status: 403 })
            }
        }

        // Get student info
        const { data: student } = await supabase
            .from('users')
            .select('user_id, full_name, class_id, section_id')
            .eq('user_id', childId)
            .single()

        if (!student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 })
        }

        let className = '', sectionName = ''
        if (student.class_id) {
            const { data: cls } = await supabase.from('classes').select('name').eq('class_id', student.class_id).single()
            className = cls?.name || ''
        }
        if (student.section_id) {
            const { data: sec } = await supabase.from('sections').select('name').eq('section_id', student.section_id).single()
            sectionName = sec?.name || ''
        }

        // Activity scores
        const { data: scores } = await supabase
            .from('student_scores')
            .select('activity_score, daily_streak, longest_streak, weekly_completions, total_attempts')
            .eq('student_id', childId)
            .order('last_updated', { ascending: false })
            .limit(1)

        const score = scores?.[0]

        // This week's daily completion
        const today = new Date()
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7))
        const weekStartStr = weekStart.toISOString().split('T')[0]
        const todayStr = today.toISOString().split('T')[0]

        const { data: weekPhases } = await supabase
            .from('assessment_phases')
            .select('scheduled_date, status, time_taken_seconds')
            .eq('student_id', childId)
            .eq('phase_type', 'daily')
            .gte('scheduled_date', weekStartStr)
            .lte('scheduled_date', todayStr)
            .order('scheduled_date')

        // Build week calendar
        const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        const weekActivity = dayLabels.map((label, i) => {
            const d = new Date(weekStart)
            d.setDate(weekStart.getDate() + i)
            const dateStr = d.toISOString().split('T')[0]
            const phase = weekPhases?.find(p => p.scheduled_date === dateStr)
            const isFuture = d > today

            let status = 'future'
            if (!isFuture) {
                if (phase?.status === 'completed') status = 'completed'
                else if (phase?.status === 'missed') status = 'missed'
                else if (dateStr === todayStr) status = 'pending'
                else status = 'missed'
            }

            return { label, date: dateStr, status }
        })

        // Time spent this week
        const completedPhases = weekPhases?.filter(p => p.status === 'completed') || []
        const totalSeconds = completedPhases.reduce((sum, p) => sum + (p.time_taken_seconds || 0), 0)
        const timeSpentMinutes = Math.round(totalSeconds / 60)
        const avgMinutes = completedPhases.length > 0 ? Math.round(timeSpentMinutes / completedPhases.length) : 0

        // Topics covered this week (NAMES ONLY, no scores)
        let topicsCovered: Array<{ subject: string; topic: string }> = []
        if (student.class_id && student.section_id) {
            const { data: schedules } = await supabase
                .from('daily_topic_schedule')
                .select(`
                    topic:topic_id (topic_name),
                    subject:subject_id (name)
                `)
                .eq('class_id', student.class_id)
                .eq('section_id', student.section_id)
                .gte('scheduled_date', weekStartStr)
                .lte('scheduled_date', todayStr)

            if (schedules) {
                topicsCovered = schedules.map((s: any) => ({
                    subject: s.subject?.name || 'Subject',
                    topic: s.topic?.topic_name || 'Topic',
                })).filter((t, i, arr) =>
                    arr.findIndex(x => x.subject === t.subject && x.topic === t.topic) === i
                )
            }
        }

        // Achievements (all earned)
        const { data: achData } = await supabase
            .from('student_achievements')
            .select(`
                earned_at,
                achievements (name, description, icon, category, points_awarded)
            `)
            .eq('student_id', childId)
            .order('earned_at', { ascending: false })

        const achievements = (achData || []).map((a: any) => ({
            name: a.achievements?.name || 'Badge',
            description: a.achievements?.description || null,
            icon: a.achievements?.icon || '🏆',
            category: a.achievements?.category || 'milestone',
            points: a.achievements?.points_awarded || 0,
            earned_at: a.earned_at,
        }))

        // Attendance summary
        const { data: attendance } = await supabase
            .from('attendance_records')
            .select('status')
            .eq('student_id', childId)

        let attendancePercent = 0
        if (attendance && attendance.length > 0) {
            const present = attendance.filter(a => a.status === 'present' || a.status === 'late').length
            attendancePercent = Math.round((present / attendance.length) * 100)
        }

        return NextResponse.json({
            child: {
                student_id: childId,
                full_name: student.full_name,
                class_name: className,
                section_name: sectionName,
            },
            activity: {
                streak: score?.daily_streak || 0,
                longest_streak: score?.longest_streak || 0,
                total_points: score?.activity_score || 0,
                total_attempts: score?.total_attempts || 0,
                weekly_completions: score?.weekly_completions || 0,
            },
            week_calendar: weekActivity,
            time: {
                total_minutes_week: timeSpentMinutes,
                avg_per_day: avgMinutes,
                days_completed: completedPhases.length,
            },
            topics_covered: topicsCovered,
            achievements,
            attendance_percent: attendancePercent,
            // ❌ NO performance data exposed
        })
    } catch (err: any) {
        console.error('[Parent Child Detail API] Error:', err)
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
    }
}

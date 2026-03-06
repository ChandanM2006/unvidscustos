/**
 * CUSTOS Parent API: Get Children Activity
 *
 * GET /api/parent/children?parentId=...
 *     → Returns ACTIVITY-ONLY data for all linked children
 *     → NO performance scores, NO rankings, NO accuracy
 *
 * Privacy Model:
 *   Parents CAN see: completion status, streak, points, achievements, topics covered
 *   Parents CANNOT see: performance score, class rank, accuracy %, weak/strong breakdown
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const parentId = searchParams.get('parentId')

        if (!parentId) {
            return NextResponse.json({ error: 'parentId required' }, { status: 400 })
        }

        // Verify the user is a parent
        const { data: parentUser } = await supabase
            .from('users')
            .select('user_id, role, school_id')
            .eq('user_id', parentId)
            .single()

        if (!parentUser || parentUser.role !== 'parent') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        // Get all linked children
        const { data: links, error: linksError } = await supabase
            .from('parent_student_links')
            .select('student_id')
            .eq('parent_id', parentId)

        console.log('[Parent API] parentId:', parentId)
        console.log('[Parent API] links found:', links?.length || 0, links)
        if (linksError) console.error('[Parent API] links error:', linksError)

        let childIds: string[] = []
        if (links && links.length > 0) {
            childIds = links.map(l => l.student_id)
        }

        if (childIds.length === 0) {
            return NextResponse.json({ children: [] })
        }

        // Fetch ACTIVITY data for each child (NO performance data)
        const childrenActivity = await Promise.all(
            childIds.map(async (childId) => {
                // Student info
                const { data: student } = await supabase
                    .from('users')
                    .select('user_id, full_name, class_id, section_id')
                    .eq('user_id', childId)
                    .single()

                if (!student) return null

                // Class + Section names
                let className = '', sectionName = ''
                if (student.class_id) {
                    const { data: cls } = await supabase.from('classes').select('name').eq('class_id', student.class_id).single()
                    className = cls?.name || ''
                }
                if (student.section_id) {
                    const { data: sec } = await supabase.from('sections').select('name').eq('section_id', student.section_id).single()
                    sectionName = sec?.name || ''
                }

                // Activity scores (NOT performance scores!)
                const { data: scores } = await supabase
                    .from('student_scores')
                    .select('activity_score, daily_streak, weekly_completions')
                    .eq('student_id', childId)
                    .order('last_updated', { ascending: false })
                    .limit(1)

                const score = scores?.[0]

                // Today's status
                const today = new Date().toISOString().split('T')[0]
                const { data: todayPhases } = await supabase
                    .from('assessment_phases')
                    .select('status, total_questions')
                    .eq('student_id', childId)
                    .eq('scheduled_date', today)
                    .eq('phase_type', 'daily')

                let todayStatus = 'pending'
                let todayCompleted = 0
                let todayTotal = 10
                if (todayPhases && todayPhases.length > 0) {
                    const phase = todayPhases[0]
                    todayTotal = phase.total_questions || 10
                    if (phase.status === 'completed') {
                        todayStatus = 'completed'
                        todayCompleted = todayTotal
                    } else if (phase.status === 'missed') {
                        todayStatus = 'missed'
                    }
                }

                // Week completion
                const weekStart = new Date()
                weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
                const { data: weekPhases } = await supabase
                    .from('assessment_phases')
                    .select('status')
                    .eq('student_id', childId)
                    .eq('phase_type', 'daily')
                    .gte('scheduled_date', weekStart.toISOString().split('T')[0])
                    .lte('scheduled_date', today)

                const weekCompleted = weekPhases?.filter(p => p.status === 'completed').length || 0
                const dayOfWeek = Math.min(new Date().getDay() || 7, 7)

                // Recent achievements
                const { data: achData } = await supabase
                    .from('student_achievements')
                    .select(`
                        earned_at,
                        achievements (name, icon)
                    `)
                    .eq('student_id', childId)
                    .order('earned_at', { ascending: false })
                    .limit(3)

                const recentAchievements = (achData || []).map((a: any) => ({
                    name: a.achievements?.name || 'Badge',
                    icon: a.achievements?.icon || '🏆',
                    earned_at: a.earned_at,
                }))

                // Look up the class teacher for this child's class
                let classTeacherId = null, classTeacherName = null
                if (student.class_id) {
                    const { data: ct } = await supabase
                        .from('users')
                        .select('user_id, full_name')
                        .eq('role', 'teacher')
                        .eq('class_id', student.class_id)
                        .eq('school_id', parentUser.school_id)
                        .limit(1)

                    if (ct && ct.length > 0) {
                        classTeacherId = ct[0].user_id
                        classTeacherName = ct[0].full_name
                    }
                }

                return {
                    student_id: childId,
                    full_name: student.full_name || 'Student',
                    class_id: student.class_id || null,
                    class_name: className,
                    section_name: sectionName,
                    class_teacher_id: classTeacherId,
                    class_teacher_name: classTeacherName,
                    today_status: todayStatus,
                    today_completed: todayCompleted,
                    today_total: todayTotal,
                    streak: score?.daily_streak || 0,
                    activity_points: score?.activity_score || 0,
                    week_completion: { completed: weekCompleted, total: dayOfWeek },
                    recent_achievements: recentAchievements,
                    time_spent_today: 0,
                    // ❌ DELIBERATELY NOT INCLUDING:
                    // performance_score, performance_rank, accuracy_percentage,
                    // weak_topics, strong_topics, class_rank, test_results
                }
            })
        )

        return NextResponse.json({
            children: childrenActivity.filter(Boolean)
        })
    } catch (err: any) {
        console.error('[Parent Children API] Error:', err)
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
    }
}

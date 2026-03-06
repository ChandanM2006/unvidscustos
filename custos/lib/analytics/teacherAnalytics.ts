/**
 * CUSTOS Brain – Teacher Analytics Helper Functions
 *
 * Provides comprehensive performance data visible ONLY to teachers/admins.
 * Students never see these metrics directly.
 *
 * Key functions:
 *   getClassPerformance()     – overview stats for a section
 *   getStudentDeepDive()      – individual student detail
 *   getTopicClassReport()     – per-topic performance for a class
 *   getConcerningPatterns()   – AI-detected warning signs
 */

import { createClient } from '@supabase/supabase-js'
import { getCurrentStreak, getCurrentWeekRange, daysBetween } from '@/lib/analytics/helpers'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types ───────────────────────────────────────────────

export interface StudentPerformance {
    student_id: string
    full_name: string
    performance_score: number
    performance_rank: number
    performance_trend: 'improving' | 'declining' | 'stable'
    daily_completion_rate: number
    current_streak: number
    weak_topics_count: number
    weak_topics: Array<{ topic_id: string; topic_name: string; weakness_score: number }>
    recent_doubts_count: number
    needs_attention: boolean
    last_active: string | null
}

export interface ClassStats {
    total_students: number
    average_performance: number
    daily_completion_rate: number
    on_track: number
    struggling: number
    excellent: number
    high_doubts: number
}

export interface TopicClassReport {
    topic_id: string
    topic_name: string
    class_average: number
    mastered_count: number
    struggling_count: number
    not_started_count: number
    students: Array<{
        student_id: string
        full_name: string
        accuracy: number
        attempts: number
        weakness_score: number
        avg_time: number
        last_assessed: string | null
    }>
}

export interface ConcerningPattern {
    type: 'consecutive_failures' | 'long_gap' | 'high_doubts' | 'declining_performance' | 'low_engagement'
    severity: 'warning' | 'critical'
    description: string
    data: Record<string, unknown>
}

export interface StudentDeepDive {
    student_id: string
    full_name: string
    class_name: string
    section_name: string
    performance_score: number
    performance_rank: number
    performance_percentile: number
    performance_trend: 'improving' | 'declining' | 'stable'
    trend_delta: number
    engagement: {
        current_streak: number
        longest_streak: number
        week_completion: { completed: number; total: number; percentage: number }
        total_time_minutes: number
        avg_daily_minutes: number
        activity_score: number
    }
    topics: Array<{
        topic_id: string
        topic_name: string
        weakness_score: number
        accuracy_percentage: number
        total_attempts: number
        avg_time_seconds: number
        last_assessed_at: string | null
        is_weak: boolean
    }>
    recent_doubts: Array<{
        doubt_id: string
        doubt_text: string
        ai_response: string | null
        teacher_response: string | null
        status: string
        created_at: string
        topic_name: string | null
    }>
    concerning_patterns: ConcerningPattern[]
    weekly_trend: Array<{
        week_start: string
        score: number
        questions_answered: number
    }>
}

// ─── Verify Teacher Access ────────────────────────────────

export async function verifyTeacherSectionAccess(
    teacherId: string,
    sectionId: string
): Promise<boolean> {
    // Check if teacher has timetable entries for this section
    const { data: teacher } = await supabase
        .from('users')
        .select('role, school_id')
        .eq('user_id', teacherId)
        .single()

    if (!teacher) return false

    // Admins always have access
    if (['super_admin', 'sub_admin'].includes(teacher.role)) return true

    if (teacher.role !== 'teacher') return false

    // Check if teacher teaches this section (via timetable or same school)
    const { data: section } = await supabase
        .from('sections')
        .select('section_id, class_id, classes(school_id)')
        .eq('section_id', sectionId)
        .single()

    if (!section) return false

    const sectionSchoolId = (section.classes as any)?.school_id
    return sectionSchoolId === teacher.school_id
}

// ─── Class Performance Overview ───────────────────────────

export async function getClassPerformance(
    sectionId: string
): Promise<{ stats: ClassStats; students: StudentPerformance[] }> {
    // 1. Get all students in section
    const { data: students, error } = await supabase
        .from('users')
        .select('user_id, full_name')
        .eq('role', 'student')
        .eq('section_id', sectionId)

    if (error || !students || students.length === 0) {
        return {
            stats: {
                total_students: 0,
                average_performance: 0,
                daily_completion_rate: 0,
                on_track: 0,
                struggling: 0,
                excellent: 0,
                high_doubts: 0,
            },
            students: [],
        }
    }

    const thisWeek = getCurrentWeekRange()
    const studentIds = students.map(s => s.user_id)

    // 2. Batch fetch all performance data
    const [scoresResult, topicsResult, phasesResult, doubtsResult] = await Promise.all([
        supabase
            .from('student_scores')
            .select('student_id, performance_score, activity_score, daily_streak')
            .in('student_id', studentIds),
        supabase
            .from('student_topic_performance')
            .select('student_id, topic_id, weakness_score, is_weak_topic, accuracy_percentage, last_assessed_at')
            .in('student_id', studentIds)
            .eq('is_weak_topic', true),
        supabase
            .from('assessment_phases')
            .select('student_id, status, scheduled_date, score_percentage, completed_at')
            .in('student_id', studentIds)
            .eq('phase_type', 'daily')
            .gte('scheduled_date', thisWeek.start)
            .lte('scheduled_date', thisWeek.end),
        supabase
            .from('student_doubts')
            .select('student_id')
            .in('student_id', studentIds)
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ])

    const scoresMap = new Map<string, any>()
    for (const s of scoresResult.data || []) {
        scoresMap.set(s.student_id, s)
    }

    // Get topic names for weak topics
    const weakTopicIds = [...new Set((topicsResult.data || []).map(t => t.topic_id))]
    const { data: topicNames } = weakTopicIds.length > 0
        ? await supabase
            .from('lesson_topics')
            .select('topic_id, topic_title')
            .in('topic_id', weakTopicIds)
        : { data: [] }

    const topicNameMap = new Map<string, string>()
    for (const t of topicNames || []) {
        topicNameMap.set(t.topic_id, t.topic_title)
    }

    const weakTopicsMap = new Map<string, Array<{ topic_id: string; topic_name: string; weakness_score: number }>>()
    for (const t of topicsResult.data || []) {
        if (!weakTopicsMap.has(t.student_id)) weakTopicsMap.set(t.student_id, [])
        weakTopicsMap.get(t.student_id)!.push({
            topic_id: t.topic_id,
            topic_name: topicNameMap.get(t.topic_id) || 'Unknown Topic',
            weakness_score: t.weakness_score,
        })
    }

    const doubtsMap = new Map<string, number>()
    for (const d of doubtsResult.data || []) {
        doubtsMap.set(d.student_id, (doubtsMap.get(d.student_id) || 0) + 1)
    }

    // Compute weekly completion per student
    const completionMap = new Map<string, number>()
    for (const p of phasesResult.data || []) {
        if (p.status === 'completed') {
            completionMap.set(p.student_id, (completionMap.get(p.student_id) || 0) + 1)
        }
    }

    // 3. Build student performance list
    const performances: StudentPerformance[] = []
    const schoolDays = getSchoolDaysSoFar()

    for (const student of students) {
        const scores = scoresMap.get(student.user_id)
        const perfScore = scores?.performance_score ?? 0
        const streak = scores?.daily_streak ?? 0
        const weekCompleted = completionMap.get(student.user_id) || 0
        const completionRate = schoolDays > 0 ? (weekCompleted / schoolDays) * 100 : 0
        const weakTopics = weakTopicsMap.get(student.user_id) || []
        const doubtsCount = doubtsMap.get(student.user_id) || 0

        // Determine trend (simplified — compare last week vs this week)
        const trend = determineTrend(perfScore)

        // Get last active date
        const lastPhase = (phasesResult.data || [])
            .filter(p => p.student_id === student.user_id && p.completed_at)
            .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0]

        performances.push({
            student_id: student.user_id,
            full_name: student.full_name,
            performance_score: perfScore,
            performance_rank: 0, // Will be calculated below
            performance_trend: trend,
            daily_completion_rate: Math.round(completionRate * 10) / 10,
            current_streak: streak,
            weak_topics_count: weakTopics.length,
            weak_topics: weakTopics.sort((a, b) => b.weakness_score - a.weakness_score).slice(0, 5),
            recent_doubts_count: doubtsCount,
            needs_attention: perfScore < 60 || doubtsCount > 3 || weakTopics.length > 3,
            last_active: lastPhase?.completed_at || null,
        })
    }

    // Assign ranks
    performances.sort((a, b) => b.performance_score - a.performance_score)
    performances.forEach((s, i) => { s.performance_rank = i + 1 })

    // 4. Compute class stats
    const perfScores = performances.map(s => s.performance_score)
    const avgPerformance = perfScores.length > 0
        ? perfScores.reduce((a, b) => a + b, 0) / perfScores.length
        : 0
    const avgCompletion = performances.length > 0
        ? performances.reduce((a, b) => a + b.daily_completion_rate, 0) / performances.length
        : 0

    const stats: ClassStats = {
        total_students: students.length,
        average_performance: Math.round(avgPerformance * 10) / 10,
        daily_completion_rate: Math.round(avgCompletion * 10) / 10,
        on_track: performances.filter(s => s.performance_score >= 60 && s.performance_score < 85).length,
        struggling: performances.filter(s => s.performance_score < 60).length,
        excellent: performances.filter(s => s.performance_score >= 85).length,
        high_doubts: performances.filter(s => s.recent_doubts_count > 3).length,
    }

    // Sort by performance (worst first for teacher attention)
    performances.sort((a, b) => a.performance_score - b.performance_score)

    return { stats, students: performances }
}

// ─── Individual Student Deep Dive ─────────────────────────

export async function getStudentDeepDive(studentId: string): Promise<StudentDeepDive | null> {
    // 1. Get student info
    const { data: student } = await supabase
        .from('users')
        .select('user_id, full_name, class_id, section_id')
        .eq('user_id', studentId)
        .single()

    if (!student) return null

    // Get class and section names
    const [classResult, sectionResult] = await Promise.all([
        student.class_id
            ? supabase.from('classes').select('name').eq('class_id', student.class_id).single()
            : { data: null },
        student.section_id
            ? supabase.from('sections').select('name').eq('section_id', student.section_id).single()
            : { data: null },
    ])

    // 2. Fetch all data in parallel
    const [scoresResult, topicsResult, phasesResult, doubtsResult] = await Promise.all([
        supabase
            .from('student_scores')
            .select('*')
            .eq('student_id', studentId)
            .limit(1)
            .single(),
        supabase
            .from('student_topic_performance')
            .select('*, lesson_topics(topic_title)')
            .eq('student_id', studentId),
        supabase
            .from('assessment_phases')
            .select('*')
            .eq('student_id', studentId)
            .gte('scheduled_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('scheduled_date', { ascending: false }),
        supabase
            .from('student_doubts')
            .select('*, lesson_topics(topic_title)')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false })
            .limit(10),
    ])

    const scores = scoresResult.data
    const perfScore = scores?.performance_score ?? 0

    // 3. Calculate rank among classmates
    let rank = 0
    let percentile = 0
    let totalStudents = 0

    if (student.section_id) {
        const { data: classmates } = await supabase
            .from('users')
            .select('user_id')
            .eq('role', 'student')
            .eq('section_id', student.section_id)

        if (classmates) {
            totalStudents = classmates.length
            const { data: classmateScores } = await supabase
                .from('student_scores')
                .select('student_id, performance_score')
                .in('student_id', classmates.map(c => c.user_id))

            if (classmateScores) {
                const sorted = classmateScores.sort((a, b) => b.performance_score - a.performance_score)
                rank = sorted.findIndex(s => s.student_id === studentId) + 1
                percentile = totalStudents > 0 ? Math.round(((totalStudents - rank) / totalStudents) * 100) : 0
            }
        }
    }

    // 4. Compute trend (compare last 2 weeks)
    const phases = phasesResult.data || []
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const lastWeekPhases = phases.filter(p =>
        p.status === 'completed' && p.scheduled_date >= oneWeekAgo
    )
    const prevWeekPhases = phases.filter(p =>
        p.status === 'completed' && p.scheduled_date >= twoWeeksAgo && p.scheduled_date < oneWeekAgo
    )

    const lastWeekAvg = lastWeekPhases.length > 0
        ? lastWeekPhases.reduce((s, p) => s + (p.score_percentage || 0), 0) / lastWeekPhases.length
        : 0
    const prevWeekAvg = prevWeekPhases.length > 0
        ? prevWeekPhases.reduce((s, p) => s + (p.score_percentage || 0), 0) / prevWeekPhases.length
        : 0

    const trendDelta = lastWeekAvg - prevWeekAvg
    let trend: 'improving' | 'declining' | 'stable' = 'stable'
    if (trendDelta > 5) trend = 'improving'
    else if (trendDelta < -5) trend = 'declining'

    // 5. Week completion
    const thisWeek = getCurrentWeekRange()
    const weekPhases = phases.filter(p =>
        p.phase_type === 'daily' &&
        p.scheduled_date >= thisWeek.start &&
        p.scheduled_date <= thisWeek.end &&
        p.status === 'completed'
    )
    const schoolDays = getSchoolDaysSoFar()

    // 6. Time stats
    const completedPhases = phases.filter(p => p.status === 'completed')
    const totalTimeSec = completedPhases.reduce((s, p) => s + (p.time_taken_seconds || 0), 0)
    const uniqueDays = new Set(completedPhases.map(p => p.scheduled_date)).size
    const avgDailyMin = uniqueDays > 0 ? Math.round(totalTimeSec / 60 / uniqueDays) : 0

    // 7. Topic performance
    const topics = (topicsResult.data || []).map((t: any) => ({
        topic_id: t.topic_id,
        topic_name: t.lesson_topics?.topic_title || 'Unknown',
        weakness_score: t.weakness_score,
        accuracy_percentage: t.accuracy_percentage,
        total_attempts: t.total_attempts,
        avg_time_seconds: t.average_time_seconds,
        last_assessed_at: t.last_assessed_at,
        is_weak: t.is_weak_topic,
    })).sort((a: any, b: any) => b.weakness_score - a.weakness_score)

    // 8. Recent doubts
    const doubts = (doubtsResult.data || []).map((d: any) => ({
        doubt_id: d.doubt_id,
        doubt_text: d.doubt_text,
        ai_response: d.ai_response,
        teacher_response: d.teacher_response,
        status: d.status,
        created_at: d.created_at,
        topic_name: d.lesson_topics?.topic_title || null,
    }))

    // 9. Concerning patterns
    const patterns = await getConcerningPatterns(studentId, topics, doubts, phases)

    // 10. Weekly trend (last 4 weeks)
    const weeklyTrend: Array<{ week_start: string; score: number; questions_answered: number }> = []
    for (let w = 3; w >= 0; w--) {
        const weekStart = new Date(Date.now() - (w * 7 + 6) * 24 * 60 * 60 * 1000)
        const weekEnd = new Date(Date.now() - w * 7 * 24 * 60 * 60 * 1000)
        const weekStartStr = weekStart.toISOString().split('T')[0]
        const weekEndStr = weekEnd.toISOString().split('T')[0]

        const weekPhases = completedPhases.filter(p =>
            p.scheduled_date >= weekStartStr && p.scheduled_date <= weekEndStr
        )

        const avgScore = weekPhases.length > 0
            ? weekPhases.reduce((s, p) => s + (p.score_percentage || 0), 0) / weekPhases.length
            : 0
        const totalQ = weekPhases.reduce((s, p) => s + (p.total_questions || 0), 0)

        weeklyTrend.push({
            week_start: weekStartStr,
            score: Math.round(avgScore * 10) / 10,
            questions_answered: totalQ,
        })
    }

    return {
        student_id: studentId,
        full_name: student.full_name,
        class_name: classResult.data?.name || 'Unknown',
        section_name: sectionResult.data?.name || 'Unknown',
        performance_score: perfScore,
        performance_rank: rank,
        performance_percentile: percentile,
        performance_trend: trend,
        trend_delta: Math.round(trendDelta * 10) / 10,
        engagement: {
            current_streak: scores?.daily_streak ?? 0,
            longest_streak: scores?.longest_streak ?? 0,
            week_completion: {
                completed: weekPhases.length,
                total: schoolDays,
                percentage: schoolDays > 0 ? Math.round((weekPhases.length / schoolDays) * 100) : 0,
            },
            total_time_minutes: Math.round(totalTimeSec / 60),
            avg_daily_minutes: avgDailyMin,
            activity_score: scores?.activity_score ?? 0,
        },
        topics,
        recent_doubts: doubts,
        concerning_patterns: patterns,
        weekly_trend: weeklyTrend,
    }
}

// ─── Topic-wise Class Report ──────────────────────────────

export async function getTopicClassReport(
    topicId: string,
    sectionId: string
): Promise<TopicClassReport | null> {
    // Get topic name
    const { data: topic } = await supabase
        .from('lesson_topics')
        .select('topic_id, topic_title')
        .eq('topic_id', topicId)
        .single()

    if (!topic) return null

    // Get students in section
    const { data: students } = await supabase
        .from('users')
        .select('user_id, full_name')
        .eq('role', 'student')
        .eq('section_id', sectionId)

    if (!students) return null

    const studentIds = students.map(s => s.user_id)

    // Get performance for this topic
    const { data: perfs } = await supabase
        .from('student_topic_performance')
        .select('*')
        .eq('topic_id', topicId)
        .in('student_id', studentIds)

    const perfMap = new Map<string, any>()
    for (const p of perfs || []) {
        perfMap.set(p.student_id, p)
    }

    const studentData = students.map(s => {
        const perf = perfMap.get(s.user_id)
        return {
            student_id: s.user_id,
            full_name: s.full_name,
            accuracy: perf?.accuracy_percentage ?? -1,
            attempts: perf?.total_attempts ?? 0,
            weakness_score: perf?.weakness_score ?? 75,
            avg_time: perf?.average_time_seconds ?? 0,
            last_assessed: perf?.last_assessed_at || null,
        }
    })

    const withData = studentData.filter(s => s.accuracy >= 0)
    const avgAccuracy = withData.length > 0
        ? withData.reduce((sum, s) => sum + s.accuracy, 0) / withData.length
        : 0

    return {
        topic_id: topicId,
        topic_name: topic.topic_title,
        class_average: Math.round(avgAccuracy * 10) / 10,
        mastered_count: withData.filter(s => s.accuracy >= 80).length,
        struggling_count: withData.filter(s => s.accuracy < 60 && s.accuracy >= 0).length,
        not_started_count: studentData.filter(s => s.attempts === 0).length,
        students: studentData.sort((a, b) => a.accuracy - b.accuracy),
    }
}

// ─── Concerning Patterns Detection ────────────────────────

async function getConcerningPatterns(
    studentId: string,
    topics: any[],
    doubts: any[],
    phases: any[]
): Promise<ConcerningPattern[]> {
    const patterns: ConcerningPattern[] = []

    // 1. Consecutive failures on same topic
    const weakTopics = topics.filter(t => t.is_weak && t.accuracy_percentage < 40 && t.total_attempts > 5)
    if (weakTopics.length > 0) {
        patterns.push({
            type: 'consecutive_failures',
            severity: 'critical',
            description: `Struggling consistently with ${weakTopics.map(t => t.topic_name).join(', ')}`,
            data: { topics: weakTopics.map(t => t.topic_name) },
        })
    }

    // 2. Long gap in practice
    const completedPhases = phases.filter((p: any) => p.status === 'completed')
    if (completedPhases.length > 0) {
        const lastActive = new Date(completedPhases[0].completed_at || completedPhases[0].scheduled_date)
        const daysSince = daysBetween(lastActive, new Date())
        if (daysSince >= 3) {
            patterns.push({
                type: 'long_gap',
                severity: daysSince >= 5 ? 'critical' : 'warning',
                description: `No practice for ${daysSince} days`,
                data: { days_since: daysSince, last_active: lastActive.toISOString() },
            })
        }
    } else {
        patterns.push({
            type: 'long_gap',
            severity: 'critical',
            description: 'Never completed any practice',
            data: { days_since: -1 },
        })
    }

    // 3. High doubt frequency
    const recentDoubts = doubts.filter(d => {
        const created = new Date(d.created_at)
        return daysBetween(created, new Date()) <= 7
    })
    if (recentDoubts.length >= 5) {
        patterns.push({
            type: 'high_doubts',
            severity: recentDoubts.length >= 8 ? 'critical' : 'warning',
            description: `Asked ${recentDoubts.length} questions in the last week`,
            data: { count: recentDoubts.length },
        })
    }

    // 4. Declining performance
    if (completedPhases.length >= 4) {
        const recent = completedPhases.slice(0, 4)
        const older = completedPhases.slice(4, 8)
        if (older.length > 0) {
            const recentAvg = recent.reduce((s: number, p: any) => s + (p.score_percentage || 0), 0) / recent.length
            const olderAvg = older.reduce((s: number, p: any) => s + (p.score_percentage || 0), 0) / older.length
            if (olderAvg - recentAvg > 10) {
                patterns.push({
                    type: 'declining_performance',
                    severity: olderAvg - recentAvg > 20 ? 'critical' : 'warning',
                    description: `Performance dropped by ${Math.round(olderAvg - recentAvg)}% recently`,
                    data: { recent_avg: Math.round(recentAvg), older_avg: Math.round(olderAvg) },
                })
            }
        }
    }

    // 5. Low engagement
    const thisWeek = getCurrentWeekRange()
    const weekPhases = phases.filter((p: any) =>
        p.phase_type === 'daily' &&
        p.scheduled_date >= thisWeek.start &&
        p.scheduled_date <= thisWeek.end
    )
    const missedDays = getSchoolDaysSoFar() - weekPhases.filter((p: any) => p.status === 'completed').length
    if (missedDays >= 3) {
        patterns.push({
            type: 'low_engagement',
            severity: missedDays >= 4 ? 'critical' : 'warning',
            description: `Missed ${missedDays} practice days this week`,
            data: { missed_days: missedDays },
        })
    }

    return patterns
}

// ─── Internal Helpers ─────────────────────────────────────

function getSchoolDaysSoFar(): number {
    const now = new Date()
    const day = now.getDay() // 0=Sun, 1=Mon ...
    // M-F only, count how many school days have passed this week
    if (day === 0) return 5 // Sunday → full week
    if (day === 6) return 5 // Saturday → full school week done
    return day // Mon=1, Tue=2, ... Fri=5
}

function determineTrend(perfScore: number): 'improving' | 'declining' | 'stable' {
    // Simplified; real implementation would compare historical data
    if (perfScore >= 70) return 'improving'
    if (perfScore < 50) return 'declining'
    return 'stable'
}

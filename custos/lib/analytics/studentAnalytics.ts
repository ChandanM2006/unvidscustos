/**
 * CUSTOS Brain – Student Analytics Helper Functions
 *
 * Pure analytics functions used by the analytics API route.
 * Computes activity metrics, topic breakdowns, time stats, etc.
 */

import { createClient } from '@supabase/supabase-js'
import { getCurrentStreak, getCurrentWeekRange, daysBetween } from '@/lib/analytics/helpers'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Week Completion ──────────────────────────────────────

export async function getWeekCompletion(studentId: string): Promise<{
    completed_days: number
    total_days: number
    percentage: number
}> {
    const thisWeek = getCurrentWeekRange()

    const { data: completed } = await supabase
        .from('assessment_phases')
        .select('scheduled_date')
        .eq('student_id', studentId)
        .eq('phase_type', 'daily')
        .eq('status', 'completed')
        .gte('scheduled_date', thisWeek.start)
        .lte('scheduled_date', thisWeek.end)

    // School days this week (Mon-Fri = 5, unless today is earlier)
    const now = new Date()
    const today = now.getDay() // 0=Sun, 6=Sat
    const schoolDays = today === 0 ? 5 : today === 6 ? 5 : Math.min(today, 5)

    const completedCount = completed?.length || 0
    return {
        completed_days: completedCount,
        total_days: schoolDays,
        percentage: schoolDays > 0 ? Math.round((completedCount / schoolDays) * 100) : 0,
    }
}

// ─── Topic Activity Breakdown ─────────────────────────────

export interface TopicActivity {
    topic_id: string
    topic_name: string
    activity_percentage: number
    last_practiced: string | null
    total_attempts: number
    accuracy_percentage: number
    days_since_practice: number
}

export async function getTopicActivityBreakdown(studentId: string): Promise<TopicActivity[]> {
    const { data } = await supabase
        .from('student_topic_performance')
        .select('*, lesson_topics(topic_name)')
        .eq('student_id', studentId)

    if (!data || data.length === 0) return []

    return data.map((perf: any) => {
        const daysSince = perf.last_assessed_at
            ? daysBetween(new Date(perf.last_assessed_at), new Date())
            : 999

        const activityPercentage = calculateActivityPercentage(perf, daysSince)

        return {
            topic_id: perf.topic_id,
            topic_name: perf.lesson_topics?.topic_name || 'Unknown Topic',
            activity_percentage: activityPercentage,
            last_practiced: perf.last_assessed_at,
            total_attempts: perf.total_attempts || 0,
            accuracy_percentage: perf.accuracy_percentage || 0,
            days_since_practice: daysSince,
        }
    }).sort((a: TopicActivity, b: TopicActivity) => b.activity_percentage - a.activity_percentage)
}

function calculateActivityPercentage(perf: any, daysSince: number): number {
    // Activity = engagement / recency, NOT accuracy
    const recencyScore = Math.max(0, 100 - (daysSince * 5)) // Lose 5% per day
    const attemptScore = Math.min((perf.total_attempts || 0) * 10, 100) // 10% per attempt, max 100
    return Math.round((recencyScore + attemptScore) / 2)
}

// ─── Last 30 Days Activity ────────────────────────────────

export interface DailyActivity {
    date: string
    activity_percentage: number
    minutes_spent: number
    questions_answered: number
}

export async function getLast30DaysActivity(studentId: string): Promise<DailyActivity[]> {
    // Get all phases from last 30 days in a single query
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
    const startDate = thirtyDaysAgo.toISOString().split('T')[0]

    const { data: phases } = await supabase
        .from('assessment_phases')
        .select('scheduled_date, time_taken_seconds, total_questions, status, phase_type')
        .eq('student_id', studentId)
        .gte('scheduled_date', startDate)
        .order('scheduled_date', { ascending: true })

    // Build a map of date → stats
    const dateMap: Record<string, { minutes: number; questions: number; completed: boolean }> = {}

    for (const phase of (phases || [])) {
        const key = phase.scheduled_date
        if (!dateMap[key]) {
            dateMap[key] = { minutes: 0, questions: 0, completed: false }
        }
        if (phase.status === 'completed') {
            dateMap[key].completed = true
            dateMap[key].minutes += (phase.time_taken_seconds || 0) / 60
            dateMap[key].questions += phase.total_questions || 0
        }
    }

    // Build 30-day array
    const results: DailyActivity[] = []
    for (let i = 0; i < 30; i++) {
        const d = new Date()
        d.setDate(d.getDate() - (29 - i))
        const dateStr = d.toISOString().split('T')[0]
        const stats = dateMap[dateStr]

        results.push({
            date: dateStr,
            activity_percentage: stats?.completed ? 100 : 0,
            minutes_spent: Math.round((stats?.minutes || 0) * 10) / 10,
            questions_answered: stats?.questions || 0,
        })
    }

    return results
}

// ─── Activity Score ───────────────────────────────────────

export async function getActivityScore(studentId: string): Promise<{
    score: number
    level: number
    next_level_points: number
}> {
    const { data } = await supabase
        .from('student_scores')
        .select('activity_score')
        .eq('student_id', studentId)
        .single()

    const score = data?.activity_score || 0
    // Levels: every 100 points
    const level = Math.floor(score / 100) + 1
    const nextLevelPoints = level * 100

    return { score, level, next_level_points: nextLevelPoints }
}

// ─── Time Stats ───────────────────────────────────────────

export async function getTimeSpentStats(studentId: string): Promise<{
    total_minutes_month: number
    avg_daily_minutes: number
    total_questions_month: number
}> {
    const monthStart = new Date()
    monthStart.setDate(1)
    const monthStartStr = monthStart.toISOString().split('T')[0]

    const { data } = await supabase
        .from('assessment_phases')
        .select('time_taken_seconds, total_questions')
        .eq('student_id', studentId)
        .eq('status', 'completed')
        .gte('scheduled_date', monthStartStr)

    const totalSeconds = data?.reduce((sum, p) => sum + (p.time_taken_seconds || 0), 0) || 0
    const totalQuestions = data?.reduce((sum, p) => sum + (p.total_questions || 0), 0) || 0
    const totalMinutes = Math.round(totalSeconds / 60)
    const dayOfMonth = new Date().getDate()
    const avgDaily = Math.round(totalMinutes / dayOfMonth)

    return {
        total_minutes_month: totalMinutes,
        avg_daily_minutes: avgDaily,
        total_questions_month: totalQuestions,
    }
}

// ─── Earned Achievements ──────────────────────────────────

export async function getEarnedAchievements(studentId: string): Promise<Array<{
    achievement_id: string
    name: string
    description: string | null
    icon: string | null
    category: string | null
    points_awarded: number
    earned_at: string
}>> {
    const { data } = await supabase
        .from('student_achievements')
        .select('earned_at, achievement_id, achievements(name, description, icon, category, points_awarded)')
        .eq('student_id', studentId)
        .order('earned_at', { ascending: false })

    if (!data) return []

    return data.map((sa: any) => ({
        achievement_id: sa.achievement_id,
        name: sa.achievements?.name || 'Achievement',
        description: sa.achievements?.description || null,
        icon: sa.achievements?.icon || '🏆',
        category: sa.achievements?.category || null,
        points_awarded: sa.achievements?.points_awarded || 0,
        earned_at: sa.earned_at,
    }))
}

/**
 * CUSTOS Brain: Student Analytics API
 *
 * GET /api/student/analytics?studentId=...
 *     → Returns comprehensive analytics data for the student dashboard
 *     → Includes: week completion, streak, activity score, topic breakdown,
 *       30-day trend, achievements, time stats
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentStreak } from '@/lib/analytics/helpers'
import {
    getWeekCompletion,
    getActivityScore,
    getTopicActivityBreakdown,
    getLast30DaysActivity,
    getEarnedAchievements,
    getTimeSpentStats,
} from '@/lib/analytics/studentAnalytics'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const studentId = searchParams.get('studentId')

        if (!studentId) {
            return NextResponse.json({ error: 'studentId required' }, { status: 400 })
        }

        // Fetch all analytics in parallel for performance
        const [
            weekCompletion,
            currentStreak,
            activityScore,
            topicBreakdown,
            last30DaysData,
            achievements,
            timeStats
        ] = await Promise.all([
            getWeekCompletion(studentId),
            getCurrentStreak(studentId),
            getActivityScore(studentId),
            getTopicActivityBreakdown(studentId),
            getLast30DaysActivity(studentId),
            getEarnedAchievements(studentId),
            getTimeSpentStats(studentId),
        ])

        return NextResponse.json({
            week: weekCompletion,
            streak: currentStreak,
            activity_score: activityScore,
            topics: {
                strong: topicBreakdown.filter(t => t.activity_percentage >= 80),
                need_practice: topicBreakdown.filter(t => t.activity_percentage < 70),
                all: topicBreakdown,
            },
            trend: last30DaysData,
            achievements,
            time: timeStats,
        })
    } catch (err: any) {
        console.error('[Analytics API] Error:', err)
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
    }
}

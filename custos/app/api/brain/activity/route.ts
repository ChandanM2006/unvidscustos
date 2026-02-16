/**
 * CUSTOS Brain Activity API
 *
 * GET /api/brain/activity?studentId=...
 *     → Returns student's VISIBLE activity data (score, streak, badges)
 *     → This is the SAFE endpoint – never returns performance scores
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentStreak } from '@/lib/analytics/helpers'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const studentId = searchParams.get('studentId')

        if (!studentId) {
            return NextResponse.json({ error: 'studentId required' }, { status: 400 })
        }

        // Fetch activity data ONLY (no performance scores)
        const { data: scores } = await supabase
            .from('student_scores')
            .select('activity_score, daily_streak, longest_streak, weekly_completions, total_attempts, badges_earned')
            .eq('student_id', studentId)
            .limit(1)
            .single()

        // Get live streak
        const streak = await getCurrentStreak(studentId)

        // Get today's practice status
        const today = new Date().toISOString().split('T')[0]
        const { data: todayPhase } = await supabase
            .from('assessment_phases')
            .select('phase_id, status, score_percentage, phase_type')
            .eq('student_id', studentId)
            .eq('scheduled_date', today)
            .eq('phase_type', 'daily')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        // Get earned achievements
        const { data: achievements } = await supabase
            .from('student_achievements')
            .select('earned_at, achievements(name, description, icon, category, points_awarded)')
            .eq('student_id', studentId)
            .order('earned_at', { ascending: false })

        // Get recent completed phases (last 7 days)
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)

        const { data: recentPhases } = await supabase
            .from('assessment_phases')
            .select('phase_type, scheduled_date, status, score_percentage, correct_answers, total_questions')
            .eq('student_id', studentId)
            .gte('scheduled_date', weekAgo.toISOString().split('T')[0])
            .order('scheduled_date', { ascending: false })

        return NextResponse.json({
            activityScore: scores?.activity_score || 0,
            dailyStreak: streak,
            longestStreak: scores?.longest_streak || 0,
            weeklyCompletions: scores?.weekly_completions || 0,
            totalAttempts: scores?.total_attempts || 0,
            badges: scores?.badges_earned || [],
            todayPractice: todayPhase || null,
            achievements: achievements || [],
            recentHistory: recentPhases || [],
        })
    } catch (err) {
        console.error('[Brain API] activity error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

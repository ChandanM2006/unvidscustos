/**
 * CUSTOS Brain – Helper Utilities
 *
 * Pure functions and lightweight Supabase queries used by brainEngine.ts.
 * No heavy business logic here – just reusable building blocks.
 */

import { supabase } from '@/lib/supabase'
import type { TopicWeakness, Achievement } from '@/lib/types/brain'

// ─── Time Expectations ───────────────────────────────────

/**
 * Returns the expected answer time (seconds) for a question
 * based on its difficulty level.
 *
 * Used by the weakness algorithm's "time efficiency" component.
 */
export function getExpectedTime(difficulty: string): number {
    switch (difficulty) {
        case 'easy':
            return 15
        case 'medium':
            return 25
        case 'hard':
            return 40
        default:
            return 25 // default to medium
    }
}

/**
 * Returns a reasonable expected time for an entire topic
 * (average across difficulties). Used when we don't know
 * per-question difficulty.
 */
export function getTopicExpectedTime(): number {
    return 25 // seconds – tuneable constant
}

// ─── Weighted Sampling ───────────────────────────────────

/**
 * Samples `count` items from `items`, weighted by a numeric field.
 * Higher weight = more likely to be selected.
 *
 * Uses a simple weighted-random approach:
 *   1. Calculate cumulative weights
 *   2. For each pick, generate random in [0, totalWeight)
 *   3. Binary-search the cumulative array
 *   4. Remove picked item to avoid duplicates
 *
 * @param items  - Array of objects
 * @param count  - Number of items to pick (clamped to items.length)
 * @param weightFn - Function that returns the weight for an item
 */
export function sampleWeighted<T>(
    items: T[],
    count: number,
    weightFn: (item: T) => number
): T[] {
    if (items.length === 0) return []
    const n = Math.min(count, items.length)

    // Clone so we can remove picked items
    const pool = [...items]
    const picked: T[] = []

    for (let i = 0; i < n; i++) {
        const totalWeight = pool.reduce((sum, item) => sum + Math.max(weightFn(item), 0.1), 0)
        let r = Math.random() * totalWeight
        let idx = 0

        for (let j = 0; j < pool.length; j++) {
            r -= Math.max(weightFn(pool[j]), 0.1)
            if (r <= 0) {
                idx = j
                break
            }
        }

        picked.push(pool[idx])
        pool.splice(idx, 1)
    }

    return picked
}

/**
 * Simple random sample without replacement.
 */
export function sampleRandom<T>(items: T[], count: number): T[] {
    if (items.length === 0) return []
    const n = Math.min(count, items.length)
    const pool = [...items]
    const picked: T[] = []

    for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.random() * pool.length)
        picked.push(pool[idx])
        pool.splice(idx, 1)
    }

    return picked
}

/**
 * Fisher-Yates shuffle – returns a new array.
 */
export function shuffle<T>(arr: T[]): T[] {
    const out = [...arr]
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
            ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
}

// ─── Streak & Completion Checks ──────────────────────────

/**
 * Returns true if the student has completed today's daily practice.
 */
export async function hasCompletedDailyPractice(
    studentId: string,
    date: Date = new Date()
): Promise<boolean> {
    try {
        const dateStr = date.toISOString().split('T')[0]

        const { data, error } = await supabase
            .from('assessment_phases')
            .select('phase_id')
            .eq('student_id', studentId)
            .eq('phase_type', 'daily')
            .eq('scheduled_date', dateStr)
            .eq('status', 'completed')
            .limit(1)

        if (error) {
            console.error('[Brain] hasCompletedDailyPractice error:', error)
            return false
        }

        return (data?.length ?? 0) > 0
    } catch (err) {
        console.error('[Brain] hasCompletedDailyPractice exception:', err)
        return false
    }
}

/**
 * Calculates the student's current daily streak by walking backwards
 * from yesterday (today may not be completed yet).
 */
export async function getCurrentStreak(studentId: string): Promise<number> {
    try {
        // Get all completed daily phases, ordered descending
        const { data, error } = await supabase
            .from('assessment_phases')
            .select('scheduled_date')
            .eq('student_id', studentId)
            .eq('phase_type', 'daily')
            .eq('status', 'completed')
            .order('scheduled_date', { ascending: false })
            .limit(60) // look back at most 60 days

        if (error || !data || data.length === 0) return 0

        let streak = 0
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Start checking from today or yesterday
        const firstCompleted = new Date(data[0].scheduled_date)
        firstCompleted.setHours(0, 0, 0, 0)

        const diffFromToday = Math.floor(
            (today.getTime() - firstCompleted.getTime()) / (1000 * 60 * 60 * 24)
        )

        // If most recent completion is > 1 day ago, streak is broken
        if (diffFromToday > 1) return 0

        // Walk backwards through completed dates
        const completedSet = new Set(data.map((d) => d.scheduled_date))
        const checkDate = new Date(firstCompleted)

        while (true) {
            const dateStr = checkDate.toISOString().split('T')[0]
            if (completedSet.has(dateStr)) {
                streak++
                checkDate.setDate(checkDate.getDate() - 1)
            } else {
                break
            }
        }

        return streak
    } catch (err) {
        console.error('[Brain] getCurrentStreak exception:', err)
        return 0
    }
}

// ─── Achievement Evaluation ──────────────────────────────

/**
 * Checks all active achievements against the student's current stats
 * and awards any newly earned ones.
 *
 * @returns Array of achievement_ids that were NEWLY awarded this call.
 */
export async function checkAndAwardAchievements(
    studentId: string
): Promise<string[]> {
    try {
        // 1. Fetch all active achievements
        const { data: achievements, error: achErr } = await supabase
            .from('achievements')
            .select('*')
            .eq('is_active', true)

        if (achErr || !achievements) {
            console.error('[Brain] checkAndAwardAchievements fetch error:', achErr)
            return []
        }

        // 2. Fetch already-earned achievement IDs
        const { data: earned, error: earnedErr } = await supabase
            .from('student_achievements')
            .select('achievement_id')
            .eq('student_id', studentId)

        if (earnedErr) {
            console.error('[Brain] fetch earned error:', earnedErr)
            return []
        }

        const earnedIds = new Set((earned ?? []).map((e) => e.achievement_id))

        // 3. Fetch student stats
        const streak = await getCurrentStreak(studentId)

        const { data: scores } = await supabase
            .from('student_scores')
            .select('daily_streak, total_attempts, activity_score')
            .eq('student_id', studentId)
            .limit(1)
            .single()

        const { count: dailyCompletions } = await supabase
            .from('assessment_phases')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', studentId)
            .eq('phase_type', 'daily')
            .eq('status', 'completed')

        const { count: doubtsAsked } = await supabase
            .from('student_doubts')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', studentId)

        // 4. Evaluate each unearned achievement
        const newlyEarned: string[] = []

        for (const ach of achievements as Achievement[]) {
            if (earnedIds.has(ach.achievement_id)) continue

            const criteria = ach.criteria as Record<string, unknown>
            let met = false

            // Streak-based
            if (criteria.streak_days && typeof criteria.streak_days === 'number') {
                met = streak >= criteria.streak_days
            }

            // Daily completions
            if (criteria.daily_completions && typeof criteria.daily_completions === 'number') {
                met = (dailyCompletions ?? 0) >= criteria.daily_completions
            }

            // Doubts asked
            if (criteria.doubts_asked && typeof criteria.doubts_asked === 'number') {
                met = (doubtsAsked ?? 0) >= criteria.doubts_asked
            }

            // Weak-to-strong improvement
            if (criteria.weak_to_strong === true) {
                const { count: improvedCount } = await supabase
                    .from('student_topic_performance')
                    .select('*', { count: 'exact', head: true })
                    .eq('student_id', studentId)
                    .eq('is_weak_topic', false)
                    .gt('total_attempts', 5)

                met = (improvedCount ?? 0) >= 1
            }

            // Note: accuracy-based achievements are checked in brainEngine's
            // updateTopicPerformance when a phase completes.

            if (met) {
                const { error: insertErr } = await supabase
                    .from('student_achievements')
                    .insert({
                        student_id: studentId,
                        achievement_id: ach.achievement_id,
                    })

                if (!insertErr) {
                    newlyEarned.push(ach.achievement_id)

                    // Award points to activity_score
                    if (ach.points_awarded > 0) {
                        await supabase.rpc('increment_activity_score', {
                            p_student_id: studentId,
                            p_points: ach.points_awarded,
                        }).then(({ error }) => {
                            // If the RPC doesn't exist yet, fall back to manual update
                            if (error) {
                                supabase
                                    .from('student_scores')
                                    .update({
                                        activity_score: (scores?.activity_score ?? 0) + ach.points_awarded,
                                    })
                                    .eq('student_id', studentId)
                            }
                        })
                    }
                }
            }
        }

        return newlyEarned
    } catch (err) {
        console.error('[Brain] checkAndAwardAchievements exception:', err)
        return []
    }
}

// ─── Date Utilities ──────────────────────────────────────

/**
 * Returns today's date as YYYY-MM-DD string in UTC.
 */
export function todayUTC(): string {
    return new Date().toISOString().split('T')[0]
}

/**
 * Returns the number of full days between two dates.
 */
export function daysBetween(a: Date, b: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24
    return Math.floor(Math.abs(b.getTime() - a.getTime()) / msPerDay)
}

/**
 * Returns start and end dates for the current week (Mon–Sun).
 */
export function getCurrentWeekRange(): { start: string; end: string } {
    const now = new Date()
    const day = now.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day

    const monday = new Date(now)
    monday.setDate(now.getDate() + diffToMonday)
    monday.setHours(0, 0, 0, 0)

    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    return {
        start: monday.toISOString().split('T')[0],
        end: sunday.toISOString().split('T')[0],
    }
}


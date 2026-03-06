/**
 * CUSTOS Brain: Daily Work MCQ Submission API
 *
 * POST /api/brain/work/daily/submit
 *   → Student submits answer to a single MCQ question
 *   → Auto-grades, updates response, returns correct/wrong
 *
 * PUT  /api/brain/work/daily/submit
 *   → Complete the MCQ session (marks as done, updates student_topic_performance)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

// ─── POST: Submit single MCQ answer ──────────────────────

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            work_id,
            student_id,
            question_id,
            student_answer,
            time_taken_seconds,
        } = body

        if (!work_id || !student_id || !question_id || !student_answer) {
            return NextResponse.json(
                { error: 'work_id, student_id, question_id, and student_answer are required' },
                { status: 400 }
            )
        }

        // 1. Get the daily work to find the question and correct answer
        const { data: work } = await supabase
            .from('brain_daily_work')
            .select('work_id, mcq_questions, status')
            .eq('work_id', work_id)
            .single()

        if (!work || work.status !== 'published') {
            return NextResponse.json(
                { error: 'Daily work not found or not published' },
                { status: 404 }
            )
        }

        // Find the question
        const questions = work.mcq_questions as any[]
        const question = questions.find(q => q.question_id === question_id)
        if (!question) {
            return NextResponse.json({ error: 'Question not found' }, { status: 404 })
        }

        // Auto-grade
        const isCorrect = student_answer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase()

        // 2. Get or create student response
        let { data: response } = await supabase
            .from('brain_daily_responses')
            .select('*')
            .eq('work_id', work_id)
            .eq('student_id', student_id)
            .single()

        if (!response) {
            // Create new response
            const { data: newResp } = await supabase
                .from('brain_daily_responses')
                .insert({
                    work_id,
                    student_id,
                    mcq_total: questions.length,
                    mcq_started_at: new Date().toISOString(),
                    mcq_answers: [],
                })
                .select()
                .single()
            response = newResp
        } else if (!response.mcq_started_at) {
            // Mark start time
            await supabase
                .from('brain_daily_responses')
                .update({ mcq_started_at: new Date().toISOString() })
                .eq('response_id', response.response_id)
        }

        if (!response) {
            return NextResponse.json({ error: 'Failed to create response' }, { status: 500 })
        }

        // Check if already answered this question
        const existingAnswers = (response.mcq_answers || []) as any[]
        const alreadyAnswered = existingAnswers.find((a: any) => a.question_id === question_id)
        if (alreadyAnswered) {
            return NextResponse.json(
                {
                    already_answered: true,
                    is_correct: alreadyAnswered.is_correct,
                    correct_answer: question.correct_answer,
                    explanation: question.explanation,
                },
                { status: 200 }
            )
        }

        // Add answer
        const newAnswer = {
            question_id,
            student_answer: student_answer.trim(),
            is_correct: isCorrect,
            time_taken_seconds: time_taken_seconds || 0,
            answered_at: new Date().toISOString(),
            topic_id: question.topic_id || null,
            difficulty: question.difficulty || null,
            type: question.type || null,
        }

        const updatedAnswers = [...existingAnswers, newAnswer]
        const correctCount = updatedAnswers.filter((a: any) => a.is_correct).length

        await supabase
            .from('brain_daily_responses')
            .update({
                mcq_answers: updatedAnswers,
                mcq_score: correctCount,
            })
            .eq('response_id', response.response_id)

        return NextResponse.json({
            is_correct: isCorrect,
            correct_answer: question.correct_answer,
            explanation: question.explanation || '',
            progress: {
                answered: updatedAnswers.length,
                total: questions.length,
                correct: correctCount,
                score_percentage: Math.round((correctCount / questions.length) * 100),
            },
        })
    } catch (err: any) {
        console.error('[Brain Daily Submit] POST error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// ─── PUT: Complete MCQ session ───────────────────────────

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { work_id, student_id, total_time_seconds } = body

        if (!work_id || !student_id) {
            return NextResponse.json(
                { error: 'work_id and student_id are required' },
                { status: 400 }
            )
        }

        // 1. Get student response
        const { data: response } = await supabase
            .from('brain_daily_responses')
            .select('*')
            .eq('work_id', work_id)
            .eq('student_id', student_id)
            .single()

        if (!response) {
            return NextResponse.json({ error: 'No response found' }, { status: 404 })
        }

        if (response.mcq_completed) {
            return NextResponse.json({ error: 'Already completed' }, { status: 409 })
        }

        const answers = (response.mcq_answers || []) as any[]
        const correctCount = answers.filter((a: any) => a.is_correct).length
        const totalQuestions = response.mcq_total || answers.length
        const scorePercentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0

        // 2. Mark as completed
        await supabase
            .from('brain_daily_responses')
            .update({
                mcq_completed: true,
                mcq_completed_at: new Date().toISOString(),
                mcq_score: correctCount,
                mcq_time_seconds: total_time_seconds || 0,
            })
            .eq('response_id', response.response_id)

        // 3. Update student_topic_performance for each question answered
        // Group answers by topic_id
        const topicResults = new Map<string, { correct: number; total: number; totalTime: number }>()
        for (const a of answers) {
            const tid = a.topic_id || 'unknown'
            const existing = topicResults.get(tid) || { correct: 0, total: 0, totalTime: 0 }
            existing.total++
            if (a.is_correct) existing.correct++
            existing.totalTime += (a.time_taken_seconds || 0)
            topicResults.set(tid, existing)
        }

        // Update student_topic_performance for each topic
        for (const [topicId, results] of topicResults.entries()) {
            if (topicId === 'unknown') continue

            const accuracy = (results.correct / results.total) * 100
            const avgTime = results.totalTime / results.total

            // Get existing performance
            const { data: existing } = await supabase
                .from('student_topic_performance')
                .select('*')
                .eq('student_id', student_id)
                .eq('topic_id', topicId)
                .single()

            if (existing) {
                // Update with weighted average
                const newTotal = existing.total_attempts + results.total
                const newCorrect = existing.correct_answers + results.correct
                const newAccuracy = (newCorrect / newTotal) * 100
                const newAvgTime = ((existing.average_time_seconds || 0) * existing.total_attempts + results.totalTime) / newTotal

                // Recalculate weakness score
                // weakness = 100 - accuracy (capped 0-100)
                const weaknessScore = Math.max(0, Math.min(100, 100 - newAccuracy))

                await supabase
                    .from('student_topic_performance')
                    .update({
                        total_attempts: newTotal,
                        correct_answers: newCorrect,
                        accuracy_percentage: Math.round(newAccuracy * 10) / 10,
                        average_time_seconds: Math.round(newAvgTime),
                        weakness_score: Math.round(weaknessScore * 10) / 10,
                        is_weak_topic: weaknessScore >= 40,
                        last_assessed_at: new Date().toISOString(),
                    })
                    .eq('performance_id', existing.performance_id)
            } else {
                // Create new performance record
                const weaknessScore = Math.max(0, Math.min(100, 100 - accuracy))

                await supabase
                    .from('student_topic_performance')
                    .insert({
                        student_id,
                        topic_id: topicId,
                        total_attempts: results.total,
                        correct_answers: results.correct,
                        accuracy_percentage: Math.round(accuracy * 10) / 10,
                        average_time_seconds: Math.round(avgTime),
                        weakness_score: Math.round(weaknessScore * 10) / 10,
                        is_weak_topic: weaknessScore >= 40,
                        last_assessed_at: new Date().toISOString(),
                    })
            }
        }

        // 4. Update student_scores (activity score, streak)
        const { data: existingScore } = await supabase
            .from('student_scores')
            .select('*')
            .eq('student_id', student_id)
            .single()

        if (existingScore) {
            // Update existing scores
            const newPerfScore = calculateUpdatedPerformance(existingScore.performance_score, scorePercentage)
            const newActivityScore = (existingScore.activity_score || 0) + calculateActivityPoints(scorePercentage, answers.length)

            await supabase
                .from('student_scores')
                .update({
                    performance_score: newPerfScore,
                    activity_score: newActivityScore,
                    daily_streak: (existingScore.daily_streak || 0) + 1,
                    longest_streak: Math.max(existingScore.longest_streak || 0, (existingScore.daily_streak || 0) + 1),
                    last_practice_date: new Date().toISOString().split('T')[0],
                })
                .eq('student_id', student_id)
        } else {
            // Create new score record
            await supabase
                .from('student_scores')
                .insert({
                    student_id,
                    performance_score: scorePercentage,
                    activity_score: calculateActivityPoints(scorePercentage, answers.length),
                    daily_streak: 1,
                    longest_streak: 1,
                    last_practice_date: new Date().toISOString().split('T')[0],
                })
        }

        return NextResponse.json({
            success: true,
            results: {
                score: correctCount,
                total: totalQuestions,
                percentage: scorePercentage,
                time_seconds: total_time_seconds || 0,
                topics_updated: topicResults.size,
            },
        })
    } catch (err: any) {
        console.error('[Brain Daily Submit] PUT error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// ─── Helpers ─────────────────────────────────────────────

function calculateUpdatedPerformance(currentScore: number, newScore: number): number {
    // Weighted rolling average: 70% existing + 30% new
    const weighted = (currentScore * 0.7) + (newScore * 0.3)
    return Math.round(weighted * 10) / 10
}

function calculateActivityPoints(scorePercentage: number, questionsAnswered: number): number {
    // Base points for completing daily work: 10
    // Bonus for score: 0-5 points based on percentage
    // Bonus for answering all: 5 points
    let points = 10
    points += Math.round((scorePercentage / 100) * 5)
    if (questionsAnswered >= 10) points += 5
    return points
}

/**
 * CUSTOS Brain Practice API
 *
 * GET  /api/brain/practice?phase=daily|weekly|lesson
 *      → Returns a pending assessment phase or generates a new one
 *
 * POST /api/brain/practice
 *      → Submit an answer: { phaseId, questionIndex, answer, timeTaken }
 *      → Updates topic performance in real-time
 *
 * PUT  /api/brain/practice
 *      → Complete phase: { phaseId }
 *      → Awards points, updates scores
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generate60_40QuestionSet, updateTopicPerformance, completeAssessmentPhase } from '@/lib/analytics/brainEngine'
import type { MCQQuestion, PhaseType } from '@/lib/types/brain'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── GET: Fetch or generate practice questions ────────────

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const phaseType = (searchParams.get('phase') || 'daily') as PhaseType
        const studentId = searchParams.get('studentId')

        if (!studentId) {
            return NextResponse.json({ error: 'studentId required' }, { status: 400 })
        }

        // Check for an existing pending phase for today
        const today = new Date().toISOString().split('T')[0]

        const { data: existingPhase } = await supabase
            .from('assessment_phases')
            .select('*')
            .eq('student_id', studentId)
            .eq('phase_type', phaseType)
            .eq('scheduled_date', today)
            .in('status', ['pending', 'in_progress'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (existingPhase) {
            // Resume existing phase
            // If still pending, mark as in_progress
            if (existingPhase.status === 'pending') {
                await supabase
                    .from('assessment_phases')
                    .update({ status: 'in_progress' })
                    .eq('phase_id', existingPhase.phase_id)
            }

            return NextResponse.json({
                phase: {
                    ...existingPhase,
                    status: 'in_progress',
                },
                isResuming: existingPhase.status === 'in_progress',
            })
        }

        // Check if today's practice is already completed
        const { data: completedPhase } = await supabase
            .from('assessment_phases')
            .select('phase_id, score_percentage, correct_answers, total_questions, completed_at')
            .eq('student_id', studentId)
            .eq('phase_type', phaseType)
            .eq('scheduled_date', today)
            .eq('status', 'completed')
            .limit(1)
            .single()

        if (completedPhase) {
            return NextResponse.json({
                completed: true,
                result: completedPhase,
            })
        }

        // Generate new question set using the 60/40 Brain
        const totalQuestions = phaseType === 'daily' ? 10 : phaseType === 'weekly' ? 20 : 30
        const questionSet = await generate60_40QuestionSet(studentId, phaseType, totalQuestions)

        if (questionSet.questions.length === 0) {
            return NextResponse.json({
                error: 'No topics available. Please ensure syllabus content has been uploaded.',
                noTopics: true,
            }, { status: 404 })
        }

        // Create assessment phase
        const { data: newPhase, error: insertErr } = await supabase
            .from('assessment_phases')
            .insert({
                student_id: studentId,
                phase_type: phaseType,
                scheduled_date: today,
                total_questions: questionSet.questions.length,
                questions: questionSet.questions,
                weak_topic_count: questionSet.weakCount,
                strong_topic_count: questionSet.strongCount,
                status: 'in_progress',
            })
            .select()
            .single()

        if (insertErr) {
            console.error('[Brain API] insert phase error:', insertErr)
            return NextResponse.json({ error: 'Failed to create practice session' }, { status: 500 })
        }

        return NextResponse.json({
            phase: newPhase,
            isResuming: false,
        })
    } catch (err) {
        console.error('[Brain API] GET error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// ─── POST: Submit a single answer ─────────────────────────

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { phaseId, questionIndex, answer, timeTaken } = body

        if (!phaseId || questionIndex === undefined || !answer) {
            return NextResponse.json({ error: 'phaseId, questionIndex, answer required' }, { status: 400 })
        }

        // Fetch the phase
        const { data: phase, error: fetchErr } = await supabase
            .from('assessment_phases')
            .select('*')
            .eq('phase_id', phaseId)
            .single()

        if (fetchErr || !phase) {
            return NextResponse.json({ error: 'Phase not found' }, { status: 404 })
        }

        // Update the question with student's response
        const questions = [...(phase.questions as MCQQuestion[])]
        if (questionIndex >= questions.length) {
            return NextResponse.json({ error: 'Invalid question index' }, { status: 400 })
        }

        const question = questions[questionIndex]
        const isCorrect = answer === question.correct_answer

        questions[questionIndex] = {
            ...question,
            student_answer: answer,
            is_correct: isCorrect,
            time_taken: timeTaken || 0,
        }

        // Save updated questions to DB
        const answeredCount = questions.filter((q) => q.student_answer).length
        const correctCount = questions.filter((q) => q.is_correct).length

        await supabase
            .from('assessment_phases')
            .update({
                questions,
                correct_answers: correctCount,
                score_percentage: answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100 * 100) / 100 : 0,
            })
            .eq('phase_id', phaseId)

        // Update topic performance in real-time (The Brain learns)
        if (question.topic_id) {
            await updateTopicPerformance(
                phase.student_id,
                question.topic_id,
                isCorrect,
                timeTaken || 0
            )
        }

        return NextResponse.json({
            isCorrect,
            correctAnswer: question.correct_answer,
            explanation: question.explanation || null,
            progress: {
                answered: answeredCount,
                total: questions.length,
                correct: correctCount,
            },
        })
    } catch (err) {
        console.error('[Brain API] POST error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// ─── PUT: Complete the assessment phase ───────────────────

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { phaseId } = body

        if (!phaseId) {
            return NextResponse.json({ error: 'phaseId required' }, { status: 400 })
        }

        // Complete the phase (awards points, updates scores, checks achievements)
        await completeAssessmentPhase(phaseId)

        // Fetch updated phase and score
        const { data: phase } = await supabase
            .from('assessment_phases')
            .select('*')
            .eq('phase_id', phaseId)
            .single()

        const { data: scores } = await supabase
            .from('student_scores')
            .select('activity_score, daily_streak, longest_streak, badges_earned')
            .eq('student_id', phase?.student_id)
            .limit(1)
            .single()

        return NextResponse.json({
            phase,
            scores: scores || { activity_score: 0, daily_streak: 0, longest_streak: 0, badges_earned: [] },
        })
    } catch (err) {
        console.error('[Brain API] PUT error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

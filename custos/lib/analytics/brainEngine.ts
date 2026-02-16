/**
 * CUSTOS Brain Engine
 *
 * The core adaptive learning intelligence.
 * Implements the 60/40 algorithm:
 *   60% of questions from WEAK topics (weakness >= 50)
 *   40% from STRONG topics (weakness < 50)
 *
 * Key functions:
 *   calculateTopicWeakness()    – scores a single student-topic pair (0-100)
 *   getWeakTopics()             – all weak topics for a student
 *   getStrongTopics()           – all strong topics for a student
 *   generate60_40QuestionSet()  – the main adaptive MCQ generator
 *   updateTopicPerformance()    – called after every student answer
 *   updateActivityScore()       – awards visible activity points
 *
 * Privacy: This engine operates on performance data that is HIDDEN
 * from students. The API layer must filter responses accordingly.
 */

import { supabase } from '@/lib/supabase'
import type {
    StudentTopicPerformance,
    MCQQuestion,
    GeneratedQuestionSet,
    TopicWeakness,
    ActivityAction,
    PhaseType,
    Difficulty,
} from '@/lib/types/brain'
import {
    getTopicExpectedTime,
    sampleWeighted,
    sampleRandom,
    shuffle,
    daysBetween,
    checkAndAwardAchievements,
    getCurrentStreak,
} from '@/lib/analytics/helpers'

// ─── Constants ───────────────────────────────────────────

const WEAKNESS_THRESHOLD = 50 // >= this means "weak"
const ACCURACY_WEIGHT = 0.4
const TIME_WEIGHT = 0.3
const RECENCY_WEIGHT = 0.3
const RECENCY_MAX_DAYS = 7
const WEAK_RATIO = 0.6 // 60% weak
const STRONG_RATIO = 0.4 // 40% strong

// Activity point values
const ACTIVITY_POINTS: Record<ActivityAction, number> = {
    daily_complete: 25,
    weekly_complete: 50,
    lesson_complete: 100,
    streak_increment: 10,
    achievement_earn: 0, // achievements have their own point values
    doubt_asked: 5,
}

// ─── 1. Calculate Topic Weakness ─────────────────────────

/**
 * Calculates the weakness score (0-100) for a student-topic pair.
 *
 * Algorithm:
 *   weakness = accuracy_component + time_component + recency_component
 *
 *   accuracy_component = (100 - accuracy%) × 0.4
 *   time_component     = max(0, (avgTime/expectedTime - 1) × 100) × 0.3
 *   recency_component  = min(daysSinceLast / 7, 1.0) × 30
 *
 * Result is clamped to [0, 100].
 *
 * @param studentId - The student's user_id
 * @param topicId   - The topic's topic_id
 * @returns Weakness score (0 = mastered, 100 = very weak)
 */
export async function calculateTopicWeakness(
    studentId: string,
    topicId: string
): Promise<number> {
    try {
        const { data: perf, error } = await supabase
            .from('student_topic_performance')
            .select('accuracy_percentage, average_time_seconds, last_assessed_at, total_attempts')
            .eq('student_id', studentId)
            .eq('topic_id', topicId)
            .single()

        if (error || !perf) {
            // No data yet → default to weak (needs first assessment)
            return 75.0
        }

        // If never attempted, treat as weak
        if (perf.total_attempts === 0) return 75.0

        const accuracy = perf.accuracy_percentage ?? 0
        const avgTime = perf.average_time_seconds ?? 0
        const expectedTime = getTopicExpectedTime()

        // Component 1: Accuracy (40% weight)
        const accuracyComponent = (100 - accuracy) * ACCURACY_WEIGHT

        // Component 2: Time efficiency (30% weight)
        let timeComponent = 0
        if (expectedTime > 0 && avgTime > 0) {
            const timeRatio = Math.min(avgTime / expectedTime, 2.0) // Cap at 2x
            timeComponent = Math.max(0, (timeRatio - 1) * 100) * TIME_WEIGHT
        }

        // Component 3: Recency (30% weight)
        let recencyComponent = RECENCY_WEIGHT * 100 // Max = 30 if never assessed
        if (perf.last_assessed_at) {
            const daysSince = daysBetween(new Date(perf.last_assessed_at), new Date())
            const recencyRatio = Math.min(daysSince / RECENCY_MAX_DAYS, 1.0)
            recencyComponent = recencyRatio * (RECENCY_WEIGHT * 100)
        }

        const weakness = accuracyComponent + timeComponent + recencyComponent
        return Math.min(Math.max(weakness, 0), 100)
    } catch (err) {
        console.error('[Brain] calculateTopicWeakness error:', err)
        return 75.0 // Default to weak on error
    }
}

// ─── 2. Get Weak / Strong Topics ─────────────────────────

/**
 * Returns all topics where the student is WEAK (weakness >= 50).
 * Sorted by weakness descending (weakest first).
 */
export async function getWeakTopics(
    studentId: string
): Promise<TopicWeakness[]> {
    try {
        const allTopics = await getAllTopicWeaknesses(studentId)
        return allTopics
            .filter((t) => t.weaknessScore >= WEAKNESS_THRESHOLD)
            .sort((a, b) => b.weaknessScore - a.weaknessScore)
    } catch (err) {
        console.error('[Brain] getWeakTopics error:', err)
        return []
    }
}

/**
 * Returns all topics where the student is STRONG (weakness < 50).
 * Sorted by weakness ascending (strongest first).
 */
export async function getStrongTopics(
    studentId: string
): Promise<TopicWeakness[]> {
    try {
        const allTopics = await getAllTopicWeaknesses(studentId)
        return allTopics
            .filter((t) => t.weaknessScore < WEAKNESS_THRESHOLD)
            .sort((a, b) => a.weaknessScore - b.weaknessScore)
    } catch (err) {
        console.error('[Brain] getStrongTopics error:', err)
        return []
    }
}

/**
 * Internal: fetches all performance records for a student and
 * recalculates weakness scores.
 */
async function getAllTopicWeaknesses(
    studentId: string
): Promise<TopicWeakness[]> {
    const { data: perfs, error } = await supabase
        .from('student_topic_performance')
        .select('topic_id, accuracy_percentage, average_time_seconds, last_assessed_at, total_attempts')
        .eq('student_id', studentId)

    if (error || !perfs) return []

    const results: TopicWeakness[] = []
    for (const perf of perfs) {
        const weakness = await calculateTopicWeakness(studentId, perf.topic_id)
        results.push({
            topicId: perf.topic_id,
            weaknessScore: weakness,
        })
    }

    return results
}

// ─── 3. Generate 60/40 Question Set ──────────────────────

/**
 * Generates an adaptive MCQ question set using the 60/40 algorithm.
 *
 * 60% of questions come from the student's WEAK topics (weighted by
 * weakness score, so weaker topics get more questions).
 * 40% come from STRONG topics (random selection).
 *
 * If the student has no history yet, questions are distributed evenly
 * across all available topics.
 *
 * Questions are shuffled so weak/strong aren't clustered together.
 *
 * @param studentId      - The student's user_id
 * @param phaseType      - 'daily' (10), 'weekly' (20), or 'lesson' (30)
 * @param totalQuestions  - Number of questions to generate
 * @returns Generated question set with metadata
 */
export async function generate60_40QuestionSet(
    studentId: string,
    phaseType: PhaseType,
    totalQuestions: number = 10
): Promise<GeneratedQuestionSet> {
    try {
        // Default question counts per phase
        if (totalQuestions <= 0) {
            switch (phaseType) {
                case 'daily':
                    totalQuestions = 10
                    break
                case 'weekly':
                    totalQuestions = 20
                    break
                case 'lesson':
                    totalQuestions = 30
                    break
            }
        }

        const weakTopics = await getWeakTopics(studentId)
        const strongTopics = await getStrongTopics(studentId)

        let weakCount: number
        let strongCount: number

        if (weakTopics.length === 0 && strongTopics.length === 0) {
            // Brand new student – fetch all available topics for their class
            const allTopics = await getStudentAvailableTopics(studentId)
            const questions = await generateMockQuestions(allTopics, totalQuestions)

            return {
                questions: shuffle(questions),
                weakCount: 0,
                strongCount: totalQuestions,
                metadata: {
                    weakTopics: [],
                    strongTopics: allTopics.map((t) => ({ topicId: t, weaknessScore: 50 })),
                },
            }
        }

        // Calculate 60/40 split
        weakCount = Math.round(totalQuestions * WEAK_RATIO)
        strongCount = totalQuestions - weakCount

        // Adjust if not enough topics in either category
        if (weakTopics.length === 0) {
            strongCount = totalQuestions
            weakCount = 0
        } else if (strongTopics.length === 0) {
            weakCount = totalQuestions
            strongCount = 0
        }

        // Sample topics (weighted for weak, random for strong)
        const selectedWeak = sampleWeighted(
            weakTopics,
            weakCount,
            (t) => t.weaknessScore
        )
        const selectedStrong = sampleRandom(strongTopics, strongCount)

        // Generate questions for each selected topic
        const weakQuestions = await generateMockQuestions(
            selectedWeak.map((t) => t.topicId),
            weakCount
        )
        const strongQuestions = await generateMockQuestions(
            selectedStrong.map((t) => t.topicId),
            strongCount
        )

        const allQuestions = shuffle([...weakQuestions, ...strongQuestions])

        return {
            questions: allQuestions,
            weakCount,
            strongCount,
            metadata: {
                weakTopics: selectedWeak,
                strongTopics: selectedStrong,
            },
        }
    } catch (err) {
        console.error('[Brain] generate60_40QuestionSet error:', err)
        return {
            questions: [],
            weakCount: 0,
            strongCount: 0,
            metadata: { weakTopics: [], strongTopics: [] },
        }
    }
}

// ─── 4. Update Topic Performance ─────────────────────────

/**
 * Called after a student answers a single question.
 * Updates the student_topic_performance row with new stats
 * and recalculates the weakness score.
 *
 * @param studentId  - The student's user_id
 * @param topicId    - The topic_id of the question answered
 * @param wasCorrect - Whether the answer was correct
 * @param timeSpent  - Time taken in seconds
 */
export async function updateTopicPerformance(
    studentId: string,
    topicId: string,
    wasCorrect: boolean,
    timeSpent: number
): Promise<void> {
    try {
        // Fetch existing record (or null for first time)
        const { data: existing } = await supabase
            .from('student_topic_performance')
            .select('*')
            .eq('student_id', studentId)
            .eq('topic_id', topicId)
            .single()

        const now = new Date().toISOString()

        if (!existing) {
            // First ever attempt on this topic
            const accuracy = wasCorrect ? 100 : 0
            const weakness = await calculateInitialWeakness(accuracy, timeSpent)

            const { error } = await supabase
                .from('student_topic_performance')
                .insert({
                    student_id: studentId,
                    topic_id: topicId,
                    total_attempts: 1,
                    correct_answers: wasCorrect ? 1 : 0,
                    accuracy_percentage: accuracy,
                    average_time_seconds: timeSpent,
                    weakness_score: weakness,
                    is_weak_topic: weakness >= WEAKNESS_THRESHOLD,
                    last_assessed_at: now,
                    consecutive_correct: wasCorrect ? 1 : 0,
                    needs_reinforcement: !wasCorrect,
                })

            if (error) console.error('[Brain] insert performance error:', error)
            return
        }

        // Update existing record
        const newAttempts = existing.total_attempts + 1
        const newCorrect = existing.correct_answers + (wasCorrect ? 1 : 0)
        const newAccuracy = (newCorrect / newAttempts) * 100

        // Running average for time
        const newAvgTime = Math.round(
            (existing.average_time_seconds * existing.total_attempts + timeSpent) / newAttempts
        )

        const newConsecutive = wasCorrect ? existing.consecutive_correct + 1 : 0

        // Recalculate weakness
        const expectedTime = getTopicExpectedTime()
        const accuracyComponent = (100 - newAccuracy) * ACCURACY_WEIGHT
        const timeRatio = Math.min(newAvgTime / expectedTime, 2.0)
        const timeComponent = Math.max(0, (timeRatio - 1) * 100) * TIME_WEIGHT
        // Recency is 0 because we're assessing NOW
        const recencyComponent = 0
        const newWeakness = Math.min(
            Math.max(accuracyComponent + timeComponent + recencyComponent, 0),
            100
        )

        const { error } = await supabase
            .from('student_topic_performance')
            .update({
                total_attempts: newAttempts,
                correct_answers: newCorrect,
                accuracy_percentage: Math.round(newAccuracy * 100) / 100,
                average_time_seconds: newAvgTime,
                weakness_score: Math.round(newWeakness * 100) / 100,
                is_weak_topic: newWeakness >= WEAKNESS_THRESHOLD,
                last_assessed_at: now,
                consecutive_correct: newConsecutive,
                needs_reinforcement: newWeakness >= WEAKNESS_THRESHOLD,
            })
            .eq('performance_id', existing.performance_id)

        if (error) console.error('[Brain] update performance error:', error)
    } catch (err) {
        console.error('[Brain] updateTopicPerformance exception:', err)
    }
}

// ─── 5. Update Activity Score ────────────────────────────

/**
 * Awards visible activity points to a student.
 * Also updates streak if applicable.
 *
 * @param studentId - The student's user_id
 * @param action    - What the student did
 * @param points    - Override points (uses default if 0)
 */
export async function updateActivityScore(
    studentId: string,
    action: ActivityAction,
    points: number = 0
): Promise<void> {
    try {
        const awardPoints = points || ACTIVITY_POINTS[action] || 0

        // Fetch or create student_scores row
        const { data: existing } = await supabase
            .from('student_scores')
            .select('*')
            .eq('student_id', studentId)
            .limit(1)
            .single()

        if (!existing) {
            // Create initial scores record
            const streak = action === 'streak_increment' ? 1 : 0
            const { error } = await supabase.from('student_scores').insert({
                student_id: studentId,
                activity_score: awardPoints,
                daily_streak: streak,
                longest_streak: streak,
                total_attempts: action === 'daily_complete' ? 1 : 0,
                weekly_completions: action === 'weekly_complete' ? 1 : 0,
            })
            if (error) console.error('[Brain] insert student_scores error:', error)
            return
        }

        // Build update object
        const update: Record<string, unknown> = {
            activity_score: existing.activity_score + awardPoints,
            last_updated: new Date().toISOString(),
        }

        if (action === 'daily_complete') {
            update.total_attempts = existing.total_attempts + 1
        }

        if (action === 'weekly_complete') {
            update.weekly_completions = existing.weekly_completions + 1
        }

        if (action === 'streak_increment') {
            const newStreak = existing.daily_streak + 1
            update.daily_streak = newStreak
            if (newStreak > existing.longest_streak) {
                update.longest_streak = newStreak
            }
        }

        const { error } = await supabase
            .from('student_scores')
            .update(update)
            .eq('score_id', existing.score_id)

        if (error) console.error('[Brain] update activity_score error:', error)

        // Check for new achievements after updating score
        await checkAndAwardAchievements(studentId)
    } catch (err) {
        console.error('[Brain] updateActivityScore exception:', err)
    }
}

// ─── 6. Complete Assessment Phase ────────────────────────

/**
 * Called when a student finishes an entire assessment phase.
 * Calculates final score, updates performance scores, and
 * triggers activity point awards.
 *
 * @param phaseId - The assessment_phases.phase_id
 */
export async function completeAssessmentPhase(
    phaseId: string
): Promise<void> {
    try {
        const { data: phase, error: fetchErr } = await supabase
            .from('assessment_phases')
            .select('*')
            .eq('phase_id', phaseId)
            .single()

        if (fetchErr || !phase) {
            console.error('[Brain] completeAssessmentPhase fetch error:', fetchErr)
            return
        }

        const questions = phase.questions as MCQQuestion[] || []
        const totalQ = questions.length
        const correctCount = questions.filter((q) => q.is_correct).length
        const totalTime = questions.reduce((sum, q) => sum + (q.time_taken || 0), 0)
        const scorePercent = totalQ > 0 ? (correctCount / totalQ) * 100 : 0

        // Update the phase itself
        const { error: updateErr } = await supabase
            .from('assessment_phases')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                total_questions: totalQ,
                correct_answers: correctCount,
                score_percentage: Math.round(scorePercent * 100) / 100,
                time_taken_seconds: totalTime,
            })
            .eq('phase_id', phaseId)

        if (updateErr) {
            console.error('[Brain] completeAssessmentPhase update error:', updateErr)
            return
        }

        // Award activity points
        const actionMap: Record<string, ActivityAction> = {
            daily: 'daily_complete',
            weekly: 'weekly_complete',
            lesson: 'lesson_complete',
        }
        const action = actionMap[phase.phase_type] || 'daily_complete'
        await updateActivityScore(phase.student_id, action)

        // Update streak
        const streak = await getCurrentStreak(phase.student_id)
        if (streak > 0) {
            await updateActivityScore(phase.student_id, 'streak_increment', 0)
        }

        // Update performance score (hidden)
        await updatePerformanceScore(phase.student_id)
    } catch (err) {
        console.error('[Brain] completeAssessmentPhase exception:', err)
    }
}

// ─── Internal Helpers ────────────────────────────────────

/**
 * Calculates initial weakness for a first-time attempt.
 */
async function calculateInitialWeakness(
    accuracy: number,
    timeSpent: number
): Promise<number> {
    const expectedTime = getTopicExpectedTime()
    const accuracyComponent = (100 - accuracy) * ACCURACY_WEIGHT
    const timeRatio = Math.min(timeSpent / expectedTime, 2.0)
    const timeComponent = Math.max(0, (timeRatio - 1) * 100) * TIME_WEIGHT
    const recencyComponent = 0 // just assessed
    return Math.min(Math.max(accuracyComponent + timeComponent + recencyComponent, 0), 100)
}

/**
 * Gets all topic IDs available to a student (based on their class).
 */
async function getStudentAvailableTopics(studentId: string): Promise<string[]> {
    try {
        // Get student's class
        const { data: student } = await supabase
            .from('users')
            .select('class_id')
            .eq('user_id', studentId)
            .single()

        if (!student?.class_id) return []

        // Get subjects for their class
        const { data: subjects } = await supabase
            .from('subjects')
            .select('subject_id')
            .eq('class_id', student.class_id)

        if (!subjects || subjects.length === 0) return []

        // Get syllabus documents for those subjects
        const subjectIds = subjects.map((s) => s.subject_id)
        const { data: docs } = await supabase
            .from('syllabus_documents')
            .select('document_id')
            .in('subject_id', subjectIds)

        if (!docs || docs.length === 0) return []

        // Get lesson topics from those documents
        const docIds = docs.map((d) => d.document_id)
        const { data: topics } = await supabase
            .from('lesson_topics')
            .select('topic_id')
            .in('document_id', docIds)

        return (topics ?? []).map((t) => t.topic_id)
    } catch (err) {
        console.error('[Brain] getStudentAvailableTopics error:', err)
        return []
    }
}

/**
 * Generates mock MCQ questions for given topic IDs.
 * This is a placeholder – will be replaced with real AI generation later.
 *
 * For now, it pulls from the existing mcq_generations table if available,
 * or creates simple placeholder questions.
 */
async function generateMockQuestions(
    topicIds: string[],
    count: number
): Promise<MCQQuestion[]> {
    const questions: MCQQuestion[] = []

    if (topicIds.length === 0) return questions

    // Try to pull real MCQs from existing mcq_generations table
    for (const topicId of topicIds) {
        const { data: mcgData } = await supabase
            .from('mcq_generations')
            .select('questions')
            .eq('topic_id', topicId)
            .order('generation_number', { ascending: false })
            .limit(1)
            .single()

        if (mcgData?.questions && Array.isArray(mcgData.questions)) {
            const available = mcgData.questions as Array<{
                question?: string
                options?: string[]
                correct_answer?: string
                explanation?: string
                difficulty?: string
            }>

            for (const q of available) {
                if (questions.length >= count) break
                questions.push({
                    question_id: crypto.randomUUID(),
                    topic_id: topicId,
                    question_text: q.question || `Question about topic ${topicId.slice(0, 8)}`,
                    options: q.options || ['A) Option 1', 'B) Option 2', 'C) Option 3', 'D) Option 4'],
                    correct_answer: q.correct_answer || 'A',
                    difficulty: (q.difficulty as Difficulty) || 'medium',
                    explanation: q.explanation,
                })
            }
        }
    }

    // If we don't have enough real questions, fill with placeholders
    const perTopic = Math.ceil((count - questions.length) / Math.max(topicIds.length, 1))
    for (const topicId of topicIds) {
        if (questions.length >= count) break
        for (let i = 0; i < perTopic; i++) {
            if (questions.length >= count) break

            // Get topic title for better placeholders
            const { data: topicData } = await supabase
                .from('lesson_topics')
                .select('topic_title')
                .eq('topic_id', topicId)
                .single()

            const title = topicData?.topic_title || `Topic ${topicId.slice(0, 8)}`
            const difficulties: Difficulty[] = ['easy', 'medium', 'hard']
            const diff = difficulties[Math.floor(Math.random() * 3)]

            questions.push({
                question_id: crypto.randomUUID(),
                topic_id: topicId,
                question_text: `Review question ${i + 1} for: ${title}`,
                options: [
                    'A) First option',
                    'B) Second option',
                    'C) Third option',
                    'D) Fourth option',
                ],
                correct_answer: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
                difficulty: diff,
            })
        }
    }

    return questions.slice(0, count)
}

/**
 * Recalculates and updates the hidden performance_score for a student.
 * Based on average accuracy across all topics.
 */
async function updatePerformanceScore(studentId: string): Promise<void> {
    try {
        const { data: perfs } = await supabase
            .from('student_topic_performance')
            .select('accuracy_percentage, total_attempts')
            .eq('student_id', studentId)
            .gt('total_attempts', 0)

        if (!perfs || perfs.length === 0) return

        // Weighted average by attempts
        const totalAttempts = perfs.reduce((sum, p) => sum + p.total_attempts, 0)
        const weightedAccuracy = perfs.reduce(
            (sum, p) => sum + p.accuracy_percentage * p.total_attempts,
            0
        )
        const performanceScore = totalAttempts > 0
            ? Math.round((weightedAccuracy / totalAttempts) * 100) / 100
            : 0

        await supabase
            .from('student_scores')
            .update({ performance_score: performanceScore })
            .eq('student_id', studentId)
    } catch (err) {
        console.error('[Brain] updatePerformanceScore error:', err)
    }
}

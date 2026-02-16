/**
 * CUSTOS Brain Types
 * Type definitions for the adaptive learning engine.
 *
 * Privacy note:
 *   - Performance fields (performance_score, rank, percentile, weakness_score)
 *     are NEVER sent to student/parent clients.
 *   - Activity fields (activity_score, streak, badges) are always visible.
 */

// ─── Core Performance Tracking ───────────────────────────

export interface StudentTopicPerformance {
    performance_id: string
    student_id: string
    topic_id: string
    total_attempts: number
    correct_answers: number
    accuracy_percentage: number
    average_time_seconds: number
    is_weak_topic: boolean
    /** 0 = mastered, 100 = completely weak */
    weakness_score: number
    last_assessed_at: string | null
    consecutive_correct: number
    needs_reinforcement: boolean
    created_at: string
    updated_at: string
}

// ─── 3-Phase Assessment Loop ─────────────────────────────

export type PhaseType = 'daily' | 'weekly' | 'lesson'
export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'missed'

export interface AssessmentPhase {
    phase_id: string
    student_id: string
    topic_id: string | null
    phase_type: PhaseType
    scheduled_date: string
    completed_at: string | null
    total_questions: number
    correct_answers: number
    score_percentage: number
    time_taken_seconds: number
    questions: MCQQuestion[]
    weak_topic_count: number
    strong_topic_count: number
    status: PhaseStatus
    created_at: string
}

// ─── Dual Grading System ─────────────────────────────────

export interface DualScore {
    score_id: string
    student_id: string
    academic_year_id: string | null
    // HIDDEN from student & parent
    performance_score: number
    performance_rank: number | null
    performance_percentile: number | null
    // VISIBLE to all
    activity_score: number
    daily_streak: number
    longest_streak: number
    weekly_completions: number
    total_attempts: number
    badges_earned: string[]
    // Privacy flags
    student_can_view_performance: boolean
    parent_can_view_performance: boolean
    last_updated: string
    created_at: string
}

/** The subset of DualScore that students/parents are allowed to see */
export interface ActivityScoreView {
    student_id: string
    activity_score: number
    daily_streak: number
    longest_streak: number
    weekly_completions: number
    total_attempts: number
    badges_earned: string[]
}

// ─── MCQ Question ────────────────────────────────────────

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface MCQQuestion {
    question_id: string
    topic_id: string
    question_text: string
    options: string[]
    correct_answer: string
    difficulty: Difficulty
    explanation?: string
    // Filled in after student answers
    student_answer?: string
    is_correct?: boolean
    time_taken?: number
}

// ─── AI Chatbot Doubt ────────────────────────────────────

export type DoubtStatus = 'open' | 'ai_answered' | 'teacher_answered' | 'resolved'

export interface StudentDoubt {
    doubt_id: string
    student_id: string
    topic_id: string | null
    doubt_text: string
    ai_response: string | null
    was_helpful: boolean | null
    flagged_for_teacher: boolean
    teacher_notified_at: string | null
    teacher_response: string | null
    resolved_by: string | null
    status: DoubtStatus
    created_at: string
}

// ─── Daily Topic Schedule ────────────────────────────────

export interface DailyTopicSchedule {
    schedule_id: string
    class_id: string
    section_id: string
    subject_id: string
    topic_id: string
    scheduled_date: string
    covered_in_class: boolean
    daily_mcq_enabled: boolean
    created_by: string | null
    created_at: string
}

// ─── Achievements / Gamification ─────────────────────────

export type AchievementCategory = 'streak' | 'accuracy' | 'improvement' | 'participation' | 'milestone'

export interface Achievement {
    achievement_id: string
    name: string
    description: string | null
    icon: string | null
    category: AchievementCategory | null
    criteria: Record<string, unknown>
    points_awarded: number
    is_active: boolean
    created_at: string
}

export interface StudentAchievement {
    id: string
    student_id: string
    achievement_id: string
    earned_at: string
}

// ─── Brain Engine Function Signatures ─────────────────────

/** Returned by the 60/40 question generator */
export interface GeneratedQuestionSet {
    questions: MCQQuestion[]
    weakCount: number
    strongCount: number
    metadata: {
        weakTopics: TopicWeakness[]
        strongTopics: TopicWeakness[]
    }
}

export interface TopicWeakness {
    topicId: string
    topicTitle?: string
    weaknessScore: number
}

/** Actions that award activity points */
export type ActivityAction =
    | 'daily_complete'
    | 'weekly_complete'
    | 'lesson_complete'
    | 'streak_increment'
    | 'achievement_earn'
    | 'doubt_asked'

'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    Brain, ChevronRight, ChevronLeft, CheckCircle, XCircle,
    Clock, Flame, Trophy, Zap, ArrowLeft, Loader2, Star,
    Target, BarChart3, Sparkles, AlertTriangle, Timer, BookOpen
} from 'lucide-react'
import QuizCard from '@/components/student/QuizCard'
import ScoreScreen from '@/components/student/ScoreScreen'
import StreakDisplay from '@/components/student/StreakDisplay'

interface MCQQuestion {
    question_id: string
    topic_id: string
    question_text: string
    options: string[]
    correct_answer: string
    difficulty: string
    explanation?: string
    student_answer?: string
    is_correct?: boolean
    time_taken?: number
}

interface PracticePhase {
    phase_id: string
    student_id: string
    phase_type: string
    scheduled_date: string
    total_questions: number
    correct_answers: number
    score_percentage: number
    questions: MCQQuestion[]
    weak_topic_count: number
    strong_topic_count: number
    status: string
    time_limit_minutes?: number
    lesson_plan_id?: string
}

type Screen = 'loading' | 'start' | 'quiz' | 'feedback' | 'review' | 'results' | 'completed' | 'no-topics'

const STORAGE_KEY = 'custos_practice_state'

const TEST_CONFIG: Record<string, {
    title: string
    subtitle: string
    questions: number
    timeLimit: number | null
    points: number
    showTimer: boolean
    allowHints: boolean
    allowReview: boolean
    icon: string
    gradient: string
}> = {
    daily: {
        title: 'Daily Practice',
        subtitle: 'adaptive questions personalized just for you',
        questions: 10,
        timeLimit: null,
        points: 25,
        showTimer: false,
        allowHints: true,
        allowReview: false,
        icon: '🧠',
        gradient: 'from-indigo-600 to-purple-600',
    },
    weekly: {
        title: 'Weekly Test',
        subtitle: "Covering this week's topics • 30 min limit",
        questions: 20,
        timeLimit: 30,
        points: 50,
        showTimer: true,
        allowHints: false,
        allowReview: true,
        icon: '📝',
        gradient: 'from-blue-600 to-cyan-600',
    },
    lesson: {
        title: 'Lesson Test',
        subtitle: 'Comprehensive lesson assessment • 45 min limit',
        questions: 30,
        timeLimit: 45,
        points: 75,
        showTimer: true,
        allowHints: false,
        allowReview: true,
        icon: '📚',
        gradient: 'from-emerald-600 to-teal-600',
    },
}

// Haptic feedback helper
const vibrate = (pattern: number | number[]) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern)
    }
}

function PracticePageInner() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const testType = searchParams.get('type') || 'daily'
    const config = TEST_CONFIG[testType] || TEST_CONFIG.daily

    const [screen, setScreen] = useState<Screen>('loading')
    const [phase, setPhase] = useState<PracticePhase | null>(null)
    const [currentIndex, setCurrentIndex] = useState(0)
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
    const [isAnswered, setIsAnswered] = useState(false)
    const [feedbackData, setFeedbackData] = useState<{
        isCorrect: boolean
        correctAnswer: string
        explanation: string | null
    } | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [questionTimer, setQuestionTimer] = useState(0)
    const [totalCorrect, setTotalCorrect] = useState(0)
    const [totalAnswered, setTotalAnswered] = useState(0)
    const [activityData, setActivityData] = useState({
        activityScore: 0,
        dailyStreak: 0,
        longestStreak: 0,
    })
    const [resultScores, setResultScores] = useState<any>(null)
    const [studentId, setStudentId] = useState<string | null>(null)
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const startTimeRef = useRef<number>(Date.now())
    const autoAdvanceRef = useRef<NodeJS.Timeout | null>(null)

    // --- Countdown timer state for timed tests ---
    const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null)
    const countdownRef = useRef<NodeJS.Timeout | null>(null)
    const testStartTimeRef = useRef<number>(0)

    // Submit confirmation dialog state
    const [showSubmitDialog, setShowSubmitDialog] = useState(false)

    // Answers map for review mode (weekly/lesson)
    const [answersMap, setAnswersMap] = useState<Record<number, string>>({})

    // ─── Load session and fetch practice ─────────────────

    useEffect(() => {
        initPractice()
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
            if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current)
            if (countdownRef.current) clearInterval(countdownRef.current)
        }
    }, [])

    // ─── Save state to localStorage ─────────────────────

    useEffect(() => {
        if (phase && screen === 'quiz') {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    phaseId: phase.phase_id,
                    testType,
                    currentIndex,
                    totalCorrect,
                    totalAnswered,
                    answersMap,
                    timestamp: Date.now(),
                }))
            } catch { }
        }
    }, [currentIndex, totalCorrect, totalAnswered, phase, screen, answersMap])

    async function initPractice() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }

            const { data: user } = await supabase
                .from('users')
                .select('user_id, role')
                .eq('email', session.user.email)
                .single()

            if (!user || user.role !== 'student') {
                router.push('/dashboard')
                return
            }

            setStudentId(user.user_id)

            // Fetch activity data
            const actRes = await fetch(`/api/brain/activity?studentId=${user.user_id}`)
            if (actRes.ok) {
                const actData = await actRes.json()
                setActivityData(actData)

                // If today's practice is already completed (daily only)
                if (testType === 'daily' && actData.todayPractice?.status === 'completed') {
                    setScreen('completed')
                    return
                }
            }

            // Fetch or generate practice
            const res = await fetch(`/api/brain/practice?phase=${testType}&studentId=${user.user_id}`)
            const data = await res.json()

            if (data.noTopics) {
                setScreen('no-topics')
                return
            }

            if (data.completed) {
                setScreen('completed')
                return
            }

            if (data.phase) {
                setPhase(data.phase)

                // Try to restore state from localStorage
                try {
                    const saved = localStorage.getItem(STORAGE_KEY)
                    if (saved) {
                        const state = JSON.parse(saved)
                        if (
                            state.phaseId === data.phase.phase_id &&
                            state.testType === testType &&
                            Date.now() - state.timestamp < 2 * 60 * 60 * 1000
                        ) {
                            setCurrentIndex(state.currentIndex)
                            setTotalCorrect(state.totalCorrect)
                            setTotalAnswered(state.totalAnswered)
                            if (state.answersMap) setAnswersMap(state.answersMap)
                        }
                    }
                } catch { }

                // For daily, find first unanswered if resuming
                if (testType === 'daily' && data.isResuming && data.phase.questions) {
                    const firstUnanswered = data.phase.questions.findIndex(
                        (q: MCQQuestion) => !q.student_answer
                    )
                    if (firstUnanswered >= 0) {
                        setCurrentIndex(firstUnanswered)
                        setTotalAnswered(firstUnanswered)
                        setTotalCorrect(
                            data.phase.questions.filter((q: MCQQuestion) => q.is_correct).length
                        )
                    }
                }

                setScreen('start')
            }
        } catch (err) {
            console.error('Init error:', err)
            setScreen('no-topics')
        }
    }

    // ─── Timer for per-question timing ──────────────────

    const startTimer = useCallback(() => {
        startTimeRef.current = Date.now()
        setQuestionTimer(0)
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = setInterval(() => {
            setQuestionTimer(Math.floor((Date.now() - startTimeRef.current) / 1000))
        }, 1000)
    }, [])

    const stopTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
        return Math.floor((Date.now() - startTimeRef.current) / 1000)
    }, [])

    // ─── Countdown Timer (for timed tests) ──────────────

    function startCountdown() {
        if (!config.timeLimit) return
        const totalSeconds = config.timeLimit * 60
        setCountdownSeconds(totalSeconds)
        testStartTimeRef.current = Date.now()

        countdownRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - testStartTimeRef.current) / 1000)
            const remaining = totalSeconds - elapsed
            if (remaining <= 0) {
                setCountdownSeconds(0)
                if (countdownRef.current) clearInterval(countdownRef.current)
                // Auto-submit when timer expires
                handleAutoSubmit()
            } else {
                setCountdownSeconds(remaining)
            }
        }, 1000)
    }

    function formatCountdown(seconds: number | null): string {
        if (seconds === null) return ''
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    // ─── Submit Answer ──────────────────────────────────

    async function handleSubmitAnswer() {
        if (!selectedAnswer || !phase || submitting || isAnswered) return
        setSubmitting(true)
        setIsAnswered(true)

        const timeTaken = stopTimer()

        try {
            const res = await fetch('/api/brain/practice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phaseId: phase.phase_id,
                    questionIndex: currentIndex,
                    answer: selectedAnswer,
                    timeTaken,
                }),
            })

            const data = await res.json()

            // Store answer in map for review
            setAnswersMap(prev => ({ ...prev, [currentIndex]: selectedAnswer }))

            if (testType === 'daily') {
                // Daily: show feedback immediately
                setFeedbackData({
                    isCorrect: data.isCorrect,
                    correctAnswer: data.correctAnswer,
                    explanation: data.explanation,
                })

                // Haptic feedback
                if (data.isCorrect) {
                    vibrate(100)
                } else {
                    vibrate([50, 100, 50])
                }

                // Auto-advance after 2s on correct
                if (data.isCorrect) {
                    autoAdvanceRef.current = setTimeout(() => {
                        handleNext()
                    }, 2000)
                }
            } else {
                // Weekly/Lesson: no immediate feedback, auto-advance
                vibrate(50)

                // Auto-advance to next question
                if (currentIndex < phase.questions.length - 1) {
                    setTimeout(() => {
                        setCurrentIndex(prev => prev + 1)
                        setSelectedAnswer(null)
                        setIsAnswered(false)
                        startTimer()
                    }, 300)
                }
            }

            setTotalAnswered(data.progress.answered)
            setTotalCorrect(data.progress.correct)
        } catch (err) {
            console.error('Submit error:', err)
            setIsAnswered(false)
        } finally {
            setSubmitting(false)
        }
    }

    // ─── Auto-submit when answer selected (daily only) ──
    useEffect(() => {
        if (testType === 'daily' && selectedAnswer && !isAnswered && !submitting && screen === 'quiz') {
            handleSubmitAnswer()
        }
    }, [selectedAnswer])

    // ─── Next Question / Complete ───────────────────────

    async function handleNext() {
        if (autoAdvanceRef.current) {
            clearTimeout(autoAdvanceRef.current)
            autoAdvanceRef.current = null
        }

        if (!phase) return

        if (currentIndex >= phase.questions.length - 1) {
            // Last question → complete the phase
            if (testType !== 'daily') {
                // For weekly/lesson, show submit confirmation
                setShowSubmitDialog(true)
                return
            }
            await completePhase()
        } else {
            // Move to next question
            setCurrentIndex(currentIndex + 1)
            setSelectedAnswer(null)
            setIsAnswered(false)
            setFeedbackData(null)
            startTimer()
        }
    }

    async function handleAutoSubmit() {
        // Called when timer expires
        vibrate([100, 50, 100, 50, 200])
        await completePhase()
    }

    async function completePhase() {
        if (!phase) return
        setScreen('loading')

        try {
            // Clear localStorage and countdown
            try { localStorage.removeItem(STORAGE_KEY) } catch { }
            if (countdownRef.current) clearInterval(countdownRef.current)

            const res = await fetch('/api/brain/practice', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phaseId: phase.phase_id }),
            })
            const data = await res.json()
            setResultScores(data.scores)
            setPhase(data.phase)
            setScreen('results')
        } catch (err) {
            console.error('Complete error:', err)
            setScreen('results')
        }
    }

    // ─── Navigate in review mode (weekly/lesson) ────────

    function goToQuestion(index: number) {
        if (!phase || index < 0 || index >= phase.questions.length) return
        setCurrentIndex(index)

        // Check if user already answered this question
        const q = phase.questions[index]
        if (q.student_answer || answersMap[index]) {
            setSelectedAnswer(q.student_answer || answersMap[index])
            setIsAnswered(true)
        } else {
            setSelectedAnswer(null)
            setIsAnswered(false)
        }
        setFeedbackData(null)
        startTimer()
    }

    // ─── Screens ────────────────────────────────────────

    const currentQuestion = phase?.questions[currentIndex]
    const isTimedTest = config.showTimer

    // Loading
    if (screen === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950">
                <div className="text-center">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-full border-4 border-indigo-500/30 border-t-indigo-400 animate-spin mx-auto" />
                        <Brain className="w-8 h-8 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="mt-6 text-indigo-300 text-lg font-medium animate-pulse">
                        Brain is thinking...
                    </p>
                </div>
            </div>
        )
    }

    // No topics
    if (screen === 'no-topics') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 p-6">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                        <Brain className="w-10 h-10 text-indigo-400/50" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">No {config.title} Available</h2>
                    <p className="text-purple-300/70 mb-6">
                        {testType === 'daily'
                            ? "Your teachers haven't uploaded any syllabus content yet. Once topics are added, your daily practice will appear here!"
                            : testType === 'weekly'
                                ? "No weekly test has been generated yet. Weekly tests are created every Sunday."
                                : "No lesson test is available. Lesson tests are created when your teacher completes a lesson."
                        }
                    </p>
                    <button
                        onClick={() => router.push('/dashboard/student')}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-colors"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        )
    }

    // Already completed
    if (screen === 'completed') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 p-6">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-10 h-10 text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        {testType === 'daily' ? "Today's Practice Done! 🎉" : `${config.title} Complete! 🎉`}
                    </h2>
                    <p className="text-purple-300/70 mb-2">
                        {testType === 'daily'
                            ? "You've already completed today's daily practice. Come back tomorrow!"
                            : `You've already completed this ${config.title.toLowerCase()}.`
                        }
                    </p>
                    <div className="flex items-center justify-center gap-8 mt-6 mb-8">
                        <StreakDisplay streak={activityData.dailyStreak} longestStreak={activityData.longestStreak} size="md" />
                        <div className="text-center">
                            <Zap className="w-8 h-8 text-yellow-400 mx-auto" />
                            <p className="text-2xl font-bold text-white mt-1">{activityData.activityScore}</p>
                            <p className="text-xs text-purple-300/60">Points</p>
                        </div>
                    </div>
                    <button
                        onClick={() => router.push('/dashboard/student')}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-colors"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        )
    }

    // Start Screen
    if (screen === 'start') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 flex flex-col">
                {/* Header */}
                <header className="p-4">
                    <button
                        onClick={() => router.push('/dashboard/student')}
                        className="flex items-center gap-2 text-purple-300 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="text-sm">Dashboard</span>
                    </button>
                </header>

                {/* Content */}
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                    {/* Icon */}
                    <div className="relative mb-8">
                        <div className={`w-28 h-28 bg-gradient-to-br ${config.gradient} rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/30`}>
                            <span className="text-5xl">{config.icon}</span>
                        </div>
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                            {phase?.questions.length || config.questions}
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold text-white mb-2">{config.title}</h1>
                    <p className="text-purple-300/70 text-center mb-8 max-w-xs">
                        {phase?.questions.length || config.questions} {config.subtitle}
                    </p>

                    {/* Stats Row */}
                    <div className="flex items-center gap-8 mb-10">
                        <StreakDisplay streak={activityData.dailyStreak} longestStreak={activityData.longestStreak} size="md" />
                        <div className="text-center">
                            <div className="w-14 h-14 bg-yellow-500/20 rounded-2xl flex items-center justify-center mx-auto mb-2">
                                <Zap className="w-7 h-7 text-yellow-400" />
                            </div>
                            <p className="text-lg font-bold text-white">{activityData.activityScore}</p>
                            <p className="text-xs text-purple-300/60">Points</p>
                        </div>
                        <div className="text-center">
                            <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-2">
                                <Target className="w-7 h-7 text-indigo-400" />
                            </div>
                            <p className="text-lg font-bold text-white">{phase?.weak_topic_count || 0}/{phase?.strong_topic_count || 0}</p>
                            <p className="text-xs text-purple-300/60">Weak/Strong</p>
                        </div>
                    </div>

                    {/* Info Cards */}
                    <div className="w-full max-w-sm space-y-3 mb-10">
                        {config.timeLimit && (
                            <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                                <Timer className="w-5 h-5 text-amber-400 shrink-0" />
                                <p className="text-sm text-amber-200">
                                    Time Limit: <span className="font-bold">{config.timeLimit} minutes</span>
                                </p>
                            </div>
                        )}
                        <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                            <Clock className="w-5 h-5 text-indigo-400 shrink-0" />
                            <p className="text-sm text-purple-200">
                                {config.timeLimit ? `${config.timeLimit} minutes to complete` : 'Takes about 5-10 minutes'}
                            </p>
                        </div>
                        <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                            <Sparkles className="w-5 h-5 text-yellow-400 shrink-0" />
                            <p className="text-sm text-purple-200">+{config.points} activity points on completion</p>
                        </div>
                        <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                            <Brain className="w-5 h-5 text-indigo-400 shrink-0" />
                            <p className="text-sm text-purple-200">60% from topics that need practice</p>
                        </div>
                        {config.allowReview && (
                            <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                                <BookOpen className="w-5 h-5 text-green-400 shrink-0" />
                                <p className="text-sm text-purple-200">You can go back and change answers</p>
                            </div>
                        )}
                    </div>

                    {/* Start Button */}
                    <button
                        onClick={() => {
                            vibrate(50)
                            setScreen('quiz')
                            startTimer()
                            if (isTimedTest) startCountdown()
                        }}
                        className={`w-full max-w-sm py-4 bg-gradient-to-r ${config.gradient} hover:opacity-90 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-500/25 transition-all active:scale-[0.98]`}
                    >
                        {isTimedTest ? `Start ${config.title} →` : 'Start Practice →'}
                    </button>
                </div>
            </div>
        )
    }

    // Quiz Screen
    if (screen === 'quiz' && currentQuestion) {
        const progress = ((totalAnswered) / (phase?.questions.length || 1)) * 100
        const isLastQuestion = currentIndex >= (phase?.questions.length || 1) - 1
        const unansweredCount = (phase?.questions.length || 0) - totalAnswered
        const isTimerLow = countdownSeconds !== null && countdownSeconds <= 60

        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 flex flex-col">
                {/* Top Bar */}
                <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-purple-300 text-sm font-medium">
                            Q{currentIndex + 1}/{phase?.questions.length}
                        </span>

                        {/* Countdown timer for timed tests */}
                        {isTimedTest && countdownSeconds !== null ? (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isTimerLow
                                ? 'bg-red-500/20 border border-red-500/30'
                                : 'bg-white/10'
                                }`}>
                                <Timer className={`w-4 h-4 ${isTimerLow ? 'text-red-400 animate-pulse' : 'text-purple-300'}`} />
                                <span className={`text-sm font-mono font-bold ${isTimerLow ? 'text-red-400' : 'text-white'}`}>
                                    {formatCountdown(countdownSeconds)}
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-purple-300">
                                <Clock className="w-4 h-4" />
                                <span className="text-sm font-mono">{questionTimer}s</span>
                            </div>
                        )}

                        <div className="flex items-center gap-1.5">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span className="text-sm text-green-400 font-medium">{totalCorrect}</span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${isTimedTest
                                ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                                : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                                }`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    {/* Question Navigator for review mode (weekly/lesson) */}
                    {config.allowReview && (
                        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                            {phase?.questions.map((q, idx) => {
                                const isAnsweredQ = !!q.student_answer || !!answersMap[idx]
                                const isCurrent = idx === currentIndex
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => goToQuestion(idx)}
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-all ${isCurrent
                                            ? 'bg-indigo-500 text-white scale-110 shadow-lg shadow-indigo-500/30'
                                            : isAnsweredQ
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                : 'bg-white/5 text-purple-400/50 border border-white/5'
                                            }`}
                                    >
                                        {idx + 1}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Question Card */}
                <div className="flex-1 flex flex-col p-4">
                    <QuizCard
                        questionNumber={currentIndex + 1}
                        totalQuestions={phase?.questions.length || 0}
                        questionText={currentQuestion.question_text}
                        options={currentQuestion.options}
                        difficulty={currentQuestion.difficulty}
                        selectedAnswer={selectedAnswer}
                        isAnswered={testType === 'daily' ? isAnswered : false}
                        correctAnswer={testType === 'daily' ? feedbackData?.correctAnswer : undefined}
                        onSelectAnswer={(answer) => {
                            if (testType === 'daily' && isAnswered) return
                            setSelectedAnswer(answer)
                            if (testType !== 'daily') {
                                setIsAnswered(false) // Allow re-selection
                            }
                        }}
                        disabled={submitting}
                    />

                    {/* Daily: Feedback area */}
                    {testType === 'daily' && isAnswered && feedbackData && (
                        <div className={`mt-4 p-4 rounded-xl border ${feedbackData.isCorrect
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-red-500/10 border-red-500/30'
                            }`}>
                            <div className="flex items-center gap-2 mb-1">
                                {feedbackData.isCorrect ? (
                                    <CheckCircle className="w-5 h-5 text-green-400" />
                                ) : (
                                    <XCircle className="w-5 h-5 text-red-400" />
                                )}
                                <span className={`font-semibold ${feedbackData.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                    {feedbackData.isCorrect ? 'Correct!' : 'Incorrect'}
                                </span>
                            </div>
                            {!feedbackData.isCorrect && (
                                <p className="text-sm text-purple-300 mt-1">
                                    Answer: <span className="font-bold text-white">{feedbackData.correctAnswer}</span>
                                </p>
                            )}
                            {feedbackData.explanation && (
                                <p className="text-sm text-purple-200/70 mt-2">{feedbackData.explanation}</p>
                            )}
                        </div>
                    )}

                    {/* Daily: Next Button */}
                    {testType === 'daily' && isAnswered && (
                        <button
                            onClick={handleNext}
                            className="w-full py-4 mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-500/25 transition-all active:scale-[0.98]"
                        >
                            {isLastQuestion ? 'See Results →' : (
                                feedbackData?.isCorrect ? (
                                    <span className="flex items-center justify-center gap-2">
                                        Next <span className="text-sm font-normal opacity-70">(auto in 2s)</span>
                                    </span>
                                ) : 'Next Question →'
                            )}
                        </button>
                    )}

                    {/* Weekly/Lesson: Submit & Navigation Buttons */}
                    {testType !== 'daily' && (
                        <div className="mt-4 space-y-3">
                            {/* Submit answer button */}
                            {selectedAnswer && !answersMap[currentIndex] && (
                                <button
                                    onClick={handleSubmitAnswer}
                                    disabled={submitting}
                                    className={`w-full py-4 bg-gradient-to-r ${config.gradient} hover:opacity-90 text-white rounded-2xl font-bold text-lg shadow-xl transition-all active:scale-[0.98] disabled:opacity-50`}
                                >
                                    {submitting ? (
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                                    ) : (
                                        'Confirm Answer'
                                    )}
                                </button>
                            )}

                            {/* Navigation */}
                            <div className="flex gap-3">
                                {currentIndex > 0 && (
                                    <button
                                        onClick={() => goToQuestion(currentIndex - 1)}
                                        className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                                    >
                                        <ChevronLeft className="w-5 h-5" /> Previous
                                    </button>
                                )}
                                {!isLastQuestion && (
                                    <button
                                        onClick={() => goToQuestion(currentIndex + 1)}
                                        className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                                    >
                                        Next <ChevronRight className="w-5 h-5" />
                                    </button>
                                )}
                            </div>

                            {/* Finish Test Button */}
                            <button
                                onClick={() => setShowSubmitDialog(true)}
                                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-purple-300 hover:text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                            >
                                <CheckCircle className="w-5 h-5" />
                                Finish Test ({totalAnswered}/{phase?.questions.length} answered)
                            </button>
                        </div>
                    )}
                </div>

                {/* Submit Confirmation Dialog */}
                {showSubmitDialog && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
                        <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                            <div className="text-center mb-4">
                                <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                                <h3 className="text-xl font-bold text-white mb-2">Submit {config.title}?</h3>
                                <p className="text-purple-300/70 text-sm">
                                    {unansweredCount > 0
                                        ? `You have ${unansweredCount} unanswered question${unansweredCount > 1 ? 's' : ''}. Are you sure you want to submit?`
                                        : 'You have answered all questions. Submit your test?'
                                    }
                                </p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-3 mb-4 flex items-center justify-between">
                                <span className="text-sm text-purple-300">Answered</span>
                                <span className="text-sm font-bold text-white">{totalAnswered}/{phase?.questions.length}</span>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowSubmitDialog(false)}
                                    className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl font-semibold transition-colors"
                                >
                                    Go Back
                                </button>
                                <button
                                    onClick={() => {
                                        setShowSubmitDialog(false)
                                        completePhase()
                                    }}
                                    className={`flex-1 py-3 bg-gradient-to-r ${config.gradient} text-white rounded-xl font-semibold transition-all hover:opacity-90`}
                                >
                                    Submit
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // Results Screen
    if (screen === 'results') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 flex flex-col">
                <ScoreScreen
                    totalCorrect={totalCorrect}
                    totalQuestions={phase?.questions.length || 0}
                    streak={resultScores?.daily_streak || activityData.dailyStreak + 1}
                    pointsEarned={config.points}
                    message={testType !== 'daily'
                        ? `${config.title} complete! +${config.points} activity points earned.`
                        : undefined
                    }
                    onBack={() => router.push('/dashboard/student')}
                />
            </div>
        )
    }

    // Fallback
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950">
            <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
        </div>
    )
}

export default function PracticePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950">
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
            </div>
        }>
            <PracticePageInner />
        </Suspense>
    )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Brain, Calendar, BookOpen, CheckCircle,
    Loader2, Clock, Zap, Target, XCircle, ChevronRight,
    Flame, Star, FileText, AlertCircle, Timer, Award
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────

interface MCQQuestion {
    question_id: string
    topic_id: string
    question_text: string
    options: string[]
    difficulty: string
    type: string
    format: string
}

interface HomeworkQuestion {
    question_id: string
    question_text: string
    difficulty: string
    type: string
    format: string
}

interface DailyWork {
    work_id: string
    work_date: string
    mcq_questions: MCQQuestion[]
    mcq_count: number
    homework_questions: HomeworkQuestion[]
    homework_count: number
    status: string
}

interface StudentResponse {
    response_id: string
    mcq_answers: any[]
    mcq_score: number
    mcq_total: number
    mcq_completed: boolean
    mcq_completed_at: string | null
    mcq_time_seconds: number
    homework_viewed: boolean
}

interface SubmitResult {
    is_correct: boolean
    correct_answer: string
    explanation: string
    progress: {
        answered: number
        total: number
        correct: number
        score_percentage: number
    }
}

type ViewState = 'loading' | 'no_work' | 'mcq_ready' | 'mcq_active' | 'mcq_done' | 'homework'

// ─── Component ───────────────────────────────────────────

export default function StudentDailyWorkPage() {
    const { goBack, router } = useSmartBack('/dashboard/student')
    const [viewState, setViewState] = useState<ViewState>('loading')
    const [studentId, setStudentId] = useState('')

    // Data
    const [dailyWork, setDailyWork] = useState<DailyWork | null>(null)
    const [response, setResponse] = useState<StudentResponse | null>(null)
    const [currentQuestion, setCurrentQuestion] = useState(0)
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
    const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [showResult, setShowResult] = useState(false)

    // Timer
    const [startTime] = useState(Date.now())
    const [questionStartTime, setQuestionStartTime] = useState(Date.now())
    const [elapsedSeconds, setElapsedSeconds] = useState(0)

    // Score tracking
    const [answeredCount, setAnsweredCount] = useState(0)
    const [correctCount, setCorrectCount] = useState(0)

    useEffect(() => {
        loadStudentWork()
    }, [])

    // Timer tick
    useEffect(() => {
        if (viewState !== 'mcq_active') return
        const interval = setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000))
        }, 1000)
        return () => clearInterval(interval)
    }, [viewState, startTime])

    // ─── Load Data ───────────────────────────────────────

    async function loadStudentWork() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return }

            const { data: user } = await supabase
                .from('users')
                .select('user_id, role, class_id')
                .eq('email', session.user.email)
                .single()

            if (!user || user.role !== 'student' || !user.class_id) {
                router.replace('/dashboard/redirect')
                return
            }

            setStudentId(user.user_id)
            const today = new Date().toISOString().split('T')[0]

            // Fetch today's daily work for this student's class
            const res = await fetch(`/api/brain/work/daily?class_id=${user.class_id}&date=${today}`)
            const data = await res.json()

            if (!data.works || data.works.length === 0) {
                setViewState('no_work')
                return
            }

            // Get the first published work
            const publishedWork = data.works.find((w: DailyWork) => w.status === 'published' || w.status === 'completed')
            if (!publishedWork) {
                setViewState('no_work')
                return
            }

            // Fetch student-specific view with response
            const detailRes = await fetch(`/api/brain/work/daily?work_id=${publishedWork.work_id}&student_id=${user.user_id}`)
            const detailData = await detailRes.json()

            setDailyWork(detailData.work)
            setResponse(detailData.response)

            if (detailData.response?.mcq_completed) {
                setAnsweredCount(detailData.response.mcq_total)
                setCorrectCount(detailData.response.mcq_score)
                setViewState('mcq_done')
            } else {
                const answeredSoFar = (detailData.response?.mcq_answers || []).length
                const correctSoFar = (detailData.response?.mcq_answers || []).filter((a: any) => a.is_correct).length
                setAnsweredCount(answeredSoFar)
                setCorrectCount(correctSoFar)
                setCurrentQuestion(answeredSoFar)
                setViewState('mcq_ready')
            }
        } catch (error) {
            console.error('Error loading student work:', error)
            setViewState('no_work')
        }
    }

    // ─── MCQ Interaction ─────────────────────────────────

    function handleStartMCQ() {
        setViewState('mcq_active')
        setQuestionStartTime(Date.now())
    }

    async function handleSubmitAnswer() {
        if (!dailyWork || !selectedAnswer || submitting) return

        setSubmitting(true)
        const question = dailyWork.mcq_questions[currentQuestion]
        const timeTaken = Math.floor((Date.now() - questionStartTime) / 1000)

        try {
            const res = await fetch('/api/brain/work/daily/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    work_id: dailyWork.work_id,
                    student_id: studentId,
                    question_id: question.question_id,
                    student_answer: selectedAnswer,
                    time_taken_seconds: timeTaken,
                }),
            })

            const data = await res.json()
            setSubmitResult(data)
            setShowResult(true)
            setAnsweredCount(data.progress?.answered || answeredCount + 1)
            setCorrectCount(data.progress?.correct || correctCount)
        } catch (error) {
            console.error('Error submitting answer:', error)
        } finally {
            setSubmitting(false)
        }
    }

    function handleNextQuestion() {
        setShowResult(false)
        setSelectedAnswer(null)
        setSubmitResult(null)

        if (currentQuestion + 1 >= (dailyWork?.mcq_questions.length || 0)) {
            // All questions answered — complete the session
            handleCompleteMCQ()
        } else {
            setCurrentQuestion(prev => prev + 1)
            setQuestionStartTime(Date.now())
        }
    }

    async function handleCompleteMCQ() {
        if (!dailyWork) return

        try {
            const totalTime = Math.floor((Date.now() - startTime) / 1000)
            await fetch('/api/brain/work/daily/submit', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    work_id: dailyWork.work_id,
                    student_id: studentId,
                    total_time_seconds: totalTime,
                }),
            })
            setViewState('mcq_done')
        } catch (error) {
            console.error('Error completing MCQ:', error)
            setViewState('mcq_done')
        }
    }

    // ─── Helpers ─────────────────────────────────────────

    function formatTime(seconds: number): string {
        const min = Math.floor(seconds / 60)
        const sec = seconds % 60
        return `${min}:${sec.toString().padStart(2, '0')}`
    }

    const scorePercentage = (dailyWork?.mcq_questions.length || 1) > 0
        ? Math.round((correctCount / (dailyWork?.mcq_questions.length || 1)) * 100)
        : 0

    const difficultyBadge: Record<string, string> = {
        easy: 'bg-green-500/15 text-green-400',
        medium: 'bg-yellow-500/15 text-yellow-400',
        hard: 'bg-red-500/15 text-red-400',
    }

    // ─── Render States ───────────────────────────────────

    if (viewState === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <Brain className="w-14 h-14 text-emerald-400 mx-auto mb-3 animate-pulse" />
                    <Loader2 className="w-8 h-8 text-emerald-400 mx-auto animate-spin" />
                    <p className="text-gray-400 mt-3 text-sm">Loading today&apos;s work...</p>
                </div>
            </div>
        )
    }

    if (viewState === 'no_work') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                    <Calendar className="w-16 h-16 text-gray-500/40 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">No Daily Work Today</h2>
                    <p className="text-gray-400 mb-6">Your teacher hasn&apos;t published daily work yet. Check back later!</p>
                    <button
                        onClick={goBack}
                        className="px-6 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/15 transition-colors"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        )
    }

    // ─── MCQ Ready (Start Screen) ────────────────────────

    if (viewState === 'mcq_ready') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-6">
                <div className="w-full max-w-md">
                    <div className="bg-white/5 rounded-2xl border border-white/10 p-8 text-center">
                        <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
                            <Brain className="w-10 h-10 text-white" />
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-2">Daily Practice</h2>
                        <p className="text-gray-400 mb-6">
                            {dailyWork?.mcq_count || 10} multiple choice questions
                        </p>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="bg-white/5 rounded-xl p-3">
                                <Target className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                                <p className="text-white font-bold">{dailyWork?.mcq_count || 10}</p>
                                <p className="text-[10px] text-gray-500">Questions</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-3">
                                <Clock className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                                <p className="text-white font-bold">~5 min</p>
                                <p className="text-[10px] text-gray-500">Estimated</p>
                            </div>
                        </div>

                        {answeredCount > 0 && (
                            <p className="text-amber-400 text-sm mb-4">
                                You already answered {answeredCount} questions. Continue from Q{answeredCount + 1}.
                            </p>
                        )}

                        <button
                            onClick={handleStartMCQ}
                            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl font-bold text-white hover:shadow-lg hover:shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 text-lg"
                        >
                            <Zap className="w-5 h-5" />
                            {answeredCount > 0 ? 'Continue' : 'Start Practice'}
                        </button>
                    </div>

                    {/* Homework teaser */}
                    {dailyWork && dailyWork.homework_count > 0 && (
                        <button
                            onClick={() => setViewState('homework')}
                            className="w-full mt-4 bg-white/5 rounded-xl border border-white/10 p-4 flex items-center justify-between hover:bg-white/[0.07] transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-blue-400" />
                                <div className="text-left">
                                    <p className="text-white font-medium text-sm">Homework ({dailyWork.homework_count})</p>
                                    <p className="text-[10px] text-gray-400">View questions, write answers in notebook</p>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                        </button>
                    )}
                </div>
            </div>
        )
    }

    // ─── MCQ Active (Quiz in Progress) ───────────────────

    if (viewState === 'mcq_active' && dailyWork) {
        const question = dailyWork.mcq_questions[currentQuestion]
        const totalQuestions = dailyWork.mcq_questions.length

        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
                {/* Top Bar */}
                <div className="bg-white/5 border-b border-white/10 px-4 py-3">
                    <div className="max-w-lg mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-emerald-400 font-bold text-sm">
                                Q{currentQuestion + 1}/{totalQuestions}
                            </span>
                            <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                                    style={{ width: `${((currentQuestion + 1) / totalQuestions) * 100}%` }}
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-emerald-300 text-sm font-medium">
                                {correctCount}/{answeredCount} ✓
                            </span>
                            <span className="flex items-center gap-1 text-gray-400 text-sm">
                                <Timer className="w-3.5 h-3.5" />
                                {formatTime(elapsedSeconds)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Question */}
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="w-full max-w-lg">
                        {!showResult ? (
                            <>
                                {/* Question card */}
                                <div className="bg-white/5 rounded-2xl border border-white/10 p-6 mb-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${difficultyBadge[question?.difficulty] || difficultyBadge.medium}`}>
                                            {question?.difficulty?.toUpperCase()}
                                        </span>
                                        <span className="text-[10px] text-gray-500">
                                            {question?.type}
                                        </span>
                                    </div>
                                    <p className="text-white text-lg font-medium leading-relaxed">
                                        {question?.question_text}
                                    </p>
                                </div>

                                {/* Options */}
                                <div className="space-y-3 mb-6">
                                    {(question?.options || []).map((opt, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedAnswer(opt)}
                                            className={`w-full text-left px-5 py-4 rounded-xl border transition-all ${selectedAnswer === opt
                                                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-500/10'
                                                : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/[0.07] hover:border-white/20'
                                                }`}
                                        >
                                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold mr-3 ${selectedAnswer === opt
                                                ? 'bg-emerald-500 text-white'
                                                : 'bg-white/10 text-gray-400'
                                                }`}>
                                                {String.fromCharCode(65 + idx)}
                                            </span>
                                            {opt}
                                        </button>
                                    ))}
                                </div>

                                {/* Submit */}
                                <button
                                    onClick={handleSubmitAnswer}
                                    disabled={!selectedAnswer || submitting}
                                    className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl font-bold text-white hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <CheckCircle className="w-5 h-5" />
                                            Submit Answer
                                        </>
                                    )}
                                </button>
                            </>
                        ) : (
                            /* ─── Result Screen ─── */
                            <div className="text-center">
                                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${submitResult?.is_correct
                                    ? 'bg-emerald-500/20 border-2 border-emerald-500/50'
                                    : 'bg-red-500/20 border-2 border-red-500/50'
                                    }`}>
                                    {submitResult?.is_correct ? (
                                        <CheckCircle className="w-10 h-10 text-emerald-400" />
                                    ) : (
                                        <XCircle className="w-10 h-10 text-red-400" />
                                    )}
                                </div>

                                <h3 className={`text-2xl font-bold mb-2 ${submitResult?.is_correct ? 'text-emerald-400' : 'text-red-400'
                                    }`}>
                                    {submitResult?.is_correct ? 'Correct!' : 'Incorrect'}
                                </h3>

                                {!submitResult?.is_correct && (
                                    <p className="text-gray-300 mb-2">
                                        Correct answer: <span className="text-emerald-400 font-medium">{submitResult?.correct_answer}</span>
                                    </p>
                                )}

                                {submitResult?.explanation && (
                                    <div className="bg-white/5 rounded-xl p-4 text-left mb-6 border border-white/10">
                                        <p className="text-sm text-gray-300">{submitResult.explanation}</p>
                                    </div>
                                )}

                                <div className="flex items-center justify-center gap-4 mb-6 text-sm">
                                    <span className="text-emerald-400">
                                        {submitResult?.progress?.correct}/{submitResult?.progress?.total} correct
                                    </span>
                                    <span className="text-gray-500">•</span>
                                    <span className="text-blue-400">
                                        {submitResult?.progress?.score_percentage}%
                                    </span>
                                </div>

                                <button
                                    onClick={handleNextQuestion}
                                    className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl font-bold text-white hover:shadow-lg transition-all flex items-center justify-center gap-2"
                                >
                                    {currentQuestion + 1 >= (dailyWork?.mcq_questions.length || 0) ? (
                                        <>
                                            <Award className="w-5 h-5" />
                                            Finish &amp; See Results
                                        </>
                                    ) : (
                                        <>
                                            <ChevronRight className="w-5 h-5" />
                                            Next Question
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // ─── MCQ Done (Score Screen) ─────────────────────────

    if (viewState === 'mcq_done') {
        const grade = scorePercentage >= 90 ? 'A+' : scorePercentage >= 80 ? 'A' : scorePercentage >= 70 ? 'B' : scorePercentage >= 60 ? 'C' : scorePercentage >= 50 ? 'D' : 'F'
        const gradeColor = scorePercentage >= 80 ? 'text-emerald-400' : scorePercentage >= 60 ? 'text-yellow-400' : 'text-red-400'

        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-6">
                <div className="w-full max-w-md text-center">
                    <div className="bg-white/5 rounded-2xl border border-white/10 p-8">
                        {/* Score circle */}
                        <div className="relative w-32 h-32 mx-auto mb-6">
                            <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                                <circle
                                    cx="60" cy="60" r="50"
                                    fill="none"
                                    stroke={scorePercentage >= 80 ? '#10b981' : scorePercentage >= 60 ? '#eab308' : '#ef4444'}
                                    strokeWidth="8"
                                    strokeLinecap="round"
                                    strokeDasharray={`${(scorePercentage / 100) * 314} 314`}
                                    className="transition-all duration-1000"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className={`text-3xl font-bold ${gradeColor}`}>{scorePercentage}%</span>
                                <span className={`text-xs font-bold ${gradeColor}`}>{grade}</span>
                            </div>
                        </div>

                        <h2 className="text-xl font-bold text-white mb-1">Practice Complete!</h2>
                        <p className="text-gray-400 text-sm mb-6">
                            {correctCount} out of {dailyWork?.mcq_count || 10} correct
                        </p>

                        <div className="grid grid-cols-3 gap-3 mb-6">
                            <div className="bg-white/5 rounded-xl p-3">
                                <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                                <p className="text-white font-bold">{correctCount}</p>
                                <p className="text-[10px] text-gray-500">Correct</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-3">
                                <XCircle className="w-4 h-4 text-red-400 mx-auto mb-1" />
                                <p className="text-white font-bold">{(dailyWork?.mcq_count || 10) - correctCount}</p>
                                <p className="text-[10px] text-gray-500">Wrong</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-3">
                                <Clock className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                                <p className="text-white font-bold">{formatTime(response?.mcq_time_seconds || elapsedSeconds)}</p>
                                <p className="text-[10px] text-gray-500">Time</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-2 mb-6 text-sm">
                            <Flame className="w-4 h-4 text-orange-400" />
                            <span className="text-orange-300 font-medium">+15 activity points earned!</span>
                        </div>

                        {/* Homework link */}
                        {dailyWork && dailyWork.homework_count > 0 && (
                            <button
                                onClick={() => setViewState('homework')}
                                className="w-full mb-3 py-3 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-300 font-medium hover:bg-blue-600/30 transition-colors flex items-center justify-center gap-2"
                            >
                                <FileText className="w-4 h-4" />
                                View Homework ({dailyWork.homework_count} questions)
                            </button>
                        )}

                        <button
                            onClick={goBack}
                            className="w-full py-3 bg-white/10 border border-white/20 rounded-xl text-white font-medium hover:bg-white/15 transition-colors"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ─── Homework View ───────────────────────────────────

    if (viewState === 'homework' && dailyWork) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
                <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                    <div className="max-w-lg mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setViewState(response?.mcq_completed ? 'mcq_done' : 'mcq_ready')}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-blue-300" />
                            </button>
                            <div>
                                <h1 className="text-lg font-bold flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-blue-400" />
                                    Homework
                                </h1>
                                <p className="text-xs text-gray-400">Write answers in your notebook</p>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="max-w-lg mx-auto px-6 py-6 space-y-4">
                    <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-300">
                            Read the questions below and write your answers in your notebook. Your teacher will check them in class.
                        </p>
                    </div>

                    {dailyWork.homework_questions.map((q, idx) => (
                        <div key={q.question_id} className="bg-white/5 rounded-xl border border-white/10 p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="w-7 h-7 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center text-xs font-bold">
                                    {idx + 1}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${difficultyBadge[q.difficulty] || difficultyBadge.medium}`}>
                                    {q.difficulty?.toUpperCase()}
                                </span>
                                <span className="text-[10px] text-gray-500">
                                    {q.format?.replace('_', ' ')}
                                </span>
                            </div>
                            <p className="text-white leading-relaxed">{q.question_text}</p>
                        </div>
                    ))}

                    {dailyWork.homework_questions.length === 0 && (
                        <div className="text-center py-10">
                            <FileText className="w-12 h-12 text-gray-500/30 mx-auto mb-3" />
                            <p className="text-gray-400">No homework questions for today</p>
                        </div>
                    )}
                </main>
            </div>
        )
    }

    return null
}

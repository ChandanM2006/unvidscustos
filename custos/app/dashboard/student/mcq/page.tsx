'use client'

import { useEffect, useState } from 'react'
import { supabase, type User } from '@/lib/supabase'
import { useSmartBack } from '@/lib/navigation'
import {
    Target, ArrowLeft, Loader2, CheckCircle, XCircle, Timer
} from 'lucide-react'

interface MCQ {
    mcq_id: string
    question: string
    option_a: string
    option_b: string
    option_c: string
    option_d: string
    correct_answer: string
    topic?: { name: string }
}

export default function StudentMCQPage() {
    const { goBack, router } = useSmartBack('/dashboard/student')
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [mcqs, setMcqs] = useState<MCQ[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
    const [showResult, setShowResult] = useState(false)
    const [score, setScore] = useState(0)
    const [finished, setFinished] = useState(false)

    useEffect(() => {
        checkAuth()
    }, [])

    const checkAuth = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }

            const { data: userData } = await supabase
                .from('users')
                .select('*')
                .eq('email', session.user.email)
                .single()

            if (!userData || userData.role !== 'student') {
                router.push('/login')
                return
            }

            setUser(userData)
            await loadMCQs()
        } catch (error) {
            console.error('Auth error:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadMCQs = async () => {
        try {
            const { data } = await supabase
                .from('mcqs')
                .select('*, topic:topic_id(name)')
                .limit(10)

            if (data) setMcqs(data)
        } catch (error) {
            console.error('Error loading MCQs:', error)
        }
    }

    const handleAnswer = (answer: string) => {
        setSelectedAnswer(answer)
        setShowResult(true)
        if (answer === mcqs[currentIndex].correct_answer) {
            setScore(s => s + 1)
        }
    }

    const handleNext = () => {
        if (currentIndex < mcqs.length - 1) {
            setCurrentIndex(i => i + 1)
            setSelectedAnswer(null)
            setShowResult(false)
        } else {
            setFinished(true)
            // Save attempt
            if (user) {
                supabase.from('student_mcq_attempts').insert({
                    student_id: user.user_id,
                    score: score + (selectedAnswer === mcqs[currentIndex].correct_answer ? 1 : 0),
                    total_questions: mcqs.length
                })
            }
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-green-900 to-slate-900">
                <Loader2 className="w-12 h-12 text-green-400 animate-spin" />
            </div>
        )
    }

    const currentMCQ = mcqs[currentIndex]

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900 to-slate-900">
            {/* Header */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                <div className="max-w-3xl mx-auto flex items-center gap-4">
                    <button
                        onClick={goBack}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-green-300" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <Target className="w-6 h-6 text-purple-400" />
                            MCQ Practice
                        </h1>
                        <p className="text-sm text-green-300/70">Test your knowledge</p>
                    </div>
                    <div className="text-right">
                        <p className="text-white font-bold">{currentIndex + 1} / {mcqs.length}</p>
                        <p className="text-sm text-green-300/70">Questions</p>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-6">
                {mcqs.length === 0 ? (
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-12 text-center">
                        <Target className="w-16 h-16 mx-auto mb-4 text-green-300/50" />
                        <h3 className="text-xl font-bold text-white mb-2">No MCQs Available</h3>
                        <p className="text-green-300/70">Check back later when your teacher adds some practice questions.</p>
                    </div>
                ) : finished ? (
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-12 text-center">
                        <CheckCircle className="w-20 h-20 mx-auto mb-4 text-green-400" />
                        <h3 className="text-2xl font-bold text-white mb-2">Practice Complete!</h3>
                        <p className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400 my-4">
                            {score} / {mcqs.length}
                        </p>
                        <p className="text-green-300/70 mb-6">
                            {score >= mcqs.length * 0.8 ? 'Excellent work!' : score >= mcqs.length * 0.5 ? 'Good job, keep practicing!' : 'Keep studying, you can do better!'}
                        </p>
                        <button
                            onClick={goBack}
                            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:opacity-90"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                ) : (
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
                        {/* Progress */}
                        <div className="mb-6">
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                                    style={{ width: `${((currentIndex + 1) / mcqs.length) * 100}%` }}
                                />
                            </div>
                        </div>

                        {/* Question */}
                        <div className="mb-6">
                            <p className="text-xs text-purple-400 mb-2">{currentMCQ.topic?.name || 'General'}</p>
                            <h2 className="text-xl font-semibold text-white">{currentMCQ.question}</h2>
                        </div>

                        {/* Options */}
                        <div className="space-y-3 mb-6">
                            {['A', 'B', 'C', 'D'].map((option) => {
                                const optionText = currentMCQ[`option_${option.toLowerCase()}` as keyof MCQ] as string
                                const isSelected = selectedAnswer === option
                                const isCorrect = option === currentMCQ.correct_answer

                                let bgClass = 'bg-white/5 border-white/10 hover:bg-white/10'
                                if (showResult) {
                                    if (isCorrect) bgClass = 'bg-green-500/20 border-green-500/50'
                                    else if (isSelected) bgClass = 'bg-red-500/20 border-red-500/50'
                                }

                                return (
                                    <button
                                        key={option}
                                        onClick={() => !showResult && handleAnswer(option)}
                                        disabled={showResult}
                                        className={`w-full p-4 rounded-xl border text-left flex items-center gap-4 transition-all ${bgClass}`}
                                    >
                                        <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white font-bold">
                                            {option}
                                        </span>
                                        <span className="text-white flex-1">{optionText}</span>
                                        {showResult && isCorrect && <CheckCircle className="w-5 h-5 text-green-400" />}
                                        {showResult && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-400" />}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Next Button */}
                        {showResult && (
                            <button
                                onClick={handleNext}
                                className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-semibold hover:opacity-90"
                            >
                                {currentIndex < mcqs.length - 1 ? 'Next Question' : 'Finish'}
                            </button>
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}

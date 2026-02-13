'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Brain, Play, Clock, Check, X, Trophy,
    Loader2, ChevronRight, Star, RefreshCw
} from 'lucide-react'

interface Quiz {
    generation_id: string
    topic_title: string
    subject_name: string
    mcq_type: string
    question_count: number
}

interface Question {
    id: number
    question: string
    options: Record<string, string>
    correct_answer: string
    explanation: string
    difficulty: string
}

export default function StudentMCQPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [student, setStudent] = useState<any>(null)
    const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([])

    // Quiz State
    const [activeQuiz, setActiveQuiz] = useState<any>(null)
    const [questions, setQuestions] = useState<Question[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({})
    const [showResult, setShowResult] = useState(false)
    const [quizStarted, setQuizStarted] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }

            const { data: userData } = await supabase
                .from('users')
                .select('*, classes(grade_level)')
                .eq('email', session.user.email)
                .single()

            if (!userData) {
                router.push('/login')
                return
            }

            setStudent(userData)
            const gradeLevel = userData.classes?.grade_level

            // Load available MCQ sets
            const { data: mcqData } = await supabase
                .from('mcq_generations')
                .select(`
                    generation_id,
                    mcq_type,
                    question_count,
                    questions,
                    lesson_topics (
                        topic_title,
                        syllabus_documents (
                            grade_level,
                            subjects (name)
                        )
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(20)

            if (mcqData) {
                const formatted = mcqData
                    .filter((m: any) => m.lesson_topics?.syllabus_documents?.grade_level === gradeLevel)
                    .map((m: any) => ({
                        generation_id: m.generation_id,
                        topic_title: m.lesson_topics?.topic_title || 'Unknown',
                        subject_name: m.lesson_topics?.syllabus_documents?.subjects?.name || 'Unknown',
                        mcq_type: m.mcq_type,
                        question_count: m.question_count || m.questions?.questions?.length || 0,
                        questions: m.questions?.questions || []
                    }))
                setAvailableQuizzes(formatted)
            }

        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    function startQuiz(quiz: any) {
        setActiveQuiz(quiz)
        setQuestions(quiz.questions || [])
        setCurrentIndex(0)
        setUserAnswers({})
        setShowResult(false)
        setQuizStarted(true)
    }

    function selectAnswer(questionId: number, answer: string) {
        setUserAnswers(prev => ({ ...prev, [questionId]: answer }))
    }

    function nextQuestion() {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1)
        }
    }

    function prevQuestion() {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1)
        }
    }

    function submitQuiz() {
        setShowResult(true)
    }

    function getScore() {
        let correct = 0
        questions.forEach(q => {
            if (userAnswers[q.id] === q.correct_answer) correct++
        })
        return { correct, total: questions.length, percentage: Math.round((correct / questions.length) * 100) }
    }

    function resetQuiz() {
        setActiveQuiz(null)
        setQuestions([])
        setCurrentIndex(0)
        setUserAnswers({})
        setShowResult(false)
        setQuizStarted(false)
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100">
                <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
            </div>
        )
    }

    // Quiz Result Screen
    if (showResult) {
        const score = getScore()
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                        <div className={`p-8 text-center ${score.percentage >= 70 ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
                                score.percentage >= 40 ? 'bg-gradient-to-r from-yellow-500 to-orange-600' :
                                    'bg-gradient-to-r from-red-500 to-pink-600'
                            } text-white`}>
                            <Trophy className="w-16 h-16 mx-auto mb-4" />
                            <h1 className="text-3xl font-bold mb-2">Quiz Complete!</h1>
                            <p className="text-5xl font-extrabold">{score.percentage}%</p>
                            <p className="mt-2 opacity-80">{score.correct} of {score.total} correct</p>
                        </div>

                        <div className="p-6 space-y-4">
                            <h3 className="font-bold text-gray-900">Review Answers</h3>
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                {questions.map((q, idx) => {
                                    const isCorrect = userAnswers[q.id] === q.correct_answer
                                    return (
                                        <div key={q.id} className={`p-3 rounded-lg ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                                            <div className="flex items-start gap-2">
                                                {isCorrect ? (
                                                    <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                                                ) : (
                                                    <X className="w-5 h-5 text-red-600 flex-shrink-0" />
                                                )}
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">Q{idx + 1}: {q.question}</p>
                                                    {!isCorrect && (
                                                        <p className="text-xs text-gray-600 mt-1">
                                                            Correct: {q.correct_answer}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={resetQuiz}
                                    className="flex-1 py-3 border border-gray-200 rounded-xl font-medium hover:bg-gray-50"
                                >
                                    Back to Quizzes
                                </button>
                                <button
                                    onClick={() => startQuiz(activeQuiz)}
                                    className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 flex items-center justify-center gap-2"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Retry
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Active Quiz Screen
    if (quizStarted && questions.length > 0) {
        const currentQ = questions[currentIndex]
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
                <div className="max-w-2xl mx-auto">
                    {/* Progress */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <button onClick={resetQuiz} className="text-purple-600 hover:underline text-sm">
                                ← Exit Quiz
                            </button>
                            <span className="text-sm text-gray-500">
                                Question {currentIndex + 1} of {questions.length}
                            </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-purple-600 transition-all"
                                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Question Card */}
                    <div className="bg-white rounded-2xl shadow-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${currentQ.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                    currentQ.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                                        'bg-yellow-100 text-yellow-700'
                                }`}>
                                {currentQ.difficulty}
                            </span>
                        </div>

                        <h2 className="text-xl font-bold text-gray-900 mb-6">{currentQ.question}</h2>

                        <div className="space-y-3">
                            {Object.entries(currentQ.options).map(([key, value]) => (
                                <button
                                    key={key}
                                    onClick={() => selectAnswer(currentQ.id, key)}
                                    className={`w-full p-4 rounded-xl text-left transition-all flex items-center gap-4 ${userAnswers[currentQ.id] === key
                                            ? 'bg-purple-100 border-2 border-purple-500'
                                            : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                                        }`}
                                >
                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${userAnswers[currentQ.id] === key
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-gray-200 text-gray-600'
                                        }`}>
                                        {key}
                                    </span>
                                    <span className="text-gray-900">{value}</span>
                                </button>
                            ))}
                        </div>

                        {/* Navigation */}
                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={prevQuestion}
                                disabled={currentIndex === 0}
                                className="px-6 py-3 border border-gray-200 rounded-xl font-medium disabled:opacity-50"
                            >
                                Previous
                            </button>
                            {currentIndex < questions.length - 1 ? (
                                <button
                                    onClick={nextQuestion}
                                    disabled={!userAnswers[currentQ.id]}
                                    className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50"
                                >
                                    Next
                                </button>
                            ) : (
                                <button
                                    onClick={submitQuiz}
                                    disabled={Object.keys(userAnswers).length < questions.length}
                                    className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50"
                                >
                                    Submit Quiz
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Question Navigator */}
                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                        {questions.map((q, idx) => (
                            <button
                                key={q.id}
                                onClick={() => setCurrentIndex(idx)}
                                className={`w-8 h-8 rounded-full text-sm font-medium ${idx === currentIndex
                                        ? 'bg-purple-600 text-white'
                                        : userAnswers[q.id]
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-gray-200 text-gray-600'
                                    }`}
                            >
                                {idx + 1}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    // Quiz Selection Screen
    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
            <header className="bg-white border-b shadow-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button onClick={() => router.push('/dashboard/student')} className="p-2 hover:bg-gray-100 rounded-lg">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Practice MCQs</h1>
                        <p className="text-sm text-gray-500">Test your knowledge</p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6 space-y-4">
                {availableQuizzes.length > 0 ? availableQuizzes.map(quiz => (
                    <button
                        key={quiz.generation_id}
                        onClick={() => startQuiz(quiz)}
                        className="w-full bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between text-left"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                                <Brain className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900">{quiz.topic_title}</p>
                                <p className="text-sm text-gray-500">
                                    {quiz.subject_name} • {quiz.question_count} questions
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${quiz.mcq_type === 'daily' ? 'bg-blue-100 text-blue-700' :
                                    quiz.mcq_type === 'weekly' ? 'bg-green-100 text-green-700' :
                                        'bg-orange-100 text-orange-700'
                                }`}>
                                {quiz.mcq_type}
                            </span>
                            <Play className="w-5 h-5 text-purple-600" />
                        </div>
                    </button>
                )) : (
                    <div className="bg-white rounded-xl p-8 text-center">
                        <Brain className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No quizzes available yet</p>
                    </div>
                )}
            </main>
        </div>
    )
}

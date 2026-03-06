'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Brain, Sparkles, Loader2, Check, X,
    RefreshCw, Download, ChevronDown, ChevronUp
} from 'lucide-react'

interface Topic {
    topic_id: string
    topic_title: string
    content: any
    syllabus_documents: {
        grade_level: number
        subjects: {
            name: string
        }
    }
}

interface MCQQuestion {
    id: number
    question: string
    options: Record<string, string>
    correct_answer: string
    explanation: string
    difficulty: string
    skill_tested: string
}

interface MCQGeneration {
    generation_id: string
    generation_number: number
    mcq_type: string
    questions: {
        questions: MCQQuestion[]
        metadata: any
    }
    created_at: string
}

export default function MCQGeneratorPage() {
    const { goBack } = useSmartBack('/dashboard/manage/topics')
    const params = useParams()
    const topicId = params.id as string

    const [topic, setTopic] = useState<Topic | null>(null)
    const [generations, setGenerations] = useState<MCQGeneration[]>([])
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)

    // Settings
    const [questionCount, setQuestionCount] = useState(10)
    const [mcqType, setMcqType] = useState<'daily' | 'weekly' | 'chapter'>('daily')
    const [difficultyMix, setDifficultyMix] = useState({ easy: 3, medium: 5, hard: 2 })

    // View
    const [selectedGeneration, setSelectedGeneration] = useState<MCQGeneration | null>(null)
    const [showAnswers, setShowAnswers] = useState<Record<number, boolean>>({})
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({})
    const [submitted, setSubmitted] = useState(false)

    useEffect(() => {
        if (topicId) {
            loadTopic()
            loadGenerations()
        }
    }, [topicId])

    async function loadTopic() {
        try {
            const { data, error } = await supabase
                .from('lesson_topics')
                .select(`
                    *,
                    syllabus_documents (
                        grade_level,
                        subjects (name)
                    )
                `)
                .eq('topic_id', topicId)
                .single()

            if (error) throw error
            const formatted = {
                ...data,
                syllabus_documents: {
                    ...data.syllabus_documents,
                    subjects: Array.isArray(data.syllabus_documents?.subjects)
                        ? data.syllabus_documents.subjects[0]
                        : data.syllabus_documents?.subjects
                }
            }
            setTopic(formatted)
        } catch (error) {
            console.error('Error loading topic:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadGenerations() {
        try {
            const { data, error } = await supabase
                .from('mcq_generations')
                .select('*')
                .eq('topic_id', topicId)
                .order('generation_number', { ascending: false })

            if (!error && data) {
                setGenerations(data)
                if (data.length > 0) setSelectedGeneration(data[0])
            }
        } catch (error) {
            console.log('No existing MCQs')
        }
    }

    async function generateMCQs() {
        if (!topic) return
        setGenerating(true)

        try {
            const payload = {
                topic_id: topicId,
                topic_title: topic.topic_title,
                topic_content: topic.content || {},
                question_count: questionCount,
                difficulty_mix: difficultyMix,
                mcq_type: mcqType
            }

            const response = await fetch('http://localhost:8000/api/mcq/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!response.ok) throw new Error('Generation failed')

            const result = await response.json()

            // Save to database
            const nextGenNumber = generations.length > 0
                ? Math.max(...generations.map(g => g.generation_number)) + 1
                : 1

            const { data: savedGen, error } = await supabase
                .from('mcq_generations')
                .insert({
                    topic_id: topicId,
                    generation_number: nextGenNumber,
                    mcq_type: mcqType,
                    question_count: questionCount,
                    questions: result,
                    difficulty_distribution: difficultyMix
                })
                .select()
                .single()

            if (error) throw error

            // Reload and select new generation
            loadGenerations()
            setSelectedGeneration(savedGen)
            setUserAnswers({})
            setSubmitted(false)

        } catch (error: any) {
            console.error('Error generating MCQs:', error)
            alert('Failed to generate MCQs: ' + error.message)
        } finally {
            setGenerating(false)
        }
    }

    function selectAnswer(questionId: number, answer: string) {
        if (submitted) return
        setUserAnswers(prev => ({ ...prev, [questionId]: answer }))
    }

    function submitQuiz() {
        setSubmitted(true)
    }

    function getScore(): { correct: number; total: number } {
        if (!selectedGeneration?.questions?.questions) return { correct: 0, total: 0 }

        const questions = selectedGeneration.questions.questions
        let correct = 0
        questions.forEach(q => {
            if (userAnswers[q.id] === q.correct_answer) correct++
        })
        return { correct, total: questions.length }
    }

    const score = getScore()

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        )
    }

    if (!topic) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Topic Not Found</h2>
                    <button onClick={goBack} className="text-purple-600 underline">Go Back</button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={goBack} className="p-2 hover:bg-white rounded-lg">
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-gray-900">MCQ Generator</h1>
                        <p className="text-gray-600">{topic.topic_title}</p>
                    </div>
                    <Brain className="w-10 h-10 text-purple-600" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Generator Settings */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Generate New Set</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                    <select
                                        value={mcqType}
                                        onChange={(e) => setMcqType(e.target.value as any)}
                                        className="w-full p-2 border rounded-lg"
                                    >
                                        <option value="daily">Daily Quiz</option>
                                        <option value="weekly">Weekly Test</option>
                                        <option value="chapter">Chapter End</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Questions</label>
                                    <input
                                        type="number"
                                        min="5" max="50"
                                        value={questionCount}
                                        onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                                        className="w-full p-2 border rounded-lg"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty Mix</label>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="w-16 text-sm text-green-600">Easy</span>
                                            <input
                                                type="number" min="0" max="20"
                                                value={difficultyMix.easy}
                                                onChange={(e) => setDifficultyMix(prev => ({ ...prev, easy: parseInt(e.target.value) }))}
                                                className="flex-1 p-1 border rounded text-center"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-16 text-sm text-yellow-600">Medium</span>
                                            <input
                                                type="number" min="0" max="20"
                                                value={difficultyMix.medium}
                                                onChange={(e) => setDifficultyMix(prev => ({ ...prev, medium: parseInt(e.target.value) }))}
                                                className="flex-1 p-1 border rounded text-center"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-16 text-sm text-red-600">Hard</span>
                                            <input
                                                type="number" min="0" max="20"
                                                value={difficultyMix.hard}
                                                onChange={(e) => setDifficultyMix(prev => ({ ...prev, hard: parseInt(e.target.value) }))}
                                                className="flex-1 p-1 border rounded text-center"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={generateMCQs}
                                    disabled={generating}
                                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50"
                                >
                                    {generating ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</>
                                    ) : (
                                        <><Sparkles className="w-5 h-5" /> Generate MCQs</>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Previous Generations */}
                        {generations.length > 0 && (
                            <div className="bg-white rounded-xl shadow-lg p-6">
                                <h3 className="font-semibold text-gray-900 mb-3">Previous Sets</h3>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {generations.map(gen => (
                                        <button
                                            key={gen.generation_id}
                                            onClick={() => {
                                                setSelectedGeneration(gen)
                                                setUserAnswers({})
                                                setSubmitted(false)
                                            }}
                                            className={`w-full p-3 rounded-lg text-left transition-all ${selectedGeneration?.generation_id === gen.generation_id
                                                ? 'bg-purple-100 border-purple-300 border-2'
                                                : 'bg-gray-50 hover:bg-gray-100'
                                                }`}
                                        >
                                            <p className="font-medium">Set #{gen.generation_number}</p>
                                            <p className="text-xs text-gray-500">
                                                {gen.mcq_type} • {gen.questions?.questions?.length || 0} questions
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Quiz Viewer */}
                    <div className="lg:col-span-2">
                        {selectedGeneration ? (
                            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                                <div className="p-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h2 className="text-xl font-bold">MCQ Set #{selectedGeneration.generation_number}</h2>
                                            <p className="text-purple-200">{selectedGeneration.mcq_type} quiz</p>
                                        </div>
                                        {submitted && (
                                            <div className="text-right">
                                                <p className="text-3xl font-bold">{score.correct}/{score.total}</p>
                                                <p className="text-sm">{Math.round((score.correct / score.total) * 100)}% correct</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto">
                                    {selectedGeneration.questions?.questions?.map((q, idx) => (
                                        <div key={q.id} className="border-b pb-4">
                                            <div className="flex items-start gap-3">
                                                <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${submitted
                                                    ? userAnswers[q.id] === q.correct_answer
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-red-100 text-red-700'
                                                    : 'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {idx + 1}
                                                </span>
                                                <div className="flex-1">
                                                    <p className="font-medium text-gray-900 mb-3">{q.question}</p>
                                                    <div className="space-y-2">
                                                        {Object.entries(q.options).map(([key, value]) => (
                                                            <button
                                                                key={key}
                                                                onClick={() => selectAnswer(q.id, key)}
                                                                disabled={submitted}
                                                                className={`w-full p-3 rounded-lg text-left transition-all flex items-center gap-3 ${submitted
                                                                    ? key === q.correct_answer
                                                                        ? 'bg-green-100 border-green-400 border-2'
                                                                        : userAnswers[q.id] === key
                                                                            ? 'bg-red-100 border-red-400 border-2'
                                                                            : 'bg-gray-50'
                                                                    : userAnswers[q.id] === key
                                                                        ? 'bg-purple-100 border-purple-400 border-2'
                                                                        : 'bg-gray-50 hover:bg-gray-100'
                                                                    }`}
                                                            >
                                                                <span className="w-6 h-6 rounded-full bg-white border-2 flex items-center justify-center text-sm font-medium">
                                                                    {key}
                                                                </span>
                                                                <span>{value}</span>
                                                                {submitted && key === q.correct_answer && <Check className="w-5 h-5 text-green-600 ml-auto" />}
                                                                {submitted && userAnswers[q.id] === key && key !== q.correct_answer && <X className="w-5 h-5 text-red-600 ml-auto" />}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {submitted && (
                                                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                                            <p className="text-sm text-blue-800">
                                                                <strong>Explanation:</strong> {q.explanation}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-6 border-t">
                                    {!submitted ? (
                                        <button
                                            onClick={submitQuiz}
                                            disabled={Object.keys(userAnswers).length === 0}
                                            className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50"
                                        >
                                            Submit Answers
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setUserAnswers({})
                                                setSubmitted(false)
                                            }}
                                            className="w-full py-3 bg-gray-600 text-white rounded-xl font-bold hover:bg-gray-700"
                                        >
                                            Retry Quiz
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-xl p-12 h-full flex items-center justify-center text-center">
                                <div>
                                    <Brain className="w-16 h-16 text-purple-300 mx-auto mb-4" />
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Generate MCQs</h3>
                                    <p className="text-gray-500 max-w-md">
                                        Configure settings and click "Generate MCQs" to create unique practice questions.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

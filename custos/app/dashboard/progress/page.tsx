'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, TrendingUp, Award, BookOpen, Brain,
    Calendar, BarChart3, Target, Clock, CheckCircle,
    XCircle, Trophy, Star, Flame
} from 'lucide-react'

interface StudentProgress {
    user_id: string
    full_name: string
    email: string
    class_name: string
    total_attempts: number
    average_score: number
    total_correct: number
    total_questions: number
    topics_covered: number
    streak_days: number
}

interface RecentAttempt {
    attempt_id: string
    topic_title: string
    score: number
    total_questions: number
    percentage: number
    attempted_at: string
}

interface TopicMastery {
    topic_id: string
    topic_title: string
    attempts: number
    best_score: number
    average_score: number
    mastery_level: 'beginner' | 'learning' | 'proficient' | 'master'
}

export default function StudentProgressDashboard() {
    const router = useRouter()

    const [progress, setProgress] = useState<StudentProgress | null>(null)
    const [recentAttempts, setRecentAttempts] = useState<RecentAttempt[]>([])
    const [topicMastery, setTopicMastery] = useState<TopicMastery[]>([])
    const [loading, setLoading] = useState(true)
    const [userId, setUserId] = useState<string | null>(null)

    useEffect(() => {
        checkUserAndLoadData()
    }, [])

    async function checkUserAndLoadData() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            setUserId(user.id)
            await Promise.all([
                loadProgress(user.id),
                loadRecentAttempts(user.id),
                loadTopicMastery(user.id)
            ])
        }
        setLoading(false)
    }

    async function loadProgress(uid: string) {
        try {
            // Get user info
            const { data: userData } = await supabase
                .from('users')
                .select(`
                    user_id,
                    full_name,
                    email,
                    classes (name)
                `)
                .eq('user_id', uid)
                .single()

            // Get attempt stats
            const { data: attempts } = await supabase
                .from('student_mcq_attempts')
                .select('score, total_questions, percentage, attempted_at')
                .eq('student_id', uid)

            if (userData && attempts) {
                const totalAttempts = attempts.length
                const totalCorrect = attempts.reduce((sum, a) => sum + a.score, 0)
                const totalQuestions = attempts.reduce((sum, a) => sum + a.total_questions, 0)
                const avgScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0

                // Calculate streak (simplified)
                const today = new Date().toDateString()
                const uniqueDays = new Set(attempts.map(a => new Date(a.attempted_at).toDateString()))

                setProgress({
                    user_id: userData.user_id,
                    full_name: userData.full_name,
                    email: userData.email,
                    class_name: (userData.classes as any)?.name || 'Not Assigned',
                    total_attempts: totalAttempts,
                    average_score: avgScore,
                    total_correct: totalCorrect,
                    total_questions: totalQuestions,
                    topics_covered: 0, // Will calculate separately
                    streak_days: uniqueDays.size
                })
            }
        } catch (error) {
            console.error('Error loading progress:', error)
        }
    }

    async function loadRecentAttempts(uid: string) {
        try {
            const { data, error } = await supabase
                .from('student_mcq_attempts')
                .select(`
                    attempt_id,
                    score,
                    total_questions,
                    percentage,
                    attempted_at,
                    mcq_generations (
                        topic_id,
                        lesson_topics (topic_title)
                    )
                `)
                .eq('student_id', uid)
                .order('attempted_at', { ascending: false })
                .limit(10)

            if (!error && data) {
                setRecentAttempts(data.map((a: any) => ({
                    attempt_id: a.attempt_id,
                    topic_title: a.mcq_generations?.lesson_topics?.topic_title || 'Unknown Topic',
                    score: a.score,
                    total_questions: a.total_questions,
                    percentage: a.percentage,
                    attempted_at: a.attempted_at
                })))
            }
        } catch (error) {
            console.error('Error loading attempts:', error)
        }
    }

    async function loadTopicMastery(uid: string) {
        // This would aggregate scores by topic
        // For now, we'll show a placeholder
        setTopicMastery([])
    }

    const getMasteryColor = (level: string) => {
        switch (level) {
            case 'master': return 'bg-yellow-400 text-yellow-900'
            case 'proficient': return 'bg-green-400 text-green-900'
            case 'learning': return 'bg-blue-400 text-blue-900'
            default: return 'bg-gray-400 text-gray-900'
        }
    }

    const getScoreColor = (percentage: number) => {
        if (percentage >= 80) return 'text-green-600'
        if (percentage >= 60) return 'text-yellow-600'
        return 'text-red-600'
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-white rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">My Progress</h1>
                            <p className="text-gray-600">{progress?.full_name} • {progress?.class_name}</p>
                        </div>
                    </div>
                    <Trophy className="w-12 h-12 text-yellow-500" />
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-2xl shadow-lg p-6 text-center transform hover:scale-105 transition-all">
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <Brain className="w-7 h-7 text-white" />
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{progress?.total_attempts || 0}</p>
                        <p className="text-sm text-gray-500">Quizzes Taken</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg p-6 text-center transform hover:scale-105 transition-all">
                        <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <Target className="w-7 h-7 text-white" />
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{progress?.average_score || 0}%</p>
                        <p className="text-sm text-gray-500">Average Score</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg p-6 text-center transform hover:scale-105 transition-all">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <CheckCircle className="w-7 h-7 text-white" />
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{progress?.total_correct || 0}</p>
                        <p className="text-sm text-gray-500">Correct Answers</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg p-6 text-center transform hover:scale-105 transition-all">
                        <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <Flame className="w-7 h-7 text-white" />
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{progress?.streak_days || 0}</p>
                        <p className="text-sm text-gray-500">Day Streak</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Activity */}
                    <div className="bg-white rounded-2xl shadow-xl p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-purple-600" />
                            Recent Activity
                        </h2>

                        {recentAttempts.length === 0 ? (
                            <div className="text-center py-12">
                                <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">No quiz attempts yet</p>
                                <button
                                    onClick={() => router.push('/dashboard/manage/topics')}
                                    className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
                                >
                                    Start Learning
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-80 overflow-y-auto">
                                {recentAttempts.map((attempt) => (
                                    <div key={attempt.attempt_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                        <div>
                                            <p className="font-medium text-gray-900">{attempt.topic_title}</p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(attempt.attempted_at).toLocaleDateString('en-US', {
                                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-lg font-bold ${getScoreColor(attempt.percentage)}`}>
                                                {attempt.score}/{attempt.total_questions}
                                            </p>
                                            <p className="text-xs text-gray-500">{attempt.percentage}%</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Performance Chart Placeholder */}
                    <div className="bg-white rounded-2xl shadow-xl p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-blue-600" />
                            Performance Trend
                        </h2>

                        <div className="h-64 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                            <div className="text-center">
                                <TrendingUp className="w-16 h-16 text-blue-300 mx-auto mb-4" />
                                <p className="text-gray-500">Performance chart coming soon</p>
                                <p className="text-xs text-gray-400 mt-1">Track your progress over time</p>
                            </div>
                        </div>
                    </div>

                    {/* Achievements */}
                    <div className="bg-white rounded-2xl shadow-xl p-6 lg:col-span-2">
                        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Award className="w-5 h-5 text-yellow-600" />
                            Achievements
                        </h2>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {/* First Quiz Badge */}
                            <div className={`p-4 rounded-xl text-center border-2 ${(progress?.total_attempts || 0) >= 1
                                ? 'border-yellow-400 bg-yellow-50'
                                : 'border-gray-200 bg-gray-50 opacity-50'
                                }`}>
                                <div className="text-4xl mb-2">🎯</div>
                                <p className="font-semibold text-sm">First Quiz</p>
                                <p className="text-xs text-gray-500">Complete 1 quiz</p>
                            </div>

                            {/* 5 Quiz Badge */}
                            <div className={`p-4 rounded-xl text-center border-2 ${(progress?.total_attempts || 0) >= 5
                                ? 'border-blue-400 bg-blue-50'
                                : 'border-gray-200 bg-gray-50 opacity-50'
                                }`}>
                                <div className="text-4xl mb-2">🌟</div>
                                <p className="font-semibold text-sm">Quiz Enthusiast</p>
                                <p className="text-xs text-gray-500">Complete 5 quizzes</p>
                            </div>

                            {/* Perfect Score Badge */}
                            <div className={`p-4 rounded-xl text-center border-2 ${recentAttempts.some(a => a.percentage === 100)
                                ? 'border-green-400 bg-green-50'
                                : 'border-gray-200 bg-gray-50 opacity-50'
                                }`}>
                                <div className="text-4xl mb-2">💯</div>
                                <p className="font-semibold text-sm">Perfect!</p>
                                <p className="text-xs text-gray-500">Score 100%</p>
                            </div>

                            {/* Streak Badge */}
                            <div className={`p-4 rounded-xl text-center border-2 ${(progress?.streak_days || 0) >= 3
                                ? 'border-orange-400 bg-orange-50'
                                : 'border-gray-200 bg-gray-50 opacity-50'
                                }`}>
                                <div className="text-4xl mb-2">🔥</div>
                                <p className="font-semibold text-sm">On Fire!</p>
                                <p className="text-xs text-gray-500">3-day streak</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

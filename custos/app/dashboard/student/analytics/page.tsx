'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    Brain, ArrowLeft, Loader2, Flame, Zap, Trophy, Target,
    TrendingUp, TrendingDown, Clock, BarChart3, Star, BookOpen,
    CheckCircle, AlertTriangle, Calendar, Activity, Award
} from 'lucide-react'
import dynamic from 'next/dynamic'

// Lazy load chart component
const ActivityChart = dynamic(
    () => import('@/components/analytics/ActivityChart'),
    {
        loading: () => (
            <div className="h-56 bg-white/5 rounded-xl animate-pulse flex items-center justify-center">
                <p className="text-purple-300/40 text-sm">Loading chart...</p>
            </div>
        ),
        ssr: false,
    }
)

interface AnalyticsData {
    week: {
        completed_days: number
        total_days: number
        percentage: number
    }
    streak: number
    activity_score: {
        score: number
        level: number
        next_level_points: number
    }
    topics: {
        strong: TopicData[]
        need_practice: TopicData[]
        all: TopicData[]
    }
    trend: TrendData[]
    achievements: AchievementData[]
    time: {
        total_minutes_month: number
        avg_daily_minutes: number
        total_questions_month: number
    }
}

interface TopicData {
    topic_id: string
    topic_name: string
    activity_percentage: number
    last_practiced: string | null
    total_attempts: number
    accuracy_percentage: number
    days_since_practice: number
}

interface TrendData {
    date: string
    activity_percentage: number
    minutes_spent: number
    questions_answered: number
}

interface AchievementData {
    achievement_id: string
    name: string
    description: string | null
    icon: string | null
    category: string | null
    points_awarded: number
    earned_at: string
}

// Achievement icon mapping
const ACHIEVEMENT_ICONS: Record<string, string> = {
    streak: '🔥',
    accuracy: '🎯',
    improvement: '📈',
    participation: '🌟',
    milestone: '🏆',
}

function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return 'Never'
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`
    return `${Math.floor(days / 30)} months ago`
}

function formatMinutes(minutes: number): string {
    if (minutes < 60) return `${minutes}m`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function StudentAnalyticsPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [studentId, setStudentId] = useState<string | null>(null)

    useEffect(() => {
        loadAnalytics()
    }, [])

    async function loadAnalytics() {
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

            const res = await fetch(`/api/student/analytics?studentId=${user.user_id}`)
            if (!res.ok) throw new Error('Failed to load analytics')

            const analyticsData = await res.json()
            setData(analyticsData)
        } catch (err: any) {
            console.error('Analytics load error:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950">
                <div className="text-center">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-full border-4 border-indigo-500/30 border-t-indigo-400 animate-spin mx-auto" />
                        <BarChart3 className="w-8 h-8 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="mt-6 text-indigo-300 text-lg font-medium animate-pulse">
                        Loading analytics...
                    </p>
                </div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 p-6">
                <div className="text-center max-w-md">
                    <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Unable to Load Analytics</h2>
                    <p className="text-purple-300/70 mb-4">{error || 'Something went wrong'}</p>
                    <button
                        onClick={() => { setLoading(true); setError(null); loadAnalytics() }}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        )
    }

    const progressToNextLevel = data.activity_score.score % 100
    const progressPercent = progressToNextLevel

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 pb-8">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-indigo-950/80 backdrop-blur-lg border-b border-white/5">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                    <button
                        onClick={() => router.push('/dashboard/student')}
                        className="flex items-center gap-2 text-purple-300 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="text-sm">Dashboard</span>
                    </button>
                    <h1 className="text-lg font-bold text-white flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-indigo-400" />
                        Analytics
                    </h1>
                    <div className="w-20" /> {/* Spacer */}
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 space-y-5 mt-5">
                {/* ─── This Week's Activity ─────────────────────── */}
                <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                    <h2 className="text-sm font-semibold text-purple-300/70 uppercase tracking-wider mb-4">
                        This Week&apos;s Activity
                    </h2>

                    {/* Progress bar */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-purple-200">
                                {data.week.completed_days}/{data.week.total_days} days
                            </span>
                            <span className="text-sm font-bold text-white">{data.week.percentage}%</span>
                        </div>
                        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
                                style={{ width: `${data.week.percentage}%` }}
                            />
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/5 rounded-xl p-3 text-center">
                            <Flame className="w-6 h-6 text-orange-400 mx-auto mb-1" />
                            <p className="text-xl font-bold text-white">{data.streak}</p>
                            <p className="text-[10px] text-purple-300/50">Day Streak</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 text-center">
                            <Zap className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                            <p className="text-xl font-bold text-white">{data.activity_score.score}</p>
                            <p className="text-[10px] text-purple-300/50">Points</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 text-center">
                            <Star className="w-6 h-6 text-indigo-400 mx-auto mb-1" />
                            <p className="text-xl font-bold text-white">Lv.{data.activity_score.level}</p>
                            <p className="text-[10px] text-purple-300/50">Level</p>
                        </div>
                    </div>

                    {/* Level progress */}
                    <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-purple-300/40">Level {data.activity_score.level}</span>
                            <span className="text-[10px] text-purple-300/40">{data.activity_score.next_level_points} pts</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full transition-all duration-500"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>
                </section>

                {/* ─── Strong Topics ────────────────────────────── */}
                {data.topics.strong.length > 0 && (
                    <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                        <h2 className="text-sm font-semibold text-purple-300/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-green-400" />
                            Strong Topics ({data.topics.strong.length})
                        </h2>
                        <div className="space-y-3">
                            {data.topics.strong.slice(0, 5).map((topic) => (
                                <div key={topic.topic_id} className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center shrink-0">
                                        <CheckCircle className="w-4 h-4 text-green-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">{topic.topic_name}</p>
                                        <p className="text-[10px] text-purple-300/50">
                                            {topic.activity_percentage}% activity • {topic.total_attempts} attempts
                                        </p>
                                    </div>
                                    <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden shrink-0">
                                        <div
                                            className="h-full bg-green-500 rounded-full"
                                            style={{ width: `${topic.activity_percentage}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ─── Need More Practice ───────────────────────── */}
                {data.topics.need_practice.length > 0 && (
                    <section className="bg-white/5 backdrop-blur-sm border border-amber-500/10 rounded-2xl p-5">
                        <h2 className="text-sm font-semibold text-purple-300/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-amber-400" />
                            Need More Practice ({data.topics.need_practice.length})
                        </h2>
                        <div className="space-y-3">
                            {data.topics.need_practice.slice(0, 5).map((topic) => (
                                <div key={topic.topic_id} className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center shrink-0">
                                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">{topic.topic_name}</p>
                                        <p className="text-[10px] text-purple-300/50">
                                            {topic.activity_percentage}% activity • Last: {formatRelativeTime(topic.last_practiced)}
                                        </p>
                                    </div>
                                    <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden shrink-0">
                                        <div
                                            className="h-full bg-amber-500 rounded-full"
                                            style={{ width: `${topic.activity_percentage}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ─── Activity Trend Chart ─────────────────────── */}
                <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                    <ActivityChart data={data.trend} />
                </section>

                {/* ─── Achievements ─────────────────────────────── */}
                <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                    <h2 className="text-sm font-semibold text-purple-300/70 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-yellow-400" />
                        Achievements ({data.achievements.length} earned)
                    </h2>

                    {data.achievements.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {data.achievements.map((ach) => (
                                <div
                                    key={ach.achievement_id}
                                    className="bg-white/5 rounded-xl p-3 text-center transition-all hover:bg-white/10 hover:scale-105 group"
                                >
                                    <div className="text-2xl mb-1 group-hover:animate-bounce">
                                        {ach.icon || ACHIEVEMENT_ICONS[ach.category || ''] || '🏆'}
                                    </div>
                                    <p className="text-[10px] font-medium text-white truncate">{ach.name}</p>
                                    <p className="text-[8px] text-purple-300/40 mt-0.5">
                                        {new Date(ach.earned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <Award className="w-12 h-12 text-purple-500/30 mx-auto mb-2" />
                            <p className="text-sm text-purple-300/50">
                                Keep practicing to earn your first badge!
                            </p>
                        </div>
                    )}
                </section>

                {/* ─── Learning Time ────────────────────────────── */}
                <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                    <h2 className="text-sm font-semibold text-purple-300/70 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-cyan-400" />
                        Learning Time This Month
                    </h2>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/5 rounded-xl p-4 text-center">
                            <p className="text-xl font-bold text-white">
                                {formatMinutes(data.time.total_minutes_month)}
                            </p>
                            <p className="text-[10px] text-purple-300/50 mt-1">Total Time</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 text-center">
                            <p className="text-xl font-bold text-white">
                                {data.time.avg_daily_minutes}m
                            </p>
                            <p className="text-[10px] text-purple-300/50 mt-1">Avg / Day</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 text-center">
                            <p className="text-xl font-bold text-white">
                                {data.time.total_questions_month}
                            </p>
                            <p className="text-[10px] text-purple-300/50 mt-1">Questions</p>
                        </div>
                    </div>
                </section>

                {/* ─── Quick Actions ────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3 pb-4">
                    <button
                        onClick={() => router.push('/dashboard/student/practice')}
                        className="bg-gradient-to-r from-indigo-600/50 to-purple-600/50 border border-indigo-500/20 rounded-xl p-4 text-left hover:scale-[1.02] transition-all active:scale-[0.98]"
                    >
                        <Brain className="w-6 h-6 text-indigo-400 mb-2" />
                        <p className="text-sm font-semibold text-white">Daily Practice</p>
                        <p className="text-[10px] text-purple-300/50">Start today&apos;s session</p>
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/student/practice?type=weekly')}
                        className="bg-gradient-to-r from-blue-600/50 to-cyan-600/50 border border-blue-500/20 rounded-xl p-4 text-left hover:scale-[1.02] transition-all active:scale-[0.98]"
                    >
                        <BookOpen className="w-6 h-6 text-cyan-400 mb-2" />
                        <p className="text-sm font-semibold text-white">Weekly Test</p>
                        <p className="text-[10px] text-purple-300/50">Test this week&apos;s topics</p>
                    </button>
                </div>
            </main>
        </div>
    )
}

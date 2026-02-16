'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Loader2, Brain, TrendingUp, TrendingDown, Flame,
    Target, Clock, CheckCircle, AlertTriangle, MessageSquare,
    ChevronDown, ChevronUp, BookOpen, Zap, Trophy, Eye,
    Calendar, BarChart3, Activity, Award, CalendarPlus, ListPlus,
    Heart, Phone, X, Send
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────

interface DeepDiveData {
    student_id: string
    full_name: string
    class_name: string
    section_name: string
    performance_score: number
    performance_rank: number
    performance_percentile: number
    performance_trend: 'improving' | 'declining' | 'stable'
    trend_delta: number
    engagement: {
        current_streak: number
        longest_streak: number
        week_completion: { completed: number; total: number; percentage: number }
        total_time_minutes: number
        avg_daily_minutes: number
        activity_score: number
    }
    topics: Array<{
        topic_id: string
        topic_name: string
        weakness_score: number
        accuracy_percentage: number
        total_attempts: number
        avg_time_seconds: number
        last_assessed_at: string | null
        is_weak: boolean
    }>
    recent_doubts: Array<{
        doubt_id: string
        doubt_text: string
        ai_response: string | null
        teacher_response: string | null
        status: string
        created_at: string
        topic_name: string | null
    }>
    concerning_patterns: Array<{
        type: string
        severity: 'warning' | 'critical'
        description: string
        data: Record<string, unknown>
    }>
    weekly_trend: Array<{
        week_start: string
        score: number
        questions_answered: number
    }>
}

// ─── Component ──────────────────────────────────────────

export default function StudentDetailPage() {
    const router = useRouter()
    const params = useParams()
    const studentId = params.id as string

    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<DeepDiveData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [expandedTopic, setExpandedTopic] = useState<string | null>(null)
    const [showAllDoubts, setShowAllDoubts] = useState(false)

    // --- Action modals ---
    const [activeAction, setActiveAction] = useState<string | null>(null)
    const [actionMessage, setActionMessage] = useState('')
    const [actionDate, setActionDate] = useState('')
    const [actionSending, setActionSending] = useState(false)
    const [actionSent, setActionSent] = useState(false)

    useEffect(() => {
        loadStudentData()
    }, [studentId])

    async function loadStudentData() {
        try {
            setLoading(true)
            const res = await fetch(`/api/teacher/student-detail/${studentId}`)

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to load')
            }

            const result = await res.json()
            setData(result)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // ─── Helpers ─────────────────────────────────────────

    function getScoreColor(score: number): string {
        if (score >= 85) return 'text-emerald-400'
        if (score >= 60) return 'text-blue-400'
        if (score >= 40) return 'text-amber-400'
        return 'text-red-400'
    }

    function getWeaknessBar(score: number): string {
        if (score >= 70) return 'bg-red-500'
        if (score >= 50) return 'bg-amber-500'
        if (score >= 30) return 'bg-blue-500'
        return 'bg-emerald-500'
    }

    function getTimeLabel(seconds: number): string {
        if (seconds <= 15) return 'fast'
        if (seconds <= 25) return 'normal'
        if (seconds <= 35) return 'slow'
        return 'very slow'
    }

    function formatDate(dateStr: string | null): string {
        if (!dateStr) return 'Never'
        const d = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - d.getTime()
        const diffDays = Math.floor(diffMs / 86400000)
        if (diffDays === 0) return 'Today'
        if (diffDays === 1) return 'Yesterday'
        if (diffDays < 7) return `${diffDays} days ago`
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    }

    function formatMinutes(min: number): string {
        if (min < 60) return `${min}m`
        const h = Math.floor(min / 60)
        const m = min % 60
        return m > 0 ? `${h}h ${m}m` : `${h}h`
    }

    // ─── Loading ─────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
                    <p className="text-blue-300/70">Loading student data...</p>
                </div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
                <div className="text-center">
                    <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <p className="text-red-300">{error || 'Student not found'}</p>
                    <button
                        onClick={() => router.back()}
                        className="mt-4 px-6 py-2 bg-white/10 rounded-xl text-white text-sm hover:bg-white/20"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        )
    }

    const criticalPatterns = data.concerning_patterns.filter(p => p.severity === 'critical')
    const warningPatterns = data.concerning_patterns.filter(p => p.severity === 'warning')

    // ─── Render ──────────────────────────────────────────

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 pb-20">
            {/* Header */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-4 sm:px-6 py-4 sticky top-0 z-20">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-blue-300" />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-white">{data.full_name}</h1>
                            <p className="text-xs text-blue-300/60">
                                {data.class_name} - {data.section_name}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className={`text-2xl font-bold ${getScoreColor(data.performance_score)}`}>
                            {data.performance_score}%
                        </p>
                        <p className="text-[10px] text-blue-300/50">Performance</p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
                {/* ─── Performance Summary ────────────── */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-5">
                    <h2 className="text-sm font-semibold text-blue-300/80 flex items-center gap-2 mb-4">
                        <Target className="w-4 h-4 text-cyan-400" />
                        Performance Summary
                    </h2>

                    <div className="grid grid-cols-3 gap-4">
                        {/* Score */}
                        <div className="text-center">
                            <p className={`text-3xl font-bold ${getScoreColor(data.performance_score)}`}>
                                {data.performance_score}%
                            </p>
                            <p className="text-xs text-blue-300/50">Overall Score</p>
                        </div>

                        {/* Rank */}
                        <div className="text-center">
                            <p className="text-3xl font-bold text-white">
                                #{data.performance_rank}
                            </p>
                            <p className="text-xs text-blue-300/50">Class Rank</p>
                        </div>

                        {/* Trend */}
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-1">
                                {data.performance_trend === 'improving' && (
                                    <>
                                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                                        <span className="text-lg font-bold text-emerald-400">+{data.trend_delta}%</span>
                                    </>
                                )}
                                {data.performance_trend === 'declining' && (
                                    <>
                                        <TrendingDown className="w-5 h-5 text-red-400" />
                                        <span className="text-lg font-bold text-red-400">{data.trend_delta}%</span>
                                    </>
                                )}
                                {data.performance_trend === 'stable' && (
                                    <span className="text-lg font-bold text-blue-300">—</span>
                                )}
                            </div>
                            <p className="text-xs text-blue-300/50">This Month</p>
                        </div>
                    </div>

                    {/* Percentile bar */}
                    <div className="mt-4 pt-4 border-t border-white/10">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-blue-300/60">Percentile</span>
                            <span className="text-xs font-medium text-white">Top {100 - data.performance_percentile}%</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                            <div
                                className={`h-2 rounded-full transition-all ${data.performance_percentile >= 60 ? 'bg-emerald-500' :
                                    data.performance_percentile >= 40 ? 'bg-blue-500' :
                                        data.performance_percentile >= 20 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                style={{ width: `${data.performance_percentile}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* ─── Concerning Patterns ────────────── */}
                {data.concerning_patterns.length > 0 && (
                    <div className={`rounded-2xl border p-4 space-y-2 ${criticalPatterns.length > 0
                        ? 'bg-red-500/10 border-red-500/20'
                        : 'bg-amber-500/10 border-amber-500/20'
                        }`}>
                        <h3 className={`text-sm font-semibold flex items-center gap-2 ${criticalPatterns.length > 0 ? 'text-red-300' : 'text-amber-300'
                            }`}>
                            <AlertTriangle className="w-4 h-4" />
                            Concerning Patterns
                        </h3>
                        {data.concerning_patterns.map((p, i) => (
                            <div
                                key={i}
                                className={`flex items-start gap-2 text-xs ${p.severity === 'critical' ? 'text-red-300' : 'text-amber-300'
                                    }`}
                            >
                                <span>{p.severity === 'critical' ? '🔴' : '🟡'}</span>
                                <span>{p.description}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* ─── Engagement ─────────────────────── */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-5">
                    <h2 className="text-sm font-semibold text-blue-300/80 flex items-center gap-2 mb-4">
                        <Activity className="w-4 h-4 text-indigo-400" />
                        Engagement
                    </h2>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white/5 rounded-xl p-3 text-center">
                            <p className="flex items-center justify-center gap-1">
                                <Flame className="w-4 h-4 text-orange-400" />
                                <span className="text-xl font-bold text-white">{data.engagement.current_streak}</span>
                            </p>
                            <p className="text-[10px] text-blue-300/50">Current Streak</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 text-center">
                            <p className="text-xl font-bold text-white">
                                {data.engagement.week_completion.completed}/{data.engagement.week_completion.total}
                            </p>
                            <p className="text-[10px] text-blue-300/50">This Week</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 text-center">
                            <p className="text-xl font-bold text-white">
                                {formatMinutes(data.engagement.total_time_minutes)}
                            </p>
                            <p className="text-[10px] text-blue-300/50">Total Time</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 text-center">
                            <p className="text-xl font-bold text-white">
                                {data.engagement.avg_daily_minutes}m
                            </p>
                            <p className="text-[10px] text-blue-300/50">Avg/Day</p>
                        </div>
                    </div>

                    {/* Week completion progress */}
                    <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-blue-300/60">Week Progress</span>
                            <span className="text-xs font-medium text-white">
                                {data.engagement.week_completion.percentage}%
                            </span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                            <div
                                className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all"
                                style={{ width: `${data.engagement.week_completion.percentage}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* ─── Weekly Trend (Mini Chart) ──────── */}
                {data.weekly_trend.length > 0 && (
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-5">
                        <h2 className="text-sm font-semibold text-blue-300/80 flex items-center gap-2 mb-4">
                            <BarChart3 className="w-4 h-4 text-cyan-400" />
                            4-Week Trend
                        </h2>
                        <div className="flex items-end gap-3 h-24">
                            {data.weekly_trend.map((w, i) => {
                                const maxScore = Math.max(...data.weekly_trend.map(x => x.score), 1)
                                const height = maxScore > 0 ? (w.score / maxScore) * 100 : 0
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                        <span className="text-xs font-medium text-white">{w.score}%</span>
                                        <div
                                            className={`w-full rounded-t-lg transition-all ${w.score >= 70 ? 'bg-emerald-500/60' :
                                                w.score >= 50 ? 'bg-blue-500/60' : 'bg-red-500/60'
                                                }`}
                                            style={{ height: `${Math.max(height, 10)}%` }}
                                        />
                                        <span className="text-[9px] text-blue-300/40">
                                            W{i + 1}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* ─── Topic Performance ──────────────── */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-5">
                    <h2 className="text-sm font-semibold text-blue-300/80 flex items-center gap-2 mb-4">
                        <BookOpen className="w-4 h-4 text-purple-400" />
                        Topic Performance ({data.topics.length})
                    </h2>

                    {data.topics.length === 0 ? (
                        <p className="text-sm text-blue-300/40 text-center py-4">No topic data yet</p>
                    ) : (
                        <div className="space-y-2">
                            {data.topics.map(t => (
                                <div key={t.topic_id}>
                                    <button
                                        onClick={() => setExpandedTopic(
                                            expandedTopic === t.topic_id ? null : t.topic_id
                                        )}
                                        className="w-full rounded-xl bg-white/5 p-3 text-left hover:bg-white/10 transition-colors"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">{t.is_weak ? '⚠️' : '✅'}</span>
                                                <span className="text-sm font-medium text-white">{t.topic_name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-bold ${t.accuracy_percentage >= 80 ? 'text-emerald-400' :
                                                    t.accuracy_percentage >= 60 ? 'text-blue-400' :
                                                        t.accuracy_percentage >= 40 ? 'text-amber-400' : 'text-red-400'
                                                    }`}>
                                                    {t.accuracy_percentage}%
                                                </span>
                                                {expandedTopic === t.topic_id
                                                    ? <ChevronUp className="w-3 h-3 text-blue-300/50" />
                                                    : <ChevronDown className="w-3 h-3 text-blue-300/50" />
                                                }
                                            </div>
                                        </div>

                                        {/* Weakness bar */}
                                        <div className="w-full bg-white/10 rounded-full h-1.5">
                                            <div
                                                className={`h-1.5 rounded-full ${getWeaknessBar(t.weakness_score)}`}
                                                style={{ width: `${100 - t.weakness_score}%` }}
                                            />
                                        </div>
                                    </button>

                                    {/* Expanded detail */}
                                    {expandedTopic === t.topic_id && (
                                        <div className="bg-white/5 rounded-b-xl px-4 py-3 -mt-1 ml-4 mr-4 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                            <div>
                                                <p className="text-blue-300/50">Attempts</p>
                                                <p className="text-white font-medium">{t.total_attempts}</p>
                                            </div>
                                            <div>
                                                <p className="text-blue-300/50">Accuracy</p>
                                                <p className="text-white font-medium">{t.accuracy_percentage}%</p>
                                            </div>
                                            <div>
                                                <p className="text-blue-300/50">Avg Time</p>
                                                <p className="text-white font-medium">
                                                    {t.avg_time_seconds}s ({getTimeLabel(t.avg_time_seconds)})
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-blue-300/50">Last Practiced</p>
                                                <p className="text-white font-medium">{formatDate(t.last_assessed_at)}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ─── Recent Doubts ──────────────────── */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-5">
                    <h2 className="text-sm font-semibold text-blue-300/80 flex items-center gap-2 mb-4">
                        <MessageSquare className="w-4 h-4 text-indigo-400" />
                        Recent Doubts ({data.recent_doubts.length})
                    </h2>

                    {data.recent_doubts.length === 0 ? (
                        <p className="text-sm text-blue-300/40 text-center py-4">No doubts asked</p>
                    ) : (
                        <div className="space-y-3">
                            {data.recent_doubts
                                .slice(0, showAllDoubts ? undefined : 3)
                                .map(d => (
                                    <div key={d.doubt_id} className="bg-white/5 rounded-xl p-3">
                                        <div className="flex items-start justify-between mb-1">
                                            <p className="text-sm text-white font-medium">"{d.doubt_text}"</p>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${d.status === 'teacher_answered'
                                                ? 'bg-emerald-500/20 text-emerald-300'
                                                : d.status === 'ai_answered'
                                                    ? 'bg-blue-500/20 text-blue-300'
                                                    : 'bg-amber-500/20 text-amber-300'
                                                }`}>
                                                {d.status === 'teacher_answered' ? 'Resolved' :
                                                    d.status === 'ai_answered' ? 'AI Helped' : 'Open'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-blue-300/50">
                                            {d.topic_name && <span>📚 {d.topic_name}</span>}
                                            <span>🕐 {formatDate(d.created_at)}</span>
                                        </div>
                                    </div>
                                ))}

                            {data.recent_doubts.length > 3 && (
                                <button
                                    onClick={() => setShowAllDoubts(!showAllDoubts)}
                                    className="w-full text-center text-xs text-cyan-400 hover:text-cyan-300 py-1"
                                >
                                    {showAllDoubts ? 'Show less' : `Show all ${data.recent_doubts.length} doubts`}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* ─── Actions ─────────────────────────── */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-5">
                    <h2 className="text-sm font-semibold text-blue-300/80 flex items-center gap-2 mb-4">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        Actions
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => { setActiveAction('schedule'); setActionDate(''); setActionSent(false) }}
                            className="flex items-center gap-2 p-3 bg-purple-500/15 border border-purple-500/25 rounded-xl text-sm text-purple-300 hover:bg-purple-500/25 transition-colors"
                        >
                            <CalendarPlus className="w-4 h-4" />
                            Schedule 1-on-1
                        </button>
                        <button
                            onClick={() => { setActiveAction('practice'); setActionSent(false) }}
                            className="flex items-center gap-2 p-3 bg-cyan-500/15 border border-cyan-500/25 rounded-xl text-sm text-cyan-300 hover:bg-cyan-500/25 transition-colors"
                        >
                            <ListPlus className="w-4 h-4" />
                            Assign Practice
                        </button>
                        <button
                            onClick={() => { setActiveAction('encourage'); setActionMessage(''); setActionSent(false) }}
                            className="flex items-center gap-2 p-3 bg-pink-500/15 border border-pink-500/25 rounded-xl text-sm text-pink-300 hover:bg-pink-500/25 transition-colors"
                        >
                            <Heart className="w-4 h-4" />
                            Send Encouragement
                        </button>
                        <button
                            onClick={() => { setActiveAction('callparent'); setActionSent(false) }}
                            className="flex items-center gap-2 p-3 bg-amber-500/15 border border-amber-500/25 rounded-xl text-sm text-amber-300 hover:bg-amber-500/25 transition-colors"
                        >
                            <Phone className="w-4 h-4" />
                            Call Parent
                        </button>
                    </div>
                </div>
            </main>

            {/* ─── ACTION MODAL ─────────────────────── */}
            {activeAction && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white">
                                {activeAction === 'schedule' && '📅 Schedule 1-on-1'}
                                {activeAction === 'practice' && '📝 Assign Practice'}
                                {activeAction === 'encourage' && '💪 Send Encouragement'}
                                {activeAction === 'callparent' && '📞 Call Parent'}
                            </h3>
                            <button onClick={() => setActiveAction(null)} className="p-1 hover:bg-white/10 rounded-lg">
                                <X className="w-5 h-5 text-white/50" />
                            </button>
                        </div>

                        {/* Schedule 1-on-1 */}
                        {activeAction === 'schedule' && (
                            <div className="space-y-3">
                                <p className="text-sm text-blue-300/60">Schedule a one-on-one session with <span className="text-white font-medium">{data.full_name}</span>.</p>
                                <div>
                                    <label className="text-xs text-blue-300/60 block mb-1">Date & Time</label>
                                    <input
                                        type="datetime-local"
                                        value={actionDate}
                                        onChange={e => setActionDate(e.target.value)}
                                        className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 [color-scheme:dark]"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-blue-300/60 block mb-1">Note (optional)</label>
                                    <input
                                        type="text"
                                        value={actionMessage}
                                        onChange={e => setActionMessage(e.target.value)}
                                        placeholder="e.g. Focus on fractions"
                                        className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-blue-300/40 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Assign Practice */}
                        {activeAction === 'practice' && (
                            <div className="space-y-3">
                                <p className="text-sm text-blue-300/60">Assign extra practice to <span className="text-white font-medium">{data.full_name}</span> on their weakest topics.</p>
                                {data.topics.filter(t => t.is_weak).length > 0 ? (
                                    <div className="space-y-2">
                                        {data.topics.filter(t => t.is_weak).map(t => (
                                            <div key={t.topic_id} className="bg-white/5 rounded-xl p-3 text-sm text-white flex items-center justify-between">
                                                <span>{t.topic_name}</span>
                                                <span className="text-xs text-amber-400">{t.accuracy_percentage}%</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-blue-300/40 text-center py-2">No weak topics identified</p>
                                )}
                            </div>
                        )}

                        {/* Send Encouragement */}
                        {activeAction === 'encourage' && (
                            <div className="space-y-3">
                                <p className="text-sm text-blue-300/60">Send an encouraging message to <span className="text-white font-medium">{data.full_name}</span>.</p>
                                <textarea
                                    value={actionMessage}
                                    onChange={e => setActionMessage(e.target.value)}
                                    placeholder="Great effort this week! Keep pushing, you're improving every day 💪"
                                    rows={3}
                                    className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-blue-300/40 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 resize-none"
                                />
                                <div className="flex flex-wrap gap-2">
                                    {['Keep it up! 🌟', 'Proud of your effort! 💪', 'You can do it! 🚀', 'Great improvement! 📈'].map(q => (
                                        <button
                                            key={q}
                                            onClick={() => setActionMessage(q)}
                                            className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-blue-300/70 hover:bg-white/10 transition-colors"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Call Parent */}
                        {activeAction === 'callparent' && (
                            <div className="space-y-3">
                                <p className="text-sm text-blue-300/60">Log a parent call for <span className="text-white font-medium">{data.full_name}</span>.</p>
                                <div className="bg-white/5 rounded-xl p-4 space-y-2">
                                    <p className="text-xs text-blue-300/50">Key talking points:</p>
                                    <ul className="text-sm text-white/80 space-y-1.5">
                                        <li className="flex items-start gap-2">
                                            <span className="text-amber-400 mt-0.5">•</span>
                                            Performance: <span className={`font-medium ${getScoreColor(data.performance_score)}`}>{data.performance_score}%</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-amber-400 mt-0.5">•</span>
                                            Streak: {data.engagement.current_streak} days
                                        </li>
                                        {data.concerning_patterns.length > 0 && (
                                            <li className="flex items-start gap-2">
                                                <span className="text-red-400 mt-0.5">•</span>
                                                Concern: {data.concerning_patterns[0].description}
                                            </li>
                                        )}
                                    </ul>
                                </div>
                                <div>
                                    <label className="text-xs text-blue-300/60 block mb-1">Call notes (optional)</label>
                                    <textarea
                                        value={actionMessage}
                                        onChange={e => setActionMessage(e.target.value)}
                                        placeholder="What was discussed..."
                                        rows={2}
                                        className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-blue-300/40 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Action Button */}
                        {actionSent ? (
                            <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-3 text-center">
                                <p className="text-emerald-300 text-sm font-medium">✅ Done!</p>
                            </div>
                        ) : (
                            <button
                                onClick={async () => {
                                    setActionSending(true)
                                    try {
                                        let title = ''
                                        let message = ''

                                        if (activeAction === 'schedule') {
                                            title = '📅 1-on-1 Session Scheduled'
                                            const dateLabel = actionDate ? new Date(actionDate).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'soon'
                                            message = `Your teacher has scheduled a 1-on-1 session with you on ${dateLabel}. ${actionMessage ? `Note: ${actionMessage}` : ''}`
                                        } else if (activeAction === 'practice') {
                                            title = '📝 Extra Practice Assigned'
                                            const weakNames = data.topics.filter(t => t.is_weak).map(t => t.topic_name).join(', ')
                                            message = `Your teacher assigned extra practice on: ${weakNames || 'your weak topics'}. Head to Daily Practice!`
                                        } else if (activeAction === 'encourage') {
                                            title = '💬 Message from Teacher'
                                            message = actionMessage || 'Keep up the great work! Your teacher believes in you! 💪'
                                        } else if (activeAction === 'callparent') {
                                            title = '📞 Parent-Teacher Call Logged'
                                            message = `A parent-teacher call was logged for ${data.full_name}. ${actionMessage ? `Notes: ${actionMessage}` : ''}`
                                        }

                                        await fetch('/api/notifications', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                user_id: data.student_id,
                                                title,
                                                message,
                                                type: 'info',
                                                action_url: activeAction === 'practice' ? '/dashboard/student/practice' : undefined,
                                            }),
                                        })

                                        setActionSent(true)
                                        setTimeout(() => {
                                            setActiveAction(null)
                                            setActionSent(false)
                                            setActionMessage('')
                                            setActionDate('')
                                        }, 2000)
                                    } catch (err) {
                                        console.error('[Action] Error:', err)
                                    } finally {
                                        setActionSending(false)
                                    }
                                }}
                                disabled={actionSending || (activeAction === 'schedule' && !actionDate) || (activeAction === 'encourage' && !actionMessage.trim())}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                            >
                                {actionSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {activeAction === 'schedule' && (actionSending ? 'Scheduling...' : 'Schedule & Notify')}
                                {activeAction === 'practice' && (actionSending ? 'Assigning...' : 'Assign & Notify')}
                                {activeAction === 'encourage' && (actionSending ? 'Sending...' : 'Send Message')}
                                {activeAction === 'callparent' && (actionSending ? 'Logging...' : 'Log Call')}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

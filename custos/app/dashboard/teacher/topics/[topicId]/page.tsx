'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Loader2, BookOpen, Users, AlertTriangle,
    CheckCircle, XCircle, Clock, ChevronRight, Target
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────

interface TopicReport {
    topic_id: string
    topic_name: string
    class_average: number
    mastered_count: number
    struggling_count: number
    not_started_count: number
    students: Array<{
        student_id: string
        full_name: string
        accuracy: number
        attempts: number
        weakness_score: number
        avg_time: number
        last_assessed: string | null
    }>
}

type ViewMode = 'all' | 'struggling' | 'mastered' | 'not_started'

// ─── Component ──────────────────────────────────────────

function TopicReportPageInner() {
    const { goBack, router } = useSmartBack('/dashboard/teacher')
    const params = useParams()
    const searchParams = useSearchParams()
    const topicId = params.topicId as string
    const sectionId = searchParams.get('section_id') || ''

    const [loading, setLoading] = useState(true)
    const [report, setReport] = useState<TopicReport | null>(null)
    const [viewMode, setViewMode] = useState<ViewMode>('all')
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadReport()
    }, [topicId, sectionId])

    async function loadReport() {
        try {
            setLoading(true)

            // Direct query since we need the topic report helper
            const res = await fetch(
                `/api/teacher/topic-report?topic_id=${topicId}&section_id=${sectionId}`
            )

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Failed to load topic report')
            }

            setReport(data)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // ─── Filtered students ──────────────────────────────

    const filteredStudents = (report?.students || []).filter(s => {
        switch (viewMode) {
            case 'struggling': return s.accuracy >= 0 && s.accuracy < 60
            case 'mastered': return s.accuracy >= 80
            case 'not_started': return s.attempts === 0
            default: return true
        }
    })

    // ─── Helpers ────────────────────────────────────────

    function getScoreColor(score: number): string {
        if (score < 0) return 'text-slate-400' // not started
        if (score >= 80) return 'text-emerald-400'
        if (score >= 60) return 'text-blue-400'
        if (score >= 40) return 'text-amber-400'
        return 'text-red-400'
    }

    function formatDate(dateStr: string | null): string {
        if (!dateStr) return 'Never'
        const d = new Date(dateStr)
        const now = new Date()
        const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
        if (diff === 0) return 'Today'
        if (diff === 1) return 'Yesterday'
        if (diff < 7) return `${diff}d ago`
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    }

    // ─── Loading ────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
                <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
            </div>
        )
    }

    if (error || !report) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
                <div className="text-center">
                    <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <p className="text-red-300">{error || 'Report not found'}</p>
                    <button onClick={goBack} className="mt-4 px-6 py-2 bg-white/10 rounded-xl text-white text-sm">
                        Go Back
                    </button>
                </div>
            </div>
        )
    }

    // ─── Render ─────────────────────────────────────────

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 pb-20">
            {/* Header */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-4 sm:px-6 py-4 sticky top-0 z-20">
                <div className="max-w-4xl mx-auto flex items-center gap-3">
                    <button onClick={goBack} className="p-2 hover:bg-white/10 rounded-lg">
                        <ArrowLeft className="w-5 h-5 text-blue-300" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-white flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-purple-400" />
                            {report.topic_name}
                        </h1>
                        <p className="text-xs text-blue-300/60">Topic Class Report</p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
                {/* ─── Overview Cards ────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/10 p-4 text-center">
                        <p className={`text-2xl font-bold ${getScoreColor(report.class_average)}`}>
                            {report.class_average}%
                        </p>
                        <p className="text-[11px] text-blue-300/60">Class Average</p>
                    </div>
                    <div className="bg-emerald-500/10 rounded-xl border border-emerald-500/20 p-4 text-center">
                        <p className="text-2xl font-bold text-emerald-400">{report.mastered_count}</p>
                        <p className="text-[11px] text-emerald-300/60">Mastered (&gt;80%)</p>
                    </div>
                    <div className="bg-red-500/10 rounded-xl border border-red-500/20 p-4 text-center">
                        <p className="text-2xl font-bold text-red-400">{report.struggling_count}</p>
                        <p className="text-[11px] text-red-300/60">Struggling (&lt;60%)</p>
                    </div>
                    <div className="bg-slate-500/10 rounded-xl border border-slate-500/20 p-4 text-center">
                        <p className="text-2xl font-bold text-slate-400">{report.not_started_count}</p>
                        <p className="text-[11px] text-slate-300/60">Not Started</p>
                    </div>
                </div>

                {/* ─── Filter Tabs ───────────────────── */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {([
                        { key: 'all', label: 'All Students', count: report.students.length },
                        { key: 'struggling', label: '🔴 Struggling', count: report.struggling_count },
                        { key: 'mastered', label: '✅ Mastered', count: report.mastered_count },
                        { key: 'not_started', label: '⬜ Not Started', count: report.not_started_count },
                    ] as const).map(f => (
                        <button
                            key={f.key}
                            onClick={() => setViewMode(f.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${viewMode === f.key
                                ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                                : 'bg-white/5 text-blue-300/60 border border-white/10 hover:bg-white/10'
                                }`}
                        >
                            {f.label} ({f.count})
                        </button>
                    ))}
                </div>

                {/* ─── Student List ──────────────────── */}
                <div className="space-y-2">
                    {filteredStudents.length === 0 ? (
                        <div className="bg-white/5 rounded-xl p-8 text-center">
                            <p className="text-blue-300/50 text-sm">No students in this category</p>
                        </div>
                    ) : (
                        filteredStudents
                            .sort((a, b) => a.accuracy - b.accuracy)
                            .map(s => (
                                <button
                                    key={s.student_id}
                                    onClick={() => router.push(`/dashboard/teacher/students/${s.student_id}`)}
                                    className="w-full bg-white/5 rounded-xl border border-white/5 p-4 hover:bg-white/10 transition-all text-left group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-white">{s.full_name}</p>
                                            <div className="flex items-center gap-3 text-xs text-blue-300/50 mt-1">
                                                <span className="flex items-center gap-1">
                                                    <Target className="w-3 h-3" />
                                                    {s.attempts} attempts
                                                </span>
                                                {s.avg_time > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {s.avg_time}s avg
                                                    </span>
                                                )}
                                                <span>Last: {formatDate(s.last_assessed)}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span className={`text-lg font-bold ${getScoreColor(s.accuracy)}`}>
                                                {s.accuracy >= 0 ? `${s.accuracy}%` : '—'}
                                            </span>
                                            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50" />
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    {s.accuracy >= 0 && (
                                        <div className="w-full bg-white/10 rounded-full h-1.5 mt-3">
                                            <div
                                                className={`h-1.5 rounded-full transition-all ${s.accuracy >= 80 ? 'bg-emerald-500' :
                                                    s.accuracy >= 60 ? 'bg-blue-500' :
                                                        s.accuracy >= 40 ? 'bg-amber-500' : 'bg-red-500'
                                                    }`}
                                                style={{ width: `${s.accuracy}%` }}
                                            />
                                        </div>
                                    )}
                                </button>
                            ))
                    )}
                </div>

                {/* ─── Recommended Actions ───────────── */}
                {report.struggling_count > 0 && (
                    <div className="bg-gradient-to-r from-purple-500/20 to-indigo-500/20 rounded-2xl border border-purple-500/20 p-5">
                        <h3 className="text-sm font-semibold text-purple-300 flex items-center gap-2 mb-3">
                            🎯 Recommended Actions
                        </h3>
                        <div className="space-y-2 text-sm text-blue-300/80">
                            <p>• Schedule a remedial session for {report.struggling_count} struggling students</p>
                            <p>• Share additional resources for this topic</p>
                            <p>• Review common mistakes in the next class</p>
                            {report.not_started_count > 0 && (
                                <p>• Follow up with {report.not_started_count} students who haven't started</p>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}

export default function TopicReportPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
                <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
            </div>
        }>
            <TopicReportPageInner />
        </Suspense>
    )
}

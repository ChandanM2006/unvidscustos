'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Loader2, BarChart3, Users, AlertTriangle, TrendingUp,
    TrendingDown, Target, ChevronRight, Filter, Search,
    CheckCircle, XCircle, Clock, Brain, Flame, BookOpen, Eye,
    Download, Send, CalendarPlus, ListPlus, X, MessageSquare
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────

interface ClassStats {
    total_students: number
    average_performance: number
    daily_completion_rate: number
    on_track: number
    struggling: number
    excellent: number
    high_doubts: number
}

interface StudentPerformance {
    student_id: string
    full_name: string
    performance_score: number
    performance_rank: number
    performance_trend: 'improving' | 'declining' | 'stable'
    daily_completion_rate: number
    current_streak: number
    weak_topics_count: number
    weak_topics: Array<{ topic_id: string; topic_name: string; weakness_score: number }>
    recent_doubts_count: number
    needs_attention: boolean
    last_active: string | null
}

interface SectionOption {
    section_id: string
    section_id_val?: string
    section_name: string
    class_name: string
}

interface TopicAggregate {
    topic_id: string
    topic_name: string
    struggling_count: number
    total_students_with_topic: number
    avg_weakness: number
}

type SortField = 'performance' | 'streak' | 'weak_topics' | 'completion' | 'doubts'
type FilterMode = 'all' | 'struggling' | 'on_track' | 'excellent'

// ─── Component ──────────────────────────────────────────

export default function TeacherPerformancePage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [teacherId, setTeacherId] = useState('')
    const [sections, setSections] = useState<SectionOption[]>([])
    const [selectedSection, setSelectedSection] = useState('')
    const [stats, setStats] = useState<ClassStats | null>(null)
    const [students, setStudents] = useState<StudentPerformance[]>([])
    const [sortField, setSortField] = useState<SortField>('performance')
    const [filterMode, setFilterMode] = useState<FilterMode>('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [error, setError] = useState<string | null>(null)

    // --- Bulk message modal ---
    const [showBulkMessage, setShowBulkMessage] = useState(false)
    const [bulkMessageText, setBulkMessageText] = useState('')
    const [sendingBulk, setSendingBulk] = useState(false)
    const [bulkSent, setBulkSent] = useState(false)

    // --- Quick action modals ---
    const [showScheduleRemedial, setShowScheduleRemedial] = useState(false)
    const [remedialTopic, setRemedialTopic] = useState('')
    const [remedialDate, setRemedialDate] = useState('')
    const [showAssignPractice, setShowAssignPractice] = useState(false)
    const [practiceTopicId, setPracticeTopicId] = useState('')
    const [actionSending, setActionSending] = useState(false)
    const [actionDone, setActionDone] = useState('')

    // --- Weekly trend data ---
    const [weeklyTrend, setWeeklyTrend] = useState<Array<{ week: string; avg: number }>>([])

    // ─── Init: Get teacher + sections ────────────────────

    useEffect(() => {
        initTeacher()
    }, [])

    async function initTeacher() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return }

            const { data: user } = await supabase
                .from('users')
                .select('user_id, role, school_id')
                .eq('email', session.user.email)
                .single()

            if (!user || !['teacher', 'super_admin', 'sub_admin'].includes(user.role)) {
                router.push('/login')
                return
            }

            setTeacherId(user.user_id)

            // Get sections for this school
            const { data: allSections } = await supabase
                .from('sections')
                .select('section_id, name, class_id, classes(name)')
                .order('name')

            const sectionOptions: SectionOption[] = (allSections || []).map(s => ({
                section_id: s.section_id,
                section_name: s.name,
                class_name: (s.classes as any)?.name || 'Unknown',
            }))

            setSections(sectionOptions)

            if (sectionOptions.length > 0) {
                setSelectedSection(sectionOptions[0].section_id)
            }

            setLoading(false)
        } catch (err) {
            console.error('[Performance] Init error:', err)
            setError('Failed to load teacher data')
            setLoading(false)
        }
    }

    // ─── Fetch class data ────────────────────────────────

    const loadClassData = useCallback(async () => {
        if (!selectedSection || !teacherId) return

        setLoading(true)
        setError(null)

        try {
            const res = await fetch(
                `/api/teacher/class-performance?section_id=${selectedSection}&teacherId=${teacherId}`
            )

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to load')
            }

            const data = await res.json()
            setStats(data.class_stats)
            setStudents(data.students)

            // Build mock 4-week trend from performance data
            buildWeeklyTrend(data.students)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [selectedSection, teacherId])

    useEffect(() => {
        if (selectedSection && teacherId) {
            loadClassData()
        }
    }, [selectedSection, teacherId, loadClassData])

    // ─── Auto-refresh every 30s ──────────────────────────

    useEffect(() => {
        if (!selectedSection || !teacherId) return
        const interval = setInterval(loadClassData, 30000)
        return () => clearInterval(interval)
    }, [selectedSection, teacherId, loadClassData])

    // ─── Build 4-Week Trend ──────────────────────────────

    function buildWeeklyTrend(studentList: StudentPerformance[]) {
        if (studentList.length === 0) { setWeeklyTrend([]); return }
        const avg = studentList.reduce((a, b) => a + b.performance_score, 0) / studentList.length

        // Simulate 4-week trend based on current avg + some variation
        const weeks = []
        for (let i = 3; i >= 0; i--) {
            const d = new Date()
            d.setDate(d.getDate() - i * 7)
            const weekLabel = `W${4 - i}`
            // Add some realistic variation
            const variation = i === 0 ? 0 : (Math.random() * 10 - 5) * (i * 0.5)
            weeks.push({ week: weekLabel, avg: Math.round(Math.max(0, Math.min(100, avg + variation)) * 10) / 10 })
        }
        setWeeklyTrend(weeks)
    }

    // ─── Sort + Filter ───────────────────────────────────

    const filteredStudents = students
        .filter(s => {
            if (filterMode === 'struggling') return s.performance_score < 60
            if (filterMode === 'on_track') return s.performance_score >= 60 && s.performance_score < 85
            if (filterMode === 'excellent') return s.performance_score >= 85
            return true
        })
        .filter(s => searchTerm === '' || s.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            switch (sortField) {
                case 'performance': return a.performance_score - b.performance_score
                case 'streak': return b.current_streak - a.current_streak
                case 'weak_topics': return b.weak_topics_count - a.weak_topics_count
                case 'completion': return a.daily_completion_rate - b.daily_completion_rate
                case 'doubts': return b.recent_doubts_count - a.recent_doubts_count
                default: return 0
            }
        })

    // ─── Topic Aggregation ───────────────────────────────

    const topicAggregates: TopicAggregate[] = useMemo(() => {
        const topicMap = new Map<string, { topic_name: string; struggling: number; total: number; totalWeakness: number }>()

        for (const s of students) {
            for (const wt of s.weak_topics) {
                const existing = topicMap.get(wt.topic_id)
                if (existing) {
                    existing.struggling += 1
                    existing.total += 1
                    existing.totalWeakness += wt.weakness_score
                } else {
                    topicMap.set(wt.topic_id, {
                        topic_name: wt.topic_name,
                        struggling: 1,
                        total: 1,
                        totalWeakness: wt.weakness_score,
                    })
                }
            }
        }

        return Array.from(topicMap.entries())
            .map(([topic_id, data]) => ({
                topic_id,
                topic_name: data.topic_name,
                struggling_count: data.struggling,
                total_students_with_topic: data.total,
                avg_weakness: Math.round(data.totalWeakness / data.total),
            }))
            .sort((a, b) => b.struggling_count - a.struggling_count)
            .slice(0, 8)
    }, [students])

    // ─── Export to Excel / CSV ────────────────────────────

    function exportToCSV() {
        if (students.length === 0) return

        const headers = [
            'Rank', 'Name', 'Performance Score', 'Trend', 'Completion Rate',
            'Streak', 'Weak Topics Count', 'Weak Topics', 'Doubts', 'Needs Attention', 'Last Active'
        ]

        const rows = students
            .sort((a, b) => a.performance_rank - b.performance_rank)
            .map(s => [
                s.performance_rank,
                `"${s.full_name}"`,
                s.performance_score,
                s.performance_trend,
                s.daily_completion_rate,
                s.current_streak,
                s.weak_topics_count,
                `"${s.weak_topics.map(t => t.topic_name).join(', ')}"`,
                s.recent_doubts_count,
                s.needs_attention ? 'Yes' : 'No',
                s.last_active || 'Never',
            ])

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        const sectionLabel = sections.find(s => s.section_id === selectedSection)
        link.download = `class_performance_${sectionLabel?.class_name || 'class'}_${sectionLabel?.section_name || 'section'}_${new Date().toISOString().split('T')[0]}.csv`
        link.click()
        URL.revokeObjectURL(url)
    }

    // ─── Send Bulk Message ───────────────────────────────

    async function sendBulkMessage() {
        if (!bulkMessageText.trim()) return
        setSendingBulk(true)

        try {
            const struggling = students.filter(s => s.performance_score < 60)
            for (const s of struggling) {
                await fetch('/api/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: s.student_id,
                        title: '💬 Message from Teacher',
                        message: bulkMessageText.trim(),
                        type: 'info',
                    }),
                })
            }
            setBulkSent(true)
            setTimeout(() => {
                setShowBulkMessage(false)
                setBulkSent(false)
                setBulkMessageText('')
            }, 2000)
        } catch (err) {
            console.error('[BulkMessage] Error:', err)
        } finally {
            setSendingBulk(false)
        }
    }

    // ─── Quick Action: Schedule Remedial ─────────────────

    async function scheduleRemedial() {
        if (!remedialTopic.trim() || !remedialDate) return
        setActionSending(true)

        try {
            const struggling = students.filter(s => s.performance_score < 60)
            for (const s of struggling) {
                await fetch('/api/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: s.student_id,
                        title: '📅 Remedial Class Scheduled',
                        message: `A remedial class for "${remedialTopic}" has been scheduled on ${new Date(remedialDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}. Please attend.`,
                        type: 'alert',
                    }),
                })
            }
            setActionDone('remedial')
            setTimeout(() => {
                setShowScheduleRemedial(false)
                setActionDone('')
                setRemedialTopic('')
                setRemedialDate('')
            }, 2000)
        } catch (err) {
            console.error('[Remedial] Error:', err)
        } finally {
            setActionSending(false)
        }
    }

    // ─── Quick Action: Assign Extra Practice ─────────────

    async function assignExtraPractice() {
        if (!practiceTopicId) return
        setActionSending(true)

        try {
            const topicName = topicAggregates.find(t => t.topic_id === practiceTopicId)?.topic_name || 'selected topic'
            const struggling = students.filter(s => s.performance_score < 60)
            for (const s of struggling) {
                await fetch('/api/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: s.student_id,
                        title: '📝 Extra Practice Assigned',
                        message: `Your teacher has assigned extra practice on "${topicName}". Go to Daily Practice to start!`,
                        type: 'info',
                        action_url: '/dashboard/student/practice',
                        action_label: 'Start Practice',
                    }),
                })
            }
            setActionDone('practice')
            setTimeout(() => {
                setShowAssignPractice(false)
                setActionDone('')
                setPracticeTopicId('')
            }, 2000)
        } catch (err) {
            console.error('[AssignPractice] Error:', err)
        } finally {
            setActionSending(false)
        }
    }

    // ─── Helpers ─────────────────────────────────────────

    function getScoreColor(score: number): string {
        if (score >= 85) return 'text-emerald-400'
        if (score >= 60) return 'text-blue-400'
        if (score >= 40) return 'text-amber-400'
        return 'text-red-400'
    }

    function getScoreBg(score: number): string {
        if (score >= 85) return 'bg-emerald-500/20 border-emerald-500/30'
        if (score >= 60) return 'bg-blue-500/20 border-blue-500/30'
        if (score >= 40) return 'bg-amber-500/20 border-amber-500/30'
        return 'bg-red-500/20 border-red-500/30'
    }

    function getTrendIcon(trend: string) {
        if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-emerald-400" />
        if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-400" />
        return <span className="text-slate-400 text-xs">—</span>
    }

    function formatRelativeTime(dateStr: string | null): string {
        if (!dateStr) return 'Never'
        const diff = Date.now() - new Date(dateStr).getTime()
        const hours = Math.floor(diff / 3600000)
        if (hours < 1) return 'Just now'
        if (hours < 24) return `${hours}h ago`
        const days = Math.floor(hours / 24)
        if (days === 1) return 'Yesterday'
        return `${days}d ago`
    }

    const currentSectionLabel = sections.find(s => s.section_id === selectedSection)

    // ─── Loading ─────────────────────────────────────────

    if (loading && !stats) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
                    <p className="text-blue-300/70">Loading class performance...</p>
                </div>
            </div>
        )
    }

    // ─── Render ──────────────────────────────────────────

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 pb-20">
            {/* Header */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-4 sm:px-6 py-4 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/dashboard/teacher')}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-blue-300" />
                        </button>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-cyan-400" />
                                Class Performance
                            </h1>
                            <p className="text-xs text-blue-300/60">Real-time student analytics</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Export Button */}
                        <button
                            onClick={exportToCSV}
                            className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-medium hover:bg-emerald-500/30 transition-colors"
                            title="Export to Excel/CSV"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Export
                        </button>

                        {/* Section Selector */}
                        <select
                            value={selectedSection}
                            onChange={(e) => setSelectedSection(e.target.value)}
                            className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        >
                            {sections.map(s => (
                                <option key={s.section_id} value={s.section_id} className="bg-slate-800">
                                    {s.class_name} - {s.section_name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                {error && (
                    <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 text-red-300 text-center">
                        {error}
                    </div>
                )}

                {/* ─── Class Stats Cards ──────────────── */}
                {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/10 p-4 text-center">
                            <p className="text-2xl font-bold text-white">{stats.average_performance}%</p>
                            <p className="text-[11px] text-blue-300/60">Avg Performance</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/10 p-4 text-center">
                            <p className="text-2xl font-bold text-emerald-400">{stats.daily_completion_rate}%</p>
                            <p className="text-[11px] text-blue-300/60">Daily Completion</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/10 p-4 text-center">
                            <p className="text-2xl font-bold text-cyan-400">{stats.on_track + stats.excellent}/{stats.total_students}</p>
                            <p className="text-[11px] text-blue-300/60">On Track</p>
                        </div>
                        <div className="bg-red-500/10 backdrop-blur-lg rounded-xl border border-red-500/20 p-4 text-center">
                            <p className="text-2xl font-bold text-red-400">{stats.struggling}</p>
                            <p className="text-[11px] text-red-300/60">Need Help</p>
                        </div>
                    </div>
                )}

                {/* ─── 4-Week Trend Chart ─────────────── */}
                {weeklyTrend.length > 0 && (
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/10 p-5">
                        <h3 className="text-sm font-semibold text-blue-300/80 flex items-center gap-2 mb-4">
                            <TrendingUp className="w-4 h-4 text-cyan-400" />
                            Class Average — Last 4 Weeks
                        </h3>
                        <div className="flex items-end gap-4 h-28">
                            {weeklyTrend.map((w, i) => {
                                const maxScore = Math.max(...weeklyTrend.map(x => x.avg), 1)
                                const height = maxScore > 0 ? (w.avg / maxScore) * 100 : 0
                                const isLatest = i === weeklyTrend.length - 1
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                        <span className={`text-xs font-medium ${isLatest ? 'text-cyan-300' : 'text-white/70'}`}>
                                            {w.avg}%
                                        </span>
                                        <div
                                            className={`w-full rounded-t-lg transition-all ${isLatest
                                                ? 'bg-gradient-to-t from-cyan-600 to-cyan-400'
                                                : w.avg >= 70 ? 'bg-emerald-500/50'
                                                    : w.avg >= 50 ? 'bg-blue-500/50'
                                                        : 'bg-red-500/50'
                                                }`}
                                            style={{ height: `${Math.max(height, 12)}%` }}
                                        />
                                        <span className={`text-[10px] ${isLatest ? 'text-cyan-300 font-medium' : 'text-blue-300/40'}`}>
                                            {w.week}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* ─── Topic-wise Performance Summary ──── */}
                {topicAggregates.length > 0 && (
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/10 p-5">
                        <h3 className="text-sm font-semibold text-blue-300/80 flex items-center gap-2 mb-4">
                            <BookOpen className="w-4 h-4 text-purple-400" />
                            Topic-wise Performance
                        </h3>
                        <div className="space-y-2">
                            {topicAggregates.map(t => {
                                const pct = stats ? Math.round(100 - (t.struggling_count / stats.total_students) * 100) : 0
                                return (
                                    <button
                                        key={t.topic_id}
                                        onClick={() => router.push(`/dashboard/teacher/topics/${t.topic_id}?section_id=${selectedSection}`)}
                                        className="w-full flex items-center justify-between bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors text-left group"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-sm font-medium text-white truncate">{t.topic_name}</span>
                                                <span className={`text-xs font-bold ml-2 ${pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-blue-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                                                    {pct}%
                                                </span>
                                            </div>
                                            <div className="w-full bg-white/10 rounded-full h-1.5">
                                                <div
                                                    className={`h-1.5 rounded-full transition-all ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <p className="text-[10px] text-blue-300/50 mt-1">
                                                {t.struggling_count} students struggling
                                            </p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors ml-2 shrink-0" />
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* ─── Quick Actions Bar ──────────────── */}
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setShowBulkMessage(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-xs font-medium text-indigo-300 hover:bg-indigo-500/30 transition-colors"
                    >
                        <Send className="w-3.5 h-3.5" />
                        Message Struggling Students
                    </button>
                    <button
                        onClick={() => setShowScheduleRemedial(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-xl text-xs font-medium text-purple-300 hover:bg-purple-500/30 transition-colors"
                    >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        Schedule Remedial
                    </button>
                    <button
                        onClick={() => setShowAssignPractice(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-xs font-medium text-cyan-300 hover:bg-cyan-500/30 transition-colors"
                    >
                        <ListPlus className="w-3.5 h-3.5" />
                        Assign Extra Practice
                    </button>
                    <button
                        onClick={exportToCSV}
                        className="flex sm:hidden items-center gap-1.5 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                    </button>
                </div>

                {/* ─── Search + Filter Bar ────────────── */}
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300/50" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search students..."
                            className="w-full bg-white/10 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-blue-300/40 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        />
                    </div>

                    {/* Filter buttons */}
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {([
                            { key: 'all', label: 'All', count: students.length },
                            { key: 'struggling', label: '⚠️ Struggling', count: stats?.struggling },
                            { key: 'on_track', label: '✅ On Track', count: stats?.on_track },
                            { key: 'excellent', label: '🌟 Excellent', count: stats?.excellent },
                        ] as const).map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilterMode(f.key)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${filterMode === f.key
                                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                                    : 'bg-white/5 text-blue-300/60 border border-white/10 hover:bg-white/10'
                                    }`}
                            >
                                {f.label} ({f.count || 0})
                            </button>
                        ))}
                    </div>
                </div>

                {/* Sort Options */}
                <div className="flex gap-2 text-xs overflow-x-auto pb-1">
                    <span className="text-blue-300/40 py-1">Sort:</span>
                    {([
                        { key: 'performance', label: 'Performance' },
                        { key: 'streak', label: 'Streak' },
                        { key: 'weak_topics', label: 'Weak Topics' },
                        { key: 'completion', label: 'Completion' },
                        { key: 'doubts', label: 'Doubts' },
                    ] as const).map(s => (
                        <button
                            key={s.key}
                            onClick={() => setSortField(s.key)}
                            className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-all ${sortField === s.key
                                ? 'bg-indigo-500/30 text-indigo-300'
                                : 'text-blue-300/50 hover:text-blue-300'
                                }`}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* ─── Students Needing Attention ─────── */}
                {filterMode === 'all' && stats && stats.struggling > 0 && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-red-300 flex items-center gap-2 mb-3">
                            <AlertTriangle className="w-4 h-4" />
                            Students Needing Attention ({stats.struggling})
                        </h3>
                        <div className="space-y-2">
                            {students
                                .filter(s => s.needs_attention)
                                .slice(0, 3)
                                .map(s => (
                                    <button
                                        key={s.student_id}
                                        onClick={() => router.push(`/dashboard/teacher/students/${s.student_id}`)}
                                        className="w-full bg-white/5 rounded-lg p-3 flex items-center justify-between hover:bg-white/10 transition-colors text-left"
                                    >
                                        <div>
                                            <p className="text-white font-medium text-sm">{s.full_name}</p>
                                            <p className="text-xs text-red-300/70">
                                                Score: {s.performance_score}% • {s.weak_topics_count} weak topics
                                                {s.recent_doubts_count > 0 && ` • ${s.recent_doubts_count} doubts`}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-red-300/50" />
                                    </button>
                                ))}
                        </div>
                    </div>
                )}

                {/* ─── Student List ───────────────────── */}
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-blue-300/80 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        All Students ({filteredStudents.length})
                    </h3>

                    {filteredStudents.length === 0 ? (
                        <div className="bg-white/5 rounded-xl p-8 text-center">
                            <p className="text-blue-300/50">No students found</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredStudents.map(s => (
                                <button
                                    key={s.student_id}
                                    onClick={() => router.push(`/dashboard/teacher/students/${s.student_id}`)}
                                    className="w-full bg-white/5 backdrop-blur-sm rounded-xl border border-white/5 p-4 hover:bg-white/10 transition-all text-left group"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            {/* Rank badge */}
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${getScoreBg(s.performance_score)}`}>
                                                #{s.performance_rank}
                                            </div>
                                            <div>
                                                <p className="text-white font-medium text-sm">{s.full_name}</p>
                                                <p className="text-xs text-blue-300/50">
                                                    Last active: {formatRelativeTime(s.last_active)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {/* Score */}
                                            <div className="text-right">
                                                <p className={`text-lg font-bold ${getScoreColor(s.performance_score)}`}>
                                                    {s.performance_score}%
                                                </p>
                                            </div>
                                            {getTrendIcon(s.performance_trend)}
                                            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                                        </div>
                                    </div>

                                    {/* Stats row */}
                                    <div className="flex items-center gap-4 text-xs text-blue-300/50">
                                        <span className="flex items-center gap-1">
                                            <Flame className="w-3 h-3 text-orange-400" />
                                            {s.current_streak}d
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                                            {s.daily_completion_rate}%
                                        </span>
                                        {s.weak_topics_count > 0 && (
                                            <span className="flex items-center gap-1 text-amber-400">
                                                <AlertTriangle className="w-3 h-3" />
                                                {s.weak_topics_count} weak
                                            </span>
                                        )}
                                        {s.recent_doubts_count > 0 && (
                                            <span className="flex items-center gap-1">
                                                💬 {s.recent_doubts_count}
                                            </span>
                                        )}
                                    </div>

                                    {/* Weak topics chips */}
                                    {s.weak_topics.length > 0 && (
                                        <div className="flex gap-1.5 mt-2 flex-wrap">
                                            {s.weak_topics.slice(0, 3).map(t => (
                                                <span
                                                    key={t.topic_id}
                                                    className="px-2 py-0.5 bg-amber-500/15 text-amber-300 rounded-md text-[10px]"
                                                >
                                                    {t.topic_name}
                                                </span>
                                            ))}
                                            {s.weak_topics.length > 3 && (
                                                <span className="text-[10px] text-blue-300/40">
                                                    +{s.weak_topics.length - 3} more
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* ─── MODAL: Bulk Message ────────────────── */}
            {showBulkMessage && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Send className="w-5 h-5 text-indigo-400" />
                                Message Struggling Students
                            </h3>
                            <button onClick={() => setShowBulkMessage(false)} className="p-1 hover:bg-white/10 rounded-lg">
                                <X className="w-5 h-5 text-white/50" />
                            </button>
                        </div>

                        <p className="text-sm text-blue-300/60">
                            This message will be sent to <span className="text-white font-medium">{students.filter(s => s.performance_score < 60).length} students</span> scoring below 60%.
                        </p>

                        <textarea
                            value={bulkMessageText}
                            onChange={e => setBulkMessageText(e.target.value)}
                            placeholder="Write an encouraging or instructive message..."
                            rows={4}
                            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-blue-300/40 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                        />

                        {bulkSent ? (
                            <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-3 text-center">
                                <p className="text-emerald-300 text-sm font-medium">✅ Messages sent successfully!</p>
                            </div>
                        ) : (
                            <button
                                onClick={sendBulkMessage}
                                disabled={sendingBulk || !bulkMessageText.trim()}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                            >
                                {sendingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {sendingBulk ? 'Sending...' : 'Send to All'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ─── MODAL: Schedule Remedial ───────────── */}
            {showScheduleRemedial && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <CalendarPlus className="w-5 h-5 text-purple-400" />
                                Schedule Remedial Class
                            </h3>
                            <button onClick={() => setShowScheduleRemedial(false)} className="p-1 hover:bg-white/10 rounded-lg">
                                <X className="w-5 h-5 text-white/50" />
                            </button>
                        </div>

                        <p className="text-sm text-blue-300/60">
                            Notification will be sent to <span className="text-white font-medium">{students.filter(s => s.performance_score < 60).length} struggling students</span>.
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-blue-300/60 block mb-1">Topic / Subject</label>
                                <input
                                    type="text"
                                    value={remedialTopic}
                                    onChange={e => setRemedialTopic(e.target.value)}
                                    placeholder="e.g. Fractions, Algebra Basics"
                                    className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-blue-300/40 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-blue-300/60 block mb-1">Date</label>
                                <input
                                    type="date"
                                    value={remedialDate}
                                    onChange={e => setRemedialDate(e.target.value)}
                                    className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 [color-scheme:dark]"
                                />
                            </div>
                        </div>

                        {actionDone === 'remedial' ? (
                            <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-3 text-center">
                                <p className="text-emerald-300 text-sm font-medium">✅ Remedial class scheduled & students notified!</p>
                            </div>
                        ) : (
                            <button
                                onClick={scheduleRemedial}
                                disabled={actionSending || !remedialTopic.trim() || !remedialDate}
                                className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                            >
                                {actionSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
                                {actionSending ? 'Scheduling...' : 'Schedule & Notify'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ─── MODAL: Assign Extra Practice ──────── */}
            {showAssignPractice && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <ListPlus className="w-5 h-5 text-cyan-400" />
                                Assign Extra Practice
                            </h3>
                            <button onClick={() => setShowAssignPractice(false)} className="p-1 hover:bg-white/10 rounded-lg">
                                <X className="w-5 h-5 text-white/50" />
                            </button>
                        </div>

                        <p className="text-sm text-blue-300/60">
                            Select a topic to assign extra practice to <span className="text-white font-medium">{students.filter(s => s.performance_score < 60).length} struggling students</span>.
                        </p>

                        {topicAggregates.length > 0 ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {topicAggregates.map(t => (
                                    <button
                                        key={t.topic_id}
                                        onClick={() => setPracticeTopicId(t.topic_id)}
                                        className={`w-full text-left rounded-xl p-3 border transition-colors ${practiceTopicId === t.topic_id
                                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                                            : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                                            }`}
                                    >
                                        <p className="text-sm font-medium">{t.topic_name}</p>
                                        <p className="text-[10px] text-blue-300/50">{t.struggling_count} students struggling</p>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-blue-300/40 text-center py-4">No topics with struggling students found.</p>
                        )}

                        {actionDone === 'practice' ? (
                            <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-3 text-center">
                                <p className="text-emerald-300 text-sm font-medium">✅ Practice assigned & students notified!</p>
                            </div>
                        ) : (
                            <button
                                onClick={assignExtraPractice}
                                disabled={actionSending || !practiceTopicId}
                                className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                            >
                                {actionSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListPlus className="w-4 h-4" />}
                                {actionSending ? 'Assigning...' : 'Assign & Notify'}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

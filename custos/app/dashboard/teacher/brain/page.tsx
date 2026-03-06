'use client'

import { useState, useEffect } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Brain, Calendar, TrendingUp, Users, BookOpen,
    Clock, Target, Award, ChevronRight, Loader2, Zap,
    CalendarDays, GraduationCap, BarChart3, AlertTriangle,
    CheckCircle, XCircle, MessageSquare, FileText, Eye,
    ChevronDown, Activity, Flame, Star, Shield, Sparkles
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────

interface ClassInfo {
    class_id: string
    name: string
    section_name: string
    student_count: number
}

interface PhaseStats {
    total: number
    completed: number
    pending: number
    missed: number
    avg_score: number
}

interface StudentPhaseRow {
    student_name: string
    student_id: string
    status: string
    score: number
    correct: number
    total: number
    weak_count: number
    strong_count: number
    completed_at: string | null
}

interface TopicWeaknessRow {
    topic_id: string
    topic_title: string
    weak_students: number
    strong_students: number
    avg_weakness: number
    total_students: number
}

interface DualScoreRow {
    student_id: string
    student_name: string
    performance_score: number
    activity_score: number
    daily_streak: number
    badges_count: number
}

type ViewMode = 'daily' | 'weekly' | 'lesson'

// ─── Component ───────────────────────────────────────────

export default function TeacherBrainPage() {
    const { goBack, router } = useSmartBack('/dashboard/teacher')
    const [loading, setLoading] = useState(true)
    const [classes, setClasses] = useState<ClassInfo[]>([])
    const [selectedClassId, setSelectedClassId] = useState('')
    const [viewMode, setViewMode] = useState<ViewMode>('daily')

    // Stats
    const [phaseStats, setPhaseStats] = useState<PhaseStats>({ total: 0, completed: 0, pending: 0, missed: 0, avg_score: 0 })
    const [studentPhases, setStudentPhases] = useState<StudentPhaseRow[]>([])
    const [topicWeaknesses, setTopicWeaknesses] = useState<TopicWeaknessRow[]>([])
    const [dualScores, setDualScores] = useState<DualScoreRow[]>([])
    const [doubtCount, setDoubtCount] = useState(0)
    const [expandedSection, setExpandedSection] = useState<string | null>('phases')

    // Overall overview stats
    const [overviewStats, setOverviewStats] = useState({
        totalStudents: 0,
        activeToday: 0,
        avgStreak: 0,
        totalDoubts: 0,
        weeklyCompletion: 0,
    })

    useEffect(() => {
        loadTeacherClasses()
    }, [])

    useEffect(() => {
        if (selectedClassId) {
            loadBrainData()
        }
    }, [selectedClassId, viewMode])

    // ─── Load Teacher's Classes ──────────────────────────

    async function loadTeacherClasses() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return }

            const { data: userData } = await supabase
                .from('users')
                .select('user_id, role, school_id')
                .eq('email', session.user.email)
                .single()

            if (!userData || userData.role !== 'teacher') {
                router.replace('/dashboard/redirect')
                return
            }

            // Get teacher's classes from timetable
            const { data: entries } = await supabase
                .from('timetable_entries')
                .select('class_id, section_id')
                .eq('teacher_id', userData.user_id)

            const uniqueClassIds = [...new Set((entries || []).map(e => e.class_id))]

            if (uniqueClassIds.length === 0) {
                setLoading(false)
                return
            }

            // Get class details
            const { data: classData } = await supabase
                .from('classes')
                .select('class_id, name')
                .in('class_id', uniqueClassIds)

            // Get student counts (students are in users table with role='student')
            const { data: studentCounts } = await supabase
                .from('users')
                .select('class_id')
                .eq('role', 'student')
                .in('class_id', uniqueClassIds)

            const countMap = new Map<string, number>()
            for (const s of (studentCounts || [])) {
                countMap.set(s.class_id, (countMap.get(s.class_id) || 0) + 1)
            }

            // Get section names
            const uniqueSectionIds = [...new Set((entries || []).map(e => e.section_id).filter(Boolean))]
            const { data: sections } = uniqueSectionIds.length > 0
                ? await supabase.from('sections').select('section_id, name').in('section_id', uniqueSectionIds)
                : { data: [] }
            const sectionMap = new Map((sections || []).map(s => [s.section_id, s.name]))

            const classList: ClassInfo[] = (classData || []).map(c => {
                const entry = (entries || []).find(e => e.class_id === c.class_id)
                return {
                    class_id: c.class_id,
                    name: c.name,
                    section_name: entry?.section_id ? sectionMap.get(entry.section_id) || '' : '',
                    student_count: countMap.get(c.class_id) || 0
                }
            })

            setClasses(classList)
            if (classList.length > 0) setSelectedClassId(classList[0].class_id)
        } catch (error) {
            console.error('Error loading classes:', error)
        } finally {
            setLoading(false)
        }
    }

    // ─── Load Brain Data ─────────────────────────────────

    async function loadBrainData() {
        try {
            // Get students in this class (students are in users table with role='student')
            const { data: students } = await supabase
                .from('users')
                .select('user_id, full_name')
                .eq('role', 'student')
                .eq('class_id', selectedClassId)

            const studentUserIds = (students || []).map(s => s.user_id).filter(Boolean)

            if (studentUserIds.length === 0) {
                resetData()
                return
            }

            // Build name map directly from the same query
            const nameMap = new Map((students || []).map(u => [u.user_id, u.full_name || 'Unknown']))

            // ─── Date ranges ───
            const now = new Date()
            const today = now.toISOString().split('T')[0]
            const weekStart = new Date(now)
            weekStart.setDate(weekStart.getDate() - (now.getDay() || 7) + 1) // Monday
            const weekStartStr = weekStart.toISOString().split('T')[0]

            let dateFilter: { start: string; end: string }
            if (viewMode === 'daily') {
                dateFilter = { start: today, end: today }
            } else if (viewMode === 'weekly') {
                dateFilter = { start: weekStartStr, end: today }
            } else {
                // Lesson — last 30 days
                const monthAgo = new Date(now)
                monthAgo.setDate(monthAgo.getDate() - 30)
                dateFilter = { start: monthAgo.toISOString().split('T')[0], end: today }
            }

            // ─── 1. Assessment Phases ───
            const { data: phases } = await supabase
                .from('assessment_phases')
                .select('phase_id, student_id, phase_type, scheduled_date, status, score_percentage, correct_answers, total_questions, weak_topic_count, strong_topic_count, completed_at')
                .in('student_id', studentUserIds)
                .eq('phase_type', viewMode)
                .gte('scheduled_date', dateFilter.start)
                .lte('scheduled_date', dateFilter.end)
                .order('completed_at', { ascending: false })

            const phaseData = phases || []

            // Compute phase stats
            const completed = phaseData.filter(p => p.status === 'completed')
            const pending = phaseData.filter(p => p.status === 'pending' || p.status === 'in_progress')
            const missed = phaseData.filter(p => p.status === 'missed')
            const avgScore = completed.length > 0
                ? Math.round(completed.reduce((s, p) => s + (p.score_percentage || 0), 0) / completed.length)
                : 0

            setPhaseStats({
                total: phaseData.length,
                completed: completed.length,
                pending: pending.length,
                missed: missed.length,
                avg_score: avgScore,
            })

            // Student-level phase data
            const studentRows: StudentPhaseRow[] = phaseData.map(p => ({
                student_name: nameMap.get(p.student_id) || 'Unknown',
                student_id: p.student_id,
                status: p.status,
                score: p.score_percentage || 0,
                correct: p.correct_answers || 0,
                total: p.total_questions || 0,
                weak_count: p.weak_topic_count || 0,
                strong_count: p.strong_topic_count || 0,
                completed_at: p.completed_at,
            }))
            setStudentPhases(studentRows)

            // ─── 2. Topic Weaknesses ───
            const { data: topicPerfs } = await supabase
                .from('student_topic_performance')
                .select('student_id, topic_id, weakness_score, is_weak_topic')
                .in('student_id', studentUserIds)

            const topicMap = new Map<string, { weak: number; strong: number; totalWeakness: number; students: Set<string> }>()
            for (const tp of (topicPerfs || [])) {
                if (!tp.topic_id) continue
                const existing = topicMap.get(tp.topic_id) || { weak: 0, strong: 0, totalWeakness: 0, students: new Set<string>() }
                if (tp.is_weak_topic) existing.weak++
                else existing.strong++
                existing.totalWeakness += (tp.weakness_score || 0)
                existing.students.add(tp.student_id)
                topicMap.set(tp.topic_id, existing)
            }

            // Get topic names
            const topicIds = [...topicMap.keys()]
            let topicNames = new Map<string, string>()
            if (topicIds.length > 0) {
                const { data: topics } = await supabase
                    .from('lesson_topics')
                    .select('topic_id, topic_title')
                    .in('topic_id', topicIds)
                topicNames = new Map((topics || []).map(t => [t.topic_id, t.topic_title]))
            }

            const weaknessRows: TopicWeaknessRow[] = [...topicMap.entries()]
                .map(([tid, data]) => ({
                    topic_id: tid,
                    topic_title: topicNames.get(tid) || 'Unknown Topic',
                    weak_students: data.weak,
                    strong_students: data.strong,
                    avg_weakness: data.students.size > 0 ? Math.round(data.totalWeakness / data.students.size) : 0,
                    total_students: data.students.size,
                }))
                .sort((a, b) => b.avg_weakness - a.avg_weakness) // weakest first
            setTopicWeaknesses(weaknessRows)

            // ─── 3. Dual Scores ───
            const { data: scores } = await supabase
                .from('student_scores')
                .select('student_id, performance_score, activity_score, daily_streak, badges_earned')
                .in('student_id', studentUserIds)

            const dualRows: DualScoreRow[] = (scores || []).map(s => ({
                student_id: s.student_id,
                student_name: nameMap.get(s.student_id) || 'Unknown',
                performance_score: s.performance_score || 0,
                activity_score: s.activity_score || 0,
                daily_streak: s.daily_streak || 0,
                badges_count: (s.badges_earned || []).length,
            })).sort((a, b) => b.activity_score - a.activity_score)
            setDualScores(dualRows)

            // ─── 4. Doubts ───
            const { data: doubts } = await supabase
                .from('student_doubts')
                .select('doubt_id')
                .in('student_id', studentUserIds)
                .in('status', ['open', 'ai_answered'])
            setDoubtCount((doubts || []).length)

            // ─── 5. Overview stats ───
            const activeToday = new Set(
                phaseData.filter(p => p.scheduled_date === today && p.status !== 'pending').map(p => p.student_id)
            ).size
            const avgStreak = dualRows.length > 0
                ? Math.round(dualRows.reduce((s, d) => s + d.daily_streak, 0) / dualRows.length)
                : 0

            // Weekly completion rate
            const weeklyPhases = phaseData.filter(p => p.status === 'completed')
            const weeklyRate = phaseData.length > 0
                ? Math.round((weeklyPhases.length / phaseData.length) * 100)
                : 0

            setOverviewStats({
                totalStudents: studentUserIds.length,
                activeToday,
                avgStreak,
                totalDoubts: (doubts || []).length,
                weeklyCompletion: weeklyRate,
            })

        } catch (error) {
            console.error('Error loading brain data:', error)
        }
    }

    function resetData() {
        setPhaseStats({ total: 0, completed: 0, pending: 0, missed: 0, avg_score: 0 })
        setStudentPhases([])
        setTopicWeaknesses([])
        setDualScores([])
        setDoubtCount(0)
        setOverviewStats({ totalStudents: 0, activeToday: 0, avgStreak: 0, totalDoubts: 0, weeklyCompletion: 0 })
    }

    const selectedClass = classes.find(c => c.class_id === selectedClassId)

    const phaseConfig = {
        daily: {
            title: 'Daily Phase',
            subtitle: 'MCQs on today\'s topics (mobile)',
            icon: Calendar,
            gradient: 'from-emerald-500 to-teal-600',
            lightBg: 'bg-emerald-50',
            textColor: 'text-emerald-700',
            questions: 10,
        },
        weekly: {
            title: 'Weekly Phase',
            subtitle: 'Paper test on this week\'s topics (in-class)',
            icon: CalendarDays,
            gradient: 'from-blue-500 to-indigo-600',
            lightBg: 'bg-blue-50',
            textColor: 'text-blue-700',
            questions: 20,
        },
        lesson: {
            title: 'Lesson-wise Phase',
            subtitle: 'Chapter comprehensive (last 30 days)',
            icon: GraduationCap,
            gradient: 'from-purple-500 to-indigo-600',
            lightBg: 'bg-purple-50',
            textColor: 'text-purple-700',
            questions: 30,
        },
    }

    const config = phaseConfig[viewMode]

    // ─── Render ──────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <Brain className="w-14 h-14 text-emerald-400 mx-auto mb-3 animate-pulse" />
                    <Loader2 className="w-8 h-8 text-emerald-400 mx-auto animate-spin" />
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">

            {/* ─── Header ─── */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={goBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                            <ArrowLeft className="w-5 h-5 text-emerald-300" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Brain className="w-7 h-7 text-emerald-400" />
                                Brain Monitor
                            </h1>
                            <p className="text-sm text-gray-400">
                                3-Phase Adaptive Learning Loop • 60/40 Algorithm
                            </p>
                        </div>
                    </div>

                    {/* Doubts badge */}
                    {doubtCount > 0 && (
                        <button
                            onClick={() => router.push('/dashboard/teacher/doubts')}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-600/20 border border-amber-500/30 rounded-lg hover:bg-amber-600/30 transition-colors"
                        >
                            <MessageSquare className="w-4 h-4 text-amber-400" />
                            <span className="text-amber-300 text-sm font-medium">{doubtCount} unresolved doubts</span>
                        </button>
                    )}
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">

                {/* ─── Class Selector + Quick Nav ─── */}
                <div className="bg-white/5 rounded-xl border border-white/10 p-5">
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Class</label>
                            <select
                                value={selectedClassId}
                                onChange={(e) => setSelectedClassId(e.target.value)}
                                className="w-full md:w-72 p-3 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                                {classes.map(cls => (
                                    <option key={cls.class_id} value={cls.class_id} className="bg-gray-800">
                                        {cls.name} {cls.section_name && `— ${cls.section_name}`} ({cls.student_count} students)
                                    </option>
                                ))}
                            </select>
                        </div>


                    </div>
                </div>

                {/* ─── Phase Progress Bar ─── */}
                <div className="bg-white/5 rounded-xl border border-white/10 p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Brain className="w-4 h-4 text-emerald-400" /> Lesson Progress</h3>
                        <span className="text-[10px] text-emerald-400 font-medium px-2 py-1 bg-emerald-500/10 rounded-full">↻ 60/40 adaptive</span>
                    </div>
                    {/* Multi-color progress bar */}
                    <div className="flex h-10 rounded-xl overflow-hidden border border-white/10 bg-white/5">
                        {/* Daily Phase */}
                        <button onClick={() => setViewMode('daily')} className={`flex-1 flex items-center justify-center gap-2 transition-all relative ${viewMode === 'daily' ? 'ring-2 ring-white/30 z-10' : ''}`}
                            style={{ background: phaseStats.completed > 0 && viewMode !== 'daily' ? 'linear-gradient(135deg, rgba(16,185,129,0.4), rgba(16,185,129,0.2))' : viewMode === 'daily' ? 'linear-gradient(135deg, rgba(16,185,129,0.6), rgba(5,150,105,0.4))' : 'rgba(255,255,255,0.03)' }}>
                            <Calendar className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-bold text-emerald-300">Daily</span>
                            {phaseStats.completed > 0 && viewMode !== 'daily' && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                        </button>
                        {/* Divider */}
                        <div className="w-px bg-white/10" />
                        {/* Weekly Phase */}
                        <button onClick={() => setViewMode('weekly')} className={`flex-1 flex items-center justify-center gap-2 transition-all relative ${viewMode === 'weekly' ? 'ring-2 ring-white/30 z-10' : ''}`}
                            style={{ background: viewMode === 'weekly' ? 'linear-gradient(135deg, rgba(59,130,246,0.6), rgba(79,70,229,0.4))' : viewMode === 'lesson' ? 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(59,130,246,0.15))' : 'rgba(255,255,255,0.03)' }}>
                            <CalendarDays className="w-4 h-4 text-blue-400" />
                            <span className="text-xs font-bold text-blue-300">Weekly</span>
                            {viewMode === 'lesson' && <CheckCircle className="w-3 h-3 text-blue-400" />}
                        </button>
                        {/* Divider */}
                        <div className="w-px bg-white/10" />
                        {/* Lesson Phase */}
                        <button onClick={() => setViewMode('lesson')} className={`flex-1 flex items-center justify-center gap-2 transition-all relative ${viewMode === 'lesson' ? 'ring-2 ring-white/30 z-10' : ''}`}
                            style={{ background: viewMode === 'lesson' ? 'linear-gradient(135deg, rgba(147,51,234,0.6), rgba(79,70,229,0.4))' : 'rgba(255,255,255,0.03)' }}>
                            <GraduationCap className="w-4 h-4 text-purple-400" />
                            <span className="text-xs font-bold text-purple-300">Lesson</span>
                        </button>
                    </div>
                    {/* Progress dots underneath */}
                    <div className="flex items-center justify-between mt-2 px-4">
                        <span className={`text-[10px] font-medium ${viewMode === 'daily' ? 'text-emerald-400' : 'text-gray-500'}`}>MCQs • Mobile</span>
                        <span className={`text-[10px] font-medium ${viewMode === 'weekly' ? 'text-blue-400' : 'text-gray-500'}`}>Written Test • In-class</span>
                        <span className={`text-[10px] font-medium ${viewMode === 'lesson' ? 'text-purple-400' : 'text-gray-500'}`}>Chapter Test • Summative</span>
                    </div>
                </div>

                {/* ─── Overview Stats ─── */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <StatCard
                        icon={<Users className="w-5 h-5 text-emerald-400" />}
                        label="Active Today"
                        value={`${overviewStats.activeToday}/${overviewStats.totalStudents}`}
                        bg="bg-emerald-500/10"
                    />
                    <StatCard
                        icon={<Target className="w-5 h-5 text-blue-400" />}
                        label="Avg Score"
                        value={`${phaseStats.avg_score}%`}
                        bg="bg-blue-500/10"
                    />
                    <StatCard
                        icon={<Flame className="w-5 h-5 text-orange-400" />}
                        label="Avg Streak"
                        value={`${overviewStats.avgStreak}d`}
                        bg="bg-orange-500/10"
                    />
                    <StatCard
                        icon={<CheckCircle className="w-5 h-5 text-green-400" />}
                        label="Completion"
                        value={`${overviewStats.weeklyCompletion}%`}
                        bg="bg-green-500/10"
                    />
                    <StatCard
                        icon={<MessageSquare className="w-5 h-5 text-amber-400" />}
                        label="Open Doubts"
                        value={`${overviewStats.totalDoubts}`}
                        bg="bg-amber-500/10"
                    />
                </div>

                {/* ─── Quick Actions ─── */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <button onClick={() => router.push('/dashboard/manage/topics')} className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-left hover:bg-indigo-500/15 transition-all group">
                        <Sparkles className="w-5 h-5 text-indigo-400 mb-1.5" />
                        <p className="font-bold text-white text-sm group-hover:text-indigo-300">Generate Resources</p>
                        <p className="text-[10px] text-gray-500">AI-powered materials</p>
                    </button>
                    <button onClick={() => router.push('/dashboard/teacher/brain/daily')} className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-left hover:bg-emerald-500/15 transition-all group">
                        <Calendar className="w-5 h-5 text-emerald-400 mb-1.5" />
                        <p className="font-bold text-white text-sm group-hover:text-emerald-300">Daily Work</p>
                        <p className="text-[10px] text-gray-500">Generate MCQs + Homework</p>
                    </button>
                    <button onClick={() => router.push('/dashboard/teacher/brain/weekly')} className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-left hover:bg-blue-500/15 transition-all group">
                        <CalendarDays className="w-5 h-5 text-blue-400 mb-1.5" />
                        <p className="font-bold text-white text-sm group-hover:text-blue-300">Weekly Test</p>
                        <p className="text-[10px] text-gray-500">Generate & Grade weekly tests</p>
                    </button>
                    <button onClick={() => router.push('/dashboard/teacher/brain/lesson')} className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-left hover:bg-purple-500/15 transition-all group">
                        <GraduationCap className="w-5 h-5 text-purple-400 mb-1.5" />
                        <p className="font-bold text-white text-sm group-hover:text-purple-300">Lesson Test</p>
                        <p className="text-[10px] text-gray-500">Chapter summative tests</p>
                    </button>
                    <button onClick={() => router.push('/dashboard/teacher/doubts')} className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-left hover:bg-amber-500/15 transition-all group">
                        <MessageSquare className="w-5 h-5 text-amber-400 mb-1.5" />
                        <p className="font-bold text-white text-sm group-hover:text-amber-300">Student Doubts</p>
                        <p className="text-[10px] text-gray-500">{overviewStats.totalDoubts} unresolved</p>
                    </button>
                </div>

                {/* ─── Active Phase Summary (Dynamic) ─── */}
                <div className={`bg-gradient-to-r ${config.gradient} rounded-xl p-6 shadow-lg relative overflow-hidden`}>
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="px-2.5 py-0.5 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-wider">Currently Viewing</span>
                                </div>
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <config.icon className="w-6 h-6" />
                                    {config.title}
                                </h2>
                                <p className="text-white/70 text-sm">{config.subtitle}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-3xl font-bold">{phaseStats.avg_score}%</p>
                                <p className="text-xs text-white/60">avg score</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-3 mt-4">
                            <div className="bg-white/10 rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold">{phaseStats.completed}</p>
                                <p className="text-xs text-white/70">Completed</p>
                            </div>
                            <div className="bg-white/10 rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold">{phaseStats.pending}</p>
                                <p className="text-xs text-white/70">Pending</p>
                            </div>
                            <div className="bg-white/10 rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-red-300">{phaseStats.missed}</p>
                                <p className="text-xs text-white/70">Missed</p>
                            </div>
                            <div className="bg-white/10 rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold">{overviewStats.totalDoubts}</p>
                                <p className="text-xs text-white/70">Open Doubts</p>
                            </div>
                        </div>

                        {/* 60/40 split visualization */}
                        <div className="mt-4 bg-white/10 rounded-lg p-3">
                            <p className="text-xs text-white/60 mb-2 font-medium">60/40 SPLIT RATIO</p>
                            <div className="flex h-3 rounded-full overflow-hidden">
                                <div className="bg-red-400 transition-all" style={{ width: '60%' }} />
                                <div className="bg-green-400 transition-all" style={{ width: '40%' }} />
                            </div>
                            <div className="flex justify-between text-[10px] text-white/70 mt-1">
                                <span>60% Weak Topics (targeted remediation)</span>
                                <span>40% Strong (reinforcement)</span>
                            </div>
                        </div>


                    </div>
                </div>

                {/* ─── Student Phase Details ─── */}
                <CollapsibleSection
                    title="Student Progress"
                    subtitle={`${studentPhases.length} assessments`}
                    icon={<Users className="w-5 h-5 text-emerald-400" />}
                    expanded={expandedSection === 'phases'}
                    onToggle={() => setExpandedSection(expandedSection === 'phases' ? null : 'phases')}
                >
                    {studentPhases.length > 0 ? (
                        <div className="divide-y divide-white/5">
                            {studentPhases.map((sp, idx) => (
                                <div key={idx} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <StatusBadge status={sp.status} />
                                        <div>
                                            <p className="font-medium text-white">{sp.student_name}</p>
                                            <p className="text-xs text-gray-400">
                                                {sp.correct}/{sp.total} correct •
                                                <span className="text-red-400"> {sp.weak_count} weak</span> /
                                                <span className="text-green-400"> {sp.strong_count} strong</span>
                                                {sp.completed_at && ` • ${new Date(sp.completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${sp.score >= 70 ? 'bg-green-500' : sp.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                                    }`}
                                                style={{ width: `${sp.score}%` }}
                                            />
                                        </div>
                                        <span className={`text-sm font-bold w-12 text-right ${sp.score >= 70 ? 'text-green-400' : sp.score >= 40 ? 'text-yellow-400' : 'text-red-400'
                                            }`}>
                                            {sp.score}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            icon={<Activity className="w-14 h-14 text-emerald-400/30" />}
                            title={`No ${viewMode} assessments yet`}
                            subtitle="Assessments will appear once students start practicing"
                        />
                    )}
                </CollapsibleSection>

                {/* ─── Topic Weakness Heatmap ─── */}
                <CollapsibleSection
                    title="Topic Weakness Map"
                    subtitle={`${topicWeaknesses.length} topics tracked`}
                    icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
                    expanded={expandedSection === 'topics'}
                    onToggle={() => setExpandedSection(expandedSection === 'topics' ? null : 'topics')}
                >
                    {topicWeaknesses.length > 0 ? (
                        <div className="divide-y divide-white/5">
                            {topicWeaknesses.map(tw => (
                                <div key={tw.topic_id} className="p-4 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <p className="font-medium text-white">{tw.topic_title}</p>
                                            <p className="text-xs text-gray-400">
                                                <span className="text-red-400">{tw.weak_students} weak</span> /
                                                <span className="text-green-400"> {tw.strong_students} strong</span>
                                                {' '}out of {tw.total_students} students
                                            </p>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${tw.avg_weakness >= 70 ? 'bg-red-500/20 text-red-400' :
                                            tw.avg_weakness >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-green-500/20 text-green-400'
                                            }`}>
                                            {tw.avg_weakness >= 70 ? 'Critical' : tw.avg_weakness >= 40 ? 'Needs Work' : 'On Track'}
                                        </div>
                                    </div>
                                    {/* Weakness bar */}
                                    <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${tw.avg_weakness >= 70 ? 'bg-gradient-to-r from-red-500 to-red-400' :
                                                tw.avg_weakness >= 40 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                                                    'bg-gradient-to-r from-green-500 to-green-400'
                                                }`}
                                            style={{ width: `${tw.avg_weakness}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            icon={<Brain className="w-14 h-14 text-purple-400/30" />}
                            title="No topic data yet"
                            subtitle="The Brain will map topic weaknesses as students practice"
                        />
                    )}
                </CollapsibleSection>

                {/* ─── Dual Grading: Performance vs Activity ─── */}
                <CollapsibleSection
                    title="Dual Scoring"
                    subtitle="Performance (hidden from students) vs Activity (visible)"
                    icon={<Shield className="w-5 h-5 text-indigo-400" />}
                    expanded={expandedSection === 'scores'}
                    onToggle={() => setExpandedSection(expandedSection === 'scores' ? null : 'scores')}
                >
                    {dualScores.length > 0 ? (
                        <>
                            {/* Legend */}
                            <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex gap-6 text-xs text-gray-400">
                                <span className="flex items-center gap-1.5">
                                    <Eye className="w-3.5 h-3.5 text-red-400" />
                                    Performance (teacher only — students CANNOT see this)
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Star className="w-3.5 h-3.5 text-green-400" />
                                    Activity (visible to students for motivation)
                                </span>
                            </div>

                            <div className="divide-y divide-white/5">
                                {dualScores.map(ds => (
                                    <div key={ds.student_id} className="p-4 hover:bg-white/5 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="font-medium text-white">{ds.student_name}</p>
                                            <div className="flex items-center gap-3">
                                                {ds.daily_streak > 0 && (
                                                    <span className="flex items-center gap-1 text-xs text-orange-400">
                                                        <Flame className="w-3.5 h-3.5" />
                                                        {ds.daily_streak}d streak
                                                    </span>
                                                )}
                                                {ds.badges_count > 0 && (
                                                    <span className="flex items-center gap-1 text-xs text-amber-400">
                                                        <Award className="w-3.5 h-3.5" />
                                                        {ds.badges_count}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* Performance Score (teacher-only) */}
                                            <div className="bg-red-500/10 rounded-lg p-2.5 flex items-center gap-2">
                                                <Eye className="w-4 h-4 text-red-400 shrink-0" />
                                                <div className="flex-1">
                                                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${ds.performance_score}%` }} />
                                                    </div>
                                                </div>
                                                <span className="text-sm font-bold text-red-400">{ds.performance_score}%</span>
                                            </div>
                                            {/* Activity Score (visible) */}
                                            <div className="bg-green-500/10 rounded-lg p-2.5 flex items-center gap-2">
                                                <Star className="w-4 h-4 text-green-400 shrink-0" />
                                                <div className="flex-1">
                                                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                        <div className="h-full bg-green-400 rounded-full" style={{ width: `${Math.min(ds.activity_score / 10, 100)}%` }} />
                                                    </div>
                                                </div>
                                                <span className="text-sm font-bold text-green-400">{ds.activity_score}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <EmptyState
                            icon={<Shield className="w-14 h-14 text-indigo-400/30" />}
                            title="No scores yet"
                            subtitle="Dual scores will populate as students complete assessments"
                        />
                    )}
                </CollapsibleSection>



            </main>
        </div>
    )
}

// ─── Sub-components ──────────────────────────────────────

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string; bg: string }) {
    return (
        <div className={`${bg} border border-white/10 rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-1">
                {icon}
                <span className="text-xs text-gray-400">{label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const config = {
        completed: { icon: CheckCircle, className: 'text-green-400' },
        in_progress: { icon: Activity, className: 'text-blue-400' },
        pending: { icon: Clock, className: 'text-gray-400' },
        missed: { icon: XCircle, className: 'text-red-400' },
    }
    const c = config[status as keyof typeof config] || config.pending
    return <c.icon className={`w-5 h-5 ${c.className}`} />
}

function CollapsibleSection({ title, subtitle, icon, expanded, onToggle, children }: {
    title: string; subtitle: string; icon: React.ReactNode; expanded: boolean; onToggle: () => void; children: React.ReactNode
}) {
    return (
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {icon}
                    <div className="text-left">
                        <p className="font-bold text-white">{title}</p>
                        <p className="text-xs text-gray-400">{subtitle}</p>
                    </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
            {expanded && children}
        </div>
    )
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
    return (
        <div className="p-12 text-center">
            <div className="mx-auto mb-3">{icon}</div>
            <p className="font-medium text-gray-300">{title}</p>
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>
    )
}

function QuickLink({ icon, label, sublabel, onClick }: {
    icon: React.ReactNode; label: string; sublabel: string; onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all text-center group"
        >
            <div className="mx-auto mb-2 group-hover:scale-110 transition-transform">{icon}</div>
            <p className="font-medium text-white text-sm">{label}</p>
            <p className="text-[10px] text-gray-400">{sublabel}</p>
        </button>
    )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Loader2, Flame, Star, Trophy, BookOpen,
    Clock, CalendarDays, MessageSquare, Award, CheckCircle,
    XCircle, AlertCircle, Timer, Phone, Calendar, Sparkles,
    Heart, Shield
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────

interface ChildDetail {
    student_id: string
    full_name: string
    class_name: string
    section_name: string
    roll_no?: string
}

interface WeekDay {
    date: string
    label: string
    shortLabel: string
    status: 'completed' | 'pending' | 'missed' | 'future'
}

interface TopicCovered {
    subject_name: string
    topic_name: string
}

interface Achievement {
    name: string
    description: string | null
    icon: string
    earned_at: string
}

interface ActivitySummary {
    streak: number
    total_points: number
    time_spent_week: number // minutes
    avg_time_per_day: number // minutes
    total_days_completed: number
}

// ── Component ────────────────────────────────────────────

export default function ParentChildDetailPage() {
    const router = useRouter()
    const params = useParams()
    const childId = params?.id as string

    const [loading, setLoading] = useState(true)
    const [child, setChild] = useState<ChildDetail | null>(null)
    const [weekDays, setWeekDays] = useState<WeekDay[]>([])
    const [topicsCovered, setTopicsCovered] = useState<TopicCovered[]>([])
    const [achievements, setAchievements] = useState<Achievement[]>([])
    const [summary, setSummary] = useState<ActivitySummary>({
        streak: 0, total_points: 0, time_spent_week: 0, avg_time_per_day: 0, total_days_completed: 0
    })
    const [showMessageModal, setShowMessageModal] = useState(false)
    const [messageText, setMessageText] = useState('')
    const [messageSent, setMessageSent] = useState(false)
    const [sending, setSending] = useState(false)

    useEffect(() => {
        if (childId) loadChildDetail()
    }, [childId])

    async function loadChildDetail() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return }

            const { data: parentUser } = await supabase
                .from('users')
                .select('user_id, role')
                .eq('email', session.user.email)
                .single()

            if (!parentUser || parentUser.role !== 'parent') {
                router.push('/dashboard')
                return
            }

            // Verify parent-child link exists
            const { data: link } = await supabase
                .from('parent_student_links')
                .select('link_id')
                .eq('parent_id', parentUser.user_id)
                .eq('student_id', childId)
                .single()

            // Allow if linked OR demo mode (no links exist)
            if (!link) {
                const { count } = await supabase
                    .from('parent_student_links')
                    .select('*', { count: 'exact', head: true })
                    .eq('parent_id', parentUser.user_id)

                if ((count || 0) > 0) {
                    router.push('/dashboard/parent')
                    return
                }
            }

            // Load child info
            const { data: student } = await supabase
                .from('users')
                .select('user_id, full_name, class_id, section_id')
                .eq('user_id', childId)
                .single()

            if (!student) { router.push('/dashboard/parent'); return }

            let className = '', sectionName = ''
            if (student.class_id) {
                const { data: cls } = await supabase.from('classes').select('name').eq('class_id', student.class_id).single()
                className = cls?.name || ''
            }
            if (student.section_id) {
                const { data: sec } = await supabase.from('sections').select('name').eq('section_id', student.section_id).single()
                sectionName = sec?.name || ''
            }

            setChild({
                student_id: student.user_id,
                full_name: student.full_name || 'Student',
                class_name: className,
                section_name: sectionName,
            })

            // Load all data in parallel
            await Promise.all([
                loadWeekActivity(childId),
                loadTopicsCovered(childId, student.class_id, student.section_id),
                loadAchievements(childId),
                loadActivitySummary(childId),
            ])
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    async function loadWeekActivity(studentId: string) {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const monday = new Date(today)
        monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7))

        const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        const days: WeekDay[] = []

        for (let i = 0; i < 7; i++) {
            const d = new Date(monday)
            d.setDate(monday.getDate() + i)
            const dateStr = d.toISOString().split('T')[0]
            const isFuture = d > today

            let status: 'completed' | 'pending' | 'missed' | 'future' = 'future'
            if (!isFuture) {
                const { data: phases } = await supabase
                    .from('assessment_phases')
                    .select('status')
                    .eq('student_id', studentId)
                    .eq('scheduled_date', dateStr)
                    .eq('phase_type', 'daily')

                if (phases && phases.length > 0) {
                    const p = phases[0]
                    if (p.status === 'completed') status = 'completed'
                    else if (p.status === 'missed') status = 'missed'
                    else if (dateStr === today.toISOString().split('T')[0]) status = 'pending'
                    else status = 'missed'
                } else {
                    if (dateStr === today.toISOString().split('T')[0]) status = 'pending'
                    else status = 'missed'
                }
            }

            days.push({
                date: dateStr,
                label: dayLabels[i],
                shortLabel: dayLabels[i].charAt(0),
                status,
            })
        }

        setWeekDays(days)
    }

    async function loadTopicsCovered(studentId: string, classId: string | null, sectionId: string | null) {
        if (!classId || !sectionId) return

        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
        const weekStartStr = weekStart.toISOString().split('T')[0]
        const today = new Date().toISOString().split('T')[0]

        const { data: schedules } = await supabase
            .from('daily_topic_schedule')
            .select(`
                topic:topic_id (topic_name),
                subject:subject_id (name)
            `)
            .eq('class_id', classId)
            .eq('section_id', sectionId)
            .gte('scheduled_date', weekStartStr)
            .lte('scheduled_date', today)

        if (schedules) {
            const topics = schedules.map((s: any) => ({
                subject_name: s.subject?.name || 'Subject',
                topic_name: s.topic?.topic_name || 'Topic',
            }))
            // Deduplicate
            const unique = topics.filter((t, i, arr) =>
                arr.findIndex(x => x.subject_name === t.subject_name && x.topic_name === t.topic_name) === i
            )
            setTopicsCovered(unique)
        }
    }

    async function loadAchievements(studentId: string) {
        const { data } = await supabase
            .from('student_achievements')
            .select(`
                earned_at,
                achievements (name, description, icon)
            `)
            .eq('student_id', studentId)
            .order('earned_at', { ascending: false })
            .limit(10)

        if (data) {
            setAchievements(data.map((a: any) => ({
                name: a.achievements?.name || 'Badge',
                description: a.achievements?.description || null,
                icon: a.achievements?.icon || '🏆',
                earned_at: a.earned_at,
            })))
        }
    }

    async function loadActivitySummary(studentId: string) {
        // Get scores
        const { data: scores } = await supabase
            .from('student_scores')
            .select('activity_score, daily_streak')
            .eq('student_id', studentId)
            .order('last_updated', { ascending: false })
            .limit(1)

        const score = scores?.[0]

        // Get this week's phases for time calculation
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
        const { data: weekPhases } = await supabase
            .from('assessment_phases')
            .select('time_taken_seconds, status')
            .eq('student_id', studentId)
            .eq('phase_type', 'daily')
            .gte('scheduled_date', weekStart.toISOString().split('T')[0])

        const completedPhases = weekPhases?.filter(p => p.status === 'completed') || []
        const totalSeconds = completedPhases.reduce((sum, p) => sum + (p.time_taken_seconds || 0), 0)
        const totalMinutes = Math.round(totalSeconds / 60)
        const avgMinutes = completedPhases.length > 0 ? Math.round(totalMinutes / completedPhases.length) : 0

        setSummary({
            streak: score?.daily_streak || 0,
            total_points: score?.activity_score || 0,
            time_spent_week: totalMinutes,
            avg_time_per_day: avgMinutes,
            total_days_completed: completedPhases.length,
        })
    }

    async function sendMessage() {
        if (!messageText.trim() || !child) return
        setSending(true)
        try {
            // Create notification for teacher (simplified)
            await fetch('/api/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: child.student_id, // Will route to class teacher
                    title: '📩 Parent Message',
                    message: messageText.trim(),
                    type: 'info',
                })
            })
            setMessageSent(true)
            setTimeout(() => {
                setShowMessageModal(false)
                setMessageSent(false)
                setMessageText('')
            }, 2000)
        } catch (err) {
            console.error('Error sending message:', err)
        } finally {
            setSending(false)
        }
    }

    function getStatusIcon(status: string) {
        switch (status) {
            case 'completed': return <CheckCircle className="w-5 h-5 text-emerald-400" />
            case 'pending': return <Clock className="w-5 h-5 text-amber-400" />
            case 'missed': return <XCircle className="w-5 h-5 text-red-400" />
            case 'future': return <div className="w-5 h-5 rounded-full border-2 border-white/20" />
            default: return <div className="w-5 h-5 rounded-full border-2 border-white/20" />
        }
    }

    function getStatusEmoji(status: string) {
        switch (status) {
            case 'completed': return '✅'
            case 'pending': return '⏳'
            case 'missed': return '❌'
            case 'future': return '⬜'
            default: return '⬜'
        }
    }

    function formatRelativeTime(dateStr: string): string {
        const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
        if (days === 0) return 'Today'
        if (days === 1) return 'Yesterday'
        if (days < 7) return `${days} days ago`
        return `${Math.floor(days / 7)} weeks ago`
    }

    // ── Loading ─────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-950 via-fuchsia-950 to-slate-950">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-fuchsia-400 animate-spin mx-auto" />
                    <p className="mt-4 text-purple-300/60">Loading child details...</p>
                </div>
            </div>
        )
    }

    if (!child) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-950 via-fuchsia-950 to-slate-950">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <p className="text-white text-lg mb-2">Child not found</p>
                    <button onClick={() => router.push('/dashboard/parent')} className="text-fuchsia-400 hover:text-fuchsia-300">
                        ← Back to Dashboard
                    </button>
                </div>
            </div>
        )
    }

    // ── Render ───────────────────────────────────

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-950 via-fuchsia-950 to-slate-950 pb-8">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-purple-950/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                    <button
                        onClick={() => router.push('/dashboard/parent')}
                        className="flex items-center gap-2 text-purple-300 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="text-sm">My Children</span>
                    </button>
                    <h1 className="text-lg font-bold text-white flex items-center gap-2">
                        <Heart className="w-5 h-5 text-fuchsia-400" />
                        Details
                    </h1>
                    <div className="w-20" />
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 space-y-5 mt-5">
                {/* Child Info Card */}
                <section className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-fuchsia-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-fuchsia-500/20">
                            {child.full_name.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{child.full_name}</h2>
                            <p className="text-purple-300/60">
                                {child.class_name}{child.section_name ? ` - ${child.section_name}` : ''}
                                {child.roll_no ? ` • Roll No: ${child.roll_no}` : ''}
                            </p>
                        </div>
                    </div>
                </section>

                {/* This Week's Activity Calendar */}
                <section className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-purple-300/70 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-cyan-400" />
                        This Week&apos;s Activity
                    </h3>

                    <div className="flex justify-between gap-2 mb-6">
                        {weekDays.map((day) => (
                            <div key={day.date} className="flex-1 text-center">
                                <p className="text-[10px] text-purple-300/50 mb-2">{day.label}</p>
                                <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center ${day.status === 'completed' ? 'bg-emerald-500/20 border border-emerald-500/30' :
                                        day.status === 'pending' ? 'bg-amber-500/20 border border-amber-500/30' :
                                            day.status === 'missed' ? 'bg-red-500/20 border border-red-500/30' :
                                                'bg-white/5 border border-white/10'
                                    }`}>
                                    <span className="text-lg">{getStatusEmoji(day.status)}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 rounded-xl p-3 flex items-center gap-3">
                            <Flame className="w-8 h-8 text-orange-400" />
                            <div>
                                <p className="text-xl font-bold text-white">{summary.streak} days</p>
                                <p className="text-[10px] text-purple-300/50">Current Streak</p>
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 flex items-center gap-3">
                            <Star className="w-8 h-8 text-yellow-400" />
                            <div>
                                <p className="text-xl font-bold text-white">
                                    {summary.total_points >= 1000
                                        ? `${(summary.total_points / 1000).toFixed(1)}k`
                                        : summary.total_points}
                                </p>
                                <p className="text-[10px] text-purple-300/50">Total Points</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Topics Covered This Week */}
                <section className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-purple-300/70 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-indigo-400" />
                        Learning This Week
                    </h3>

                    {topicsCovered.length > 0 ? (
                        <div className="space-y-2">
                            {topicsCovered.map((topic, i) => (
                                <div key={i} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                                    <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center shrink-0">
                                        <BookOpen className="w-4 h-4 text-indigo-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-white">{topic.topic_name}</p>
                                        <p className="text-[10px] text-purple-300/50">{topic.subject_name}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <BookOpen className="w-8 h-8 text-purple-500/30 mx-auto mb-2" />
                            <p className="text-sm text-purple-300/50">No topics scheduled this week yet</p>
                        </div>
                    )}
                </section>

                {/* Time Spent */}
                <section className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-purple-300/70 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Timer className="w-4 h-4 text-cyan-400" />
                        Time Spent
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-white">
                                {summary.time_spent_week >= 60
                                    ? `${Math.floor(summary.time_spent_week / 60)}h ${summary.time_spent_week % 60}m`
                                    : `${summary.time_spent_week}m`}
                            </p>
                            <p className="text-[10px] text-purple-300/50 mt-1">This Week</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-white">{summary.avg_time_per_day}m</p>
                            <p className="text-[10px] text-purple-300/50 mt-1">Avg per Day</p>
                        </div>
                    </div>
                </section>

                {/* Achievements */}
                <section className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-purple-300/70 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-yellow-400" />
                        Achievements ({achievements.length} earned)
                    </h3>

                    {achievements.length > 0 ? (
                        <div className="space-y-3">
                            {achievements.map((ach, i) => (
                                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-start gap-3 hover:bg-white/10 transition-colors">
                                    <div className="text-3xl">{ach.icon}</div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-white">{ach.name}</p>
                                        {ach.description && (
                                            <p className="text-xs text-purple-300/60 mt-0.5">{ach.description}</p>
                                        )}
                                        <p className="text-[10px] text-purple-300/40 mt-1">
                                            Earned: {formatRelativeTime(ach.earned_at)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <Award className="w-12 h-12 text-purple-500/30 mx-auto mb-2" />
                            <p className="text-sm text-purple-300/50">
                                Keep going! Badges will appear here as they&apos;re earned.
                            </p>
                        </div>
                    )}
                </section>

                {/* Contact Teacher */}
                <section className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-purple-300/70 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-fuchsia-400" />
                        Need to Discuss?
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                            onClick={() => setShowMessageModal(true)}
                            className="bg-fuchsia-500/20 border border-fuchsia-500/30 rounded-xl p-4 text-left hover:bg-fuchsia-500/30 transition-colors"
                        >
                            <MessageSquare className="w-6 h-6 text-fuchsia-400 mb-2" />
                            <p className="text-sm font-medium text-white">Message Class Teacher</p>
                            <p className="text-[10px] text-purple-300/50">Send a direct message</p>
                        </button>
                        <button
                            onClick={() => setShowMessageModal(true)}
                            className="bg-indigo-500/20 border border-indigo-500/30 rounded-xl p-4 text-left hover:bg-indigo-500/30 transition-colors"
                        >
                            <Calendar className="w-6 h-6 text-indigo-400 mb-2" />
                            <p className="text-sm font-medium text-white">Schedule Meeting</p>
                            <p className="text-[10px] text-purple-300/50">Request parent-teacher meeting</p>
                        </button>
                    </div>
                </section>

                {/* Privacy Note */}
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-start gap-3">
                    <Shield className="w-5 h-5 text-purple-300/40 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs text-purple-300/60 font-medium mb-1">Privacy Notice</p>
                        <p className="text-xs text-purple-300/40">
                            Detailed academic performance (scores, accuracy, rankings) is discussed in
                            parent-teacher meetings for privacy and context. This view shows engagement
                            and activity metrics only.
                        </p>
                    </div>
                </div>
            </main>

            {/* Message Modal */}
            {showMessageModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
                        {messageSent ? (
                            <div className="text-center py-8">
                                <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                                <p className="text-lg font-bold text-white">Message Sent!</p>
                                <p className="text-sm text-purple-300/60 mt-2">
                                    The teacher will respond soon.
                                </p>
                            </div>
                        ) : (
                            <>
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-fuchsia-400" />
                                    Message Teacher
                                </h3>
                                <p className="text-xs text-purple-300/60 mb-4">
                                    About: {child.full_name} ({child.class_name})
                                </p>
                                <textarea
                                    value={messageText}
                                    onChange={(e) => setMessageText(e.target.value)}
                                    placeholder="Type your message to the class teacher..."
                                    className="w-full bg-white/10 border border-white/10 rounded-xl p-3 text-white placeholder-purple-300/30 text-sm resize-none h-32 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                                />
                                <div className="flex gap-3 mt-4">
                                    <button
                                        onClick={() => setShowMessageModal(false)}
                                        className="flex-1 px-4 py-2.5 bg-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/20 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={sendMessage}
                                        disabled={!messageText.trim() || sending}
                                        className="flex-1 px-4 py-2.5 bg-fuchsia-500 text-white rounded-xl text-sm font-medium hover:bg-fuchsia-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {sending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <MessageSquare className="w-4 h-4" />
                                        )}
                                        Send
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

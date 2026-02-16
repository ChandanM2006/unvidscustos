'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    Bell, Loader2, Users, ChevronRight, Heart,
    Flame, Zap, Trophy, CheckCircle, Clock,
    MessageSquare, AlertCircle, Star, ArrowRight,
    CalendarDays, BookOpen, Award, Sparkles, LogOut
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────

interface ChildActivity {
    student_id: string
    full_name: string
    class_name: string
    section_name: string
    today_status: 'completed' | 'pending' | 'missed'
    today_completed: number
    today_total: number
    streak: number
    activity_points: number
    week_completion: { completed: number; total: number }
    recent_achievements: Achievement[]
    time_spent_today: number // minutes
}

interface Achievement {
    name: string
    icon: string
    earned_at: string
}

// ── Status helpers ──────────────────────────────────────

function getStatusDisplay(status: string) {
    switch (status) {
        case 'completed':
            return { icon: '✅', label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/30' }
        case 'pending':
            return { icon: '⏳', label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30' }
        case 'missed':
            return { icon: '❌', label: 'Missed', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' }
        default:
            return { icon: '⏳', label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30' }
    }
}

function formatRelativeTime(dateStr: string): string {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return `${Math.floor(days / 7)} weeks ago`
}

// ── Main Component ──────────────────────────────────────

export default function ParentDashboard() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [parent, setParent] = useState<any>(null)
    const [children, setChildren] = useState<ChildActivity[]>([])
    const [currentTime] = useState(new Date())
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadParentData()
    }, [])

    async function loadParentData() {
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

            if (!userData || userData.role !== 'parent') {
                router.push('/dashboard')
                return
            }

            setParent(userData)

            // Fetch children activity via API
            const res = await fetch(`/api/parent/children?parentId=${userData.user_id}`)
            if (res.ok) {
                const data = await res.json()
                setChildren(data.children || [])
            } else {
                // Fallback: load from direct DB query
                await loadChildrenDirect(userData)
            }
        } catch (err: any) {
            console.error('Error:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function loadChildrenDirect(userData: any) {
        try {
            const { data: links } = await supabase
                .from('parent_student_links')
                .select('student_id')
                .eq('parent_id', userData.user_id)

            let childIds: string[] = []
            if (links && links.length > 0) {
                childIds = links.map(l => l.student_id)
            } else {
                // Demo mode: show school's first 2 students
                const { data: students } = await supabase
                    .from('users')
                    .select('user_id')
                    .eq('school_id', userData.school_id)
                    .eq('role', 'student')
                    .limit(2)
                if (students) childIds = students.map(s => s.user_id)
            }

            if (childIds.length === 0) return

            const childPromises = childIds.map(async (cid) => {
                // Get student info
                const { data: student } = await supabase
                    .from('users')
                    .select('user_id, full_name, class_id, section_id')
                    .eq('user_id', cid)
                    .single()

                if (!student) return null

                let className = '', sectionName = ''
                if (student.class_id) {
                    const { data: cls } = await supabase
                        .from('classes')
                        .select('name')
                        .eq('class_id', student.class_id)
                        .single()
                    className = cls?.name || ''
                }
                if (student.section_id) {
                    const { data: sec } = await supabase
                        .from('sections')
                        .select('name')
                        .eq('section_id', student.section_id)
                        .single()
                    sectionName = sec?.name || ''
                }

                // Get student_scores for activity data
                const { data: scores } = await supabase
                    .from('student_scores')
                    .select('activity_score, daily_streak, weekly_completions')
                    .eq('student_id', cid)
                    .order('last_updated', { ascending: false })
                    .limit(1)

                const score = scores?.[0]

                // Get today's assessment status
                const today = new Date().toISOString().split('T')[0]
                const { data: todayPhases } = await supabase
                    .from('assessment_phases')
                    .select('status, total_questions, correct_answers')
                    .eq('student_id', cid)
                    .eq('scheduled_date', today)
                    .eq('phase_type', 'daily')

                let todayStatus: 'completed' | 'pending' | 'missed' = 'pending'
                let todayCompleted = 0
                let todayTotal = 10
                if (todayPhases && todayPhases.length > 0) {
                    const phase = todayPhases[0]
                    todayTotal = phase.total_questions || 10
                    if (phase.status === 'completed') {
                        todayStatus = 'completed'
                        todayCompleted = todayTotal
                    } else if (phase.status === 'missed') {
                        todayStatus = 'missed'
                    }
                }

                // Get this week's completed days
                const weekStart = new Date()
                weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
                const weekStartStr = weekStart.toISOString().split('T')[0]
                const { data: weekPhases } = await supabase
                    .from('assessment_phases')
                    .select('status')
                    .eq('student_id', cid)
                    .eq('phase_type', 'daily')
                    .gte('scheduled_date', weekStartStr)
                    .lte('scheduled_date', today)

                const weekCompleted = weekPhases?.filter(p => p.status === 'completed').length || 0
                const dayOfWeek = Math.min(new Date().getDay() || 7, 7)

                // Get recent achievements
                const { data: achData } = await supabase
                    .from('student_achievements')
                    .select(`
                        earned_at,
                        achievements (name, icon)
                    `)
                    .eq('student_id', cid)
                    .order('earned_at', { ascending: false })
                    .limit(3)

                const recentAchievements: Achievement[] = (achData || []).map((a: any) => ({
                    name: a.achievements?.name || 'Badge',
                    icon: a.achievements?.icon || '🏆',
                    earned_at: a.earned_at
                }))

                return {
                    student_id: cid,
                    full_name: student.full_name || 'Student',
                    class_name: className,
                    section_name: sectionName,
                    today_status: todayStatus,
                    today_completed: todayCompleted,
                    today_total: todayTotal,
                    streak: score?.daily_streak || 0,
                    activity_points: score?.activity_score || 0,
                    week_completion: { completed: weekCompleted, total: dayOfWeek },
                    recent_achievements: recentAchievements,
                    time_spent_today: 0,
                } as ChildActivity
            })

            const results = await Promise.all(childPromises)
            setChildren(results.filter(Boolean) as ChildActivity[])
        } catch (err) {
            console.error('Error loading children:', err)
        }
    }

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/login')
    }

    // ── Loading State ───────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-950 via-fuchsia-950 to-slate-950">
                <div className="text-center">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-full border-4 border-purple-500/30 border-t-fuchsia-400 animate-spin mx-auto" />
                        <Heart className="w-8 h-8 text-fuchsia-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="mt-6 text-purple-300 text-lg font-medium animate-pulse">
                        Loading your children&apos;s activity...
                    </p>
                </div>
            </div>
        )
    }

    // ── Main Render ─────────────────────────────────

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-950 via-fuchsia-950 to-slate-950 pb-8">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-purple-950/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-fuchsia-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-fuchsia-500/20">
                            {parent?.full_name?.charAt(0) || 'P'}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">
                                Welcome, {parent?.full_name?.split(' ')[0]} 👋
                            </h1>
                            <p className="text-sm text-purple-300/60">
                                {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => router.push('/dashboard/notifications')}
                            className="p-2.5 hover:bg-white/10 rounded-xl transition-colors relative"
                        >
                            <Bell className="w-5 h-5 text-purple-300" />
                        </button>
                        <button
                            onClick={handleLogout}
                            className="p-2.5 hover:bg-white/10 rounded-xl transition-colors"
                        >
                            <LogOut className="w-5 h-5 text-purple-300" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6 mt-6">
                {/* Section Title */}
                <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-fuchsia-400" />
                    <h2 className="text-lg font-bold text-white">My Children</h2>
                    <span className="text-xs text-purple-300/40 ml-auto">
                        {children.length} {children.length === 1 ? 'child' : 'children'} linked
                    </span>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-300 text-sm">
                        {error}
                    </div>
                )}

                {children.length > 0 ? (
                    <div className="space-y-5">
                        {children.map((child) => {
                            const status = getStatusDisplay(child.today_status)
                            const weekPct = child.week_completion.total > 0
                                ? Math.round((child.week_completion.completed / child.week_completion.total) * 100)
                                : 0
                            const isPerfectWeek = child.week_completion.completed === child.week_completion.total && child.week_completion.total >= 7

                            return (
                                <div
                                    key={child.student_id}
                                    className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden hover:border-fuchsia-500/30 transition-all duration-300 group"
                                >
                                    {/* Child Header */}
                                    <div className="p-5 pb-0">
                                        <div className="flex items-center gap-4 mb-5">
                                            <div className="w-14 h-14 bg-gradient-to-br from-fuchsia-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-fuchsia-500/20">
                                                {child.full_name.charAt(0)}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-lg font-bold text-white">{child.full_name}</h3>
                                                <p className="text-sm text-purple-300/60">
                                                    {child.class_name}{child.section_name ? ` - ${child.section_name}` : ''}
                                                </p>
                                            </div>
                                            <div className={`px-3 py-1.5 rounded-full border text-xs font-medium ${status.bg} ${status.color}`}>
                                                {status.icon} {status.label}
                                            </div>
                                        </div>

                                        {/* Today's Status */}
                                        <div className={`rounded-xl p-3 mb-4 border ${status.bg}`}>
                                            <div className="flex items-center justify-between">
                                                <span className={`text-sm font-medium ${status.color}`}>
                                                    Today: {child.today_status === 'completed'
                                                        ? `✅ Completed (${child.today_completed}/${child.today_total})`
                                                        : child.today_status === 'pending'
                                                            ? '⏳ Pending practice'
                                                            : '❌ Missed today'
                                                    }
                                                </span>
                                            </div>
                                        </div>

                                        {/* Quick Stats */}
                                        <div className="grid grid-cols-3 gap-3 mb-4">
                                            <div className="bg-white/5 rounded-xl p-3 text-center">
                                                <Flame className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                                                <p className="text-lg font-bold text-white">{child.streak}</p>
                                                <p className="text-[10px] text-purple-300/50">Day Streak</p>
                                            </div>
                                            <div className="bg-white/5 rounded-xl p-3 text-center">
                                                <Star className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                                                <p className="text-lg font-bold text-white">
                                                    {child.activity_points >= 1000
                                                        ? `${(child.activity_points / 1000).toFixed(1)}k`
                                                        : child.activity_points}
                                                </p>
                                                <p className="text-[10px] text-purple-300/50">Points</p>
                                            </div>
                                            <div className="bg-white/5 rounded-xl p-3 text-center">
                                                <CalendarDays className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
                                                <p className="text-lg font-bold text-white">
                                                    {child.week_completion.completed}/{child.week_completion.total}
                                                </p>
                                                <p className="text-[10px] text-purple-300/50">This Week</p>
                                            </div>
                                        </div>

                                        {/* Week Progress Bar */}
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-xs text-purple-300/60">Weekly Progress</span>
                                                <span className="text-xs font-bold text-white">{weekPct}%</span>
                                            </div>
                                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${isPerfectWeek
                                                            ? 'bg-gradient-to-r from-yellow-400 to-amber-400'
                                                            : weekPct >= 70
                                                                ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                                                                : 'bg-gradient-to-r from-fuchsia-500 to-purple-500'
                                                        }`}
                                                    style={{ width: `${weekPct}%` }}
                                                />
                                            </div>
                                            {isPerfectWeek && (
                                                <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                                                    <Sparkles className="w-3 h-3" /> Perfect Week! ✨
                                                </p>
                                            )}
                                        </div>

                                        {/* Recent Achievements */}
                                        {child.recent_achievements.length > 0 && (
                                            <div className="mb-4">
                                                <p className="text-xs text-purple-300/60 mb-2 flex items-center gap-1">
                                                    <Trophy className="w-3 h-3 text-yellow-400" />
                                                    Recent Achievements
                                                </p>
                                                <div className="flex gap-2 flex-wrap">
                                                    {child.recent_achievements.map((ach, i) => (
                                                        <div
                                                            key={i}
                                                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-1.5"
                                                        >
                                                            <span className="text-sm">{ach.icon}</span>
                                                            <span className="text-xs text-white font-medium">{ach.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex border-t border-white/5">
                                        <button
                                            onClick={() => router.push(`/dashboard/parent/children/${child.student_id}`)}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium text-purple-300 hover:bg-white/5 hover:text-white transition-colors"
                                        >
                                            <BookOpen className="w-4 h-4" />
                                            View Details
                                        </button>
                                        <div className="w-px bg-white/5" />
                                        <button
                                            onClick={() => router.push(`/dashboard/parent/messages?childId=${child.student_id}`)}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium text-fuchsia-300 hover:bg-white/5 hover:text-white transition-colors"
                                        >
                                            <MessageSquare className="w-4 h-4" />
                                            Message Teacher
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
                        <AlertCircle className="w-16 h-16 text-purple-500/30 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">No Children Linked</h3>
                        <p className="text-purple-300/60 mb-4 max-w-sm mx-auto">
                            Your account hasn&apos;t been linked to any students yet.
                            Please contact the school administration to link your children.
                        </p>
                        <div className="bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-xl p-4 max-w-sm mx-auto">
                            <p className="text-xs text-fuchsia-300/80">
                                💡 Ask your school admin to go to <strong>Admin Panel → Manage Parents</strong> and link your account to your child&apos;s student profile.
                            </p>
                        </div>
                    </div>
                )}

                {/* Privacy Notice */}
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
                    <p className="text-xs text-purple-300/40">
                        🔒 For your child&apos;s well-being, detailed academic performance is shared during
                        parent-teacher meetings. This dashboard shows <strong className="text-purple-300/60">activity and engagement metrics only</strong>.
                    </p>
                </div>

                {/* Contact School */}
                <div className="bg-gradient-to-r from-fuchsia-600/30 to-purple-600/30 border border-fuchsia-500/20 rounded-2xl p-6">
                    <h3 className="font-bold text-lg text-white mb-2">
                        Need to discuss your child&apos;s progress?
                    </h3>
                    <p className="text-purple-200/60 text-sm mb-4">
                        Schedule a parent-teacher meeting or send a direct message to the class teacher.
                    </p>
                    <button
                        onClick={() => router.push('/dashboard/parent/messages')}
                        className="px-6 py-2.5 bg-fuchsia-500 hover:bg-fuchsia-400 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                    >
                        <MessageSquare className="w-4 h-4" />
                        Contact School
                    </button>
                </div>
            </main>
        </div>
    )
}

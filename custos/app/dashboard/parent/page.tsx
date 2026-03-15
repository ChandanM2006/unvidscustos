'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    Bell, Loader2, Users, Heart,
    Flame, Star, Trophy, CheckCircle,
    MessageSquare, AlertCircle, BookOpen, LogOut,
    CalendarDays
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────

interface ChildActivity {
    student_id: string
    full_name: string
    class_id: string | null
    class_name: string
    section_name: string
    today_status: 'completed' | 'pending' | 'missed'
    today_completed: number
    today_total: number
    streak: number
    activity_points: number
    week_completion: { completed: number; total: number }
    recent_achievements: Achievement[]
    time_spent_today: number
}

interface Achievement {
    name: string
    icon: string
    earned_at: string
}

export default function ParentDashboard() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [parent, setParent] = useState<any>(null)
    const [children, setChildren] = useState<ChildActivity[]>([])
    const [classTeacherId, setClassTeacherId] = useState<string | null>(null)
    const [classTeacherName, setClassTeacherName] = useState<string>('')
    const [currentTime] = useState(new Date())
    const [error, setError] = useState<string | null>(null)

    useEffect(() => { loadParentData() }, [])

    async function loadParentData() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return }

            const { data: userData } = await supabase
                .from('users').select('*').eq('email', session.user.email).single()

            if (!userData || userData.role !== 'parent') {
                router.replace('/dashboard/redirect'); return
            }

            setParent(userData)

            const res = await fetch(`/api/parent/children?parentId=${userData.user_id}`)
            if (res.ok) {
                const data = await res.json()
                const loadedChildren = data.children || []
                setChildren(loadedChildren)
                if (loadedChildren.length > 0 && loadedChildren[0].class_teacher_id) {
                    setClassTeacherId(loadedChildren[0].class_teacher_id)
                    setClassTeacherName(loadedChildren[0].class_teacher_name || '')
                }
            } else {
                await loadChildrenDirect(userData)
            }
        } catch (err: any) {
            console.error('Error:', err); setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function loadChildrenDirect(userData: any) {
        try {
            const { data: links } = await supabase
                .from('parent_student_links').select('student_id').eq('parent_id', userData.user_id)
            const childIds = (links || []).map((l: any) => l.student_id)
            if (childIds.length === 0) return

            const results = await Promise.all(childIds.map(async (cid: string) => {
                const { data: student } = await supabase
                    .from('users').select('user_id, full_name, class_id, section_id').eq('user_id', cid).single()
                if (!student) return null

                let className = '', sectionName = ''
                if (student.class_id) {
                    const { data: cls } = await supabase.from('classes').select('name').eq('class_id', student.class_id).single()
                    className = cls?.name || ''
                }
                if (student.section_id) {
                    const { data: sec } = await supabase.from('sections').select('name').eq('section_id', student.section_id).single()
                    sectionName = sec?.name || ''
                }

                const { data: scores } = await supabase.from('student_scores')
                    .select('activity_score, daily_streak').eq('student_id', cid)
                    .order('last_updated', { ascending: false }).limit(1)
                const score = scores?.[0]

                const today = new Date().toISOString().split('T')[0]
                const { data: todayPhases } = await supabase.from('assessment_phases')
                    .select('status, total_questions').eq('student_id', cid)
                    .eq('scheduled_date', today).eq('phase_type', 'daily')

                let todayStatus: 'completed' | 'pending' | 'missed' = 'pending'
                let todayCompleted = 0, todayTotal = 10
                if (todayPhases?.length) {
                    const p = todayPhases[0]
                    todayTotal = p.total_questions || 10
                    if (p.status === 'completed') { todayStatus = 'completed'; todayCompleted = todayTotal }
                    else if (p.status === 'missed') todayStatus = 'missed'
                }

                const weekStart = new Date()
                weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
                const { data: weekPhases } = await supabase.from('assessment_phases')
                    .select('status').eq('student_id', cid).eq('phase_type', 'daily')
                    .gte('scheduled_date', weekStart.toISOString().split('T')[0]).lte('scheduled_date', today)
                const weekCompleted = weekPhases?.filter((p: any) => p.status === 'completed').length || 0

                const { data: achData } = await supabase.from('student_achievements')
                    .select('earned_at, achievements (name, icon)').eq('student_id', cid)
                    .order('earned_at', { ascending: false }).limit(3)

                return {
                    student_id: cid, full_name: student.full_name || 'Student',
                    class_name: className, section_name: sectionName,
                    today_status: todayStatus, today_completed: todayCompleted, today_total: todayTotal,
                    streak: score?.daily_streak || 0, activity_points: score?.activity_score || 0,
                    week_completion: { completed: weekCompleted, total: Math.min(new Date().getDay() || 7, 7) },
                    recent_achievements: (achData || []).map((a: any) => ({
                        name: a.achievements?.name || 'Badge',
                        icon: a.achievements?.icon || '🏆',
                        earned_at: a.earned_at,
                    })),
                    time_spent_today: 0,
                } as ChildActivity
            }))
            setChildren(results.filter(Boolean) as ChildActivity[])
        } catch (err) { console.error(err) }
    }

    if (loading) {
        return (
            <div className="min-h-full flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-purple-500/30 border-t-fuchsia-400 animate-spin mx-auto" />
                        <Heart className="w-6 h-6 text-fuchsia-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="mt-4 text-purple-300 text-sm font-medium animate-pulse">Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 space-y-6 text-white">

            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        Welcome, {parent?.full_name?.split(' ')[0]} 👋
                    </h1>
                    <p className="text-sm text-purple-300/50 mt-0.5">
                        {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <button
                    onClick={() => router.push('/dashboard/notifications')}
                    className="p-2.5 hover:bg-white/10 rounded-xl transition-colors"
                >
                    <Bell className="w-5 h-5 text-purple-300" />
                </button>
            </div>

            {/* Section Title */}
            <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-fuchsia-400" />
                <h2 className="text-lg font-bold text-white">My Children</h2>
                <span className="text-xs text-purple-300/40 ml-auto">
                    {children.length} {children.length === 1 ? 'child' : 'children'} linked
                </span>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-300 text-sm">{error}</div>
            )}

            {/* Children Cards */}
            {children.length > 0 ? (
                <div className="space-y-5">
                    {children.map((child) => (
                        <div
                            key={child.student_id}
                            className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden hover:border-fuchsia-500/30 transition-all duration-300"
                        >
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
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    <div className="bg-white/5 rounded-xl p-3 text-center">
                                        <Flame className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                                        <p className="text-lg font-bold text-white">{child.streak}</p>
                                        <p className="text-[10px] text-purple-300/50">Day Streak</p>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-3 text-center">
                                        <Star className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                                        <p className="text-lg font-bold text-white">
                                            {child.activity_points >= 1000 ? `${(child.activity_points / 1000).toFixed(1)}k` : child.activity_points}
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

                                {/* Achievements */}
                                {child.recent_achievements.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-xs text-purple-300/60 mb-2 flex items-center gap-1">
                                            <Trophy className="w-3 h-3 text-yellow-400" /> Recent Achievements
                                        </p>
                                        <div className="flex gap-2 flex-wrap">
                                            {child.recent_achievements.map((ach, i) => (
                                                <div key={i} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                                                    <span className="text-sm">{ach.icon}</span>
                                                    <span className="text-xs text-white font-medium">{ach.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex border-t border-white/5">
                                <button
                                    onClick={() => router.push(`/dashboard/parent/children/${child.student_id}`)}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium text-purple-300 hover:bg-white/5 hover:text-white transition-colors"
                                >
                                    <BookOpen className="w-4 h-4" />
                                    View Details
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
                    <AlertCircle className="w-16 h-16 text-purple-500/30 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">No Children Linked</h3>
                    <p className="text-purple-300/60 mb-4 max-w-sm mx-auto">
                        Your account hasn&apos;t been linked to any students yet. Contact school administration.
                    </p>
                    <div className="bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-xl p-4 max-w-sm mx-auto">
                        <p className="text-xs text-fuchsia-300/80">
                            💡 Ask your school admin to go to <strong>Admin Panel → Manage Parents</strong> and link your account.
                        </p>
                    </div>
                </div>
            )}

            {/* Privacy Notice */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
                <p className="text-xs text-purple-300/40">
                    🔒 For your child&apos;s well-being, detailed academic performance is shared during parent-teacher meetings.
                    This dashboard shows <strong className="text-purple-300/60">activity and engagement metrics only</strong>.
                </p>
            </div>

            {/* Contact School */}
            <div className="bg-gradient-to-r from-fuchsia-600/30 to-purple-600/30 border border-fuchsia-500/20 rounded-2xl p-6">
                <h3 className="font-bold text-lg text-white mb-1">Need to discuss your child&apos;s progress?</h3>
                <p className="text-purple-200/60 text-sm mb-5">
                    {classTeacherName
                        ? `Reach your child's class teacher ${classTeacherName} or any subject teacher.`
                        : "Send a message to any of your child's teachers."}
                </p>
                <div className="flex flex-wrap gap-3">
                    {classTeacherId && (
                        <button
                            onClick={() => router.push(`/dashboard/parent/messages?teacherId=${classTeacherId}`)}
                            className="px-5 py-2.5 bg-fuchsia-500 hover:bg-fuchsia-400 text-white rounded-xl font-medium transition-colors flex items-center gap-2 text-sm"
                        >
                            <MessageSquare className="w-4 h-4" />
                            Message Class Teacher
                        </button>
                    )}
                    <button
                        onClick={() => router.push('/dashboard/parent/messages')}
                        className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl font-medium transition-colors flex items-center gap-2 text-sm"
                    >
                        <MessageSquare className="w-4 h-4" />
                        Message Subject Teacher
                    </button>
                </div>
            </div>

        </div>
    )
}

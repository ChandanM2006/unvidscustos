'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Loader2, AlertCircle, Timer, Heart, Shield, ListTodo
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────

interface ChildDetail {
    student_id: string
    full_name: string
    class_name: string
    section_name: string
    roll_no?: string
}

interface ActivitySummary {
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
    const [dailyWork, setDailyWork] = useState({ completed: 0, pending: 0, missed: 0 })
    const [summary, setSummary] = useState<ActivitySummary>({
        time_spent_week: 0, avg_time_per_day: 0, total_days_completed: 0
    })


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
                router.replace('/dashboard/redirect')
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
                loadDailyWorkCounts(childId),
                loadActivitySummary(childId),
            ])
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    async function loadDailyWorkCounts(studentId: string) {
        const today = new Date().toISOString().split('T')[0]
        const { data: phases } = await supabase
            .from('assessment_phases')
            .select('status')
            .eq('student_id', studentId)
            .eq('scheduled_date', today)
            .eq('phase_type', 'daily')

        let completed = 0, pending = 0, missed = 0
        if (phases) {
            phases.forEach((p: any) => {
                if (p.status === 'completed') completed++
                else if (p.status === 'missed') missed++
                else pending++
            })
        }
        setDailyWork({ completed, pending, missed })
    }

    async function loadActivitySummary(studentId: string) {
        // Get this week's phases for time calculation
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
        const { data: weekPhases } = await supabase
            .from('assessment_phases')
            .select('time_taken_seconds, status')
            .eq('student_id', studentId)
            .eq('phase_type', 'daily')
            .gte('scheduled_date', weekStart.toISOString().split('T')[0])

        const completedPhases = weekPhases?.filter((p: any) => p.status === 'completed') || []
        const totalSeconds = completedPhases.reduce((sum: number, p: any) => sum + (p.time_taken_seconds || 0), 0)
        const totalMinutes = Math.round(totalSeconds / 60)
        const avgMinutes = completedPhases.length > 0 ? Math.round(totalMinutes / completedPhases.length) : 0

        setSummary({
            time_spent_week: totalMinutes,
            avg_time_per_day: avgMinutes,
            total_days_completed: completedPhases.length,
        })
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

                {/* Today's Daily Work */}
                <section className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-purple-300/70 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <ListTodo className="w-4 h-4 text-cyan-400" />
                        Today&apos;s Daily Work
                    </h3>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/5 rounded-xl p-4 text-center border border-emerald-500/20">
                            <p className="text-3xl font-bold text-emerald-400">{dailyWork.completed}</p>
                            <p className="text-[10px] text-purple-300/50 mt-1 uppercase font-medium">Completed</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 text-center border border-amber-500/20">
                            <p className="text-3xl font-bold text-amber-400">{dailyWork.pending}</p>
                            <p className="text-[10px] text-purple-300/50 mt-1 uppercase font-medium">Pending</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 text-center border border-rose-500/20">
                            <p className="text-3xl font-bold text-rose-400">{dailyWork.missed}</p>
                            <p className="text-[10px] text-purple-300/50 mt-1 uppercase font-medium">Missed</p>
                        </div>
                    </div>
                </section>

                {/* Weekly Time Spent */}
                <section className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-purple-300/70 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Timer className="w-4 h-4 text-cyan-400" />
                        Weekly Activity
                    </h3>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/5 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-white">
                                {summary.time_spent_week >= 60
                                    ? `${Math.floor(summary.time_spent_week / 60)}h ${summary.time_spent_week % 60}m`
                                    : `${summary.time_spent_week}m`}
                            </p>
                            <p className="text-[10px] text-purple-300/50 mt-1">Time This Week</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-white">{summary.avg_time_per_day}m</p>
                            <p className="text-[10px] text-purple-300/50 mt-1">Avg per Day</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-white">{summary.total_days_completed}</p>
                            <p className="text-[10px] text-purple-300/50 mt-1">Days Completed</p>
                        </div>
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

        </div>
    )
}

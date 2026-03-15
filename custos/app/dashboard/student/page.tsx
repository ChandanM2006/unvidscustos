'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { NotificationBell } from '@/components/NotificationBell'
import {
    BookOpen, Clock, Calendar, Brain, CheckCircle,
    ChevronDown, ChevronUp, Loader2, GraduationCap, BarChart3,
    Sparkles, MessageCircle, ClipboardList, PenLine, Flame, Zap, Trophy
} from 'lucide-react'

interface TodayClass {
    subject_name: string
    teacher_name: string
    start_time: string
    end_time: string
    is_current: boolean
    is_substitute?: boolean
}

export default function StudentDashboard() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [student, setStudent] = useState<any>(null)
    const [todayClasses, setTodayClasses] = useState<TodayClass[]>([])
    const [currentTime, setCurrentTime] = useState(new Date())
    const [attendancePercent, setAttendancePercent] = useState(0)
    const [className, setClassName] = useState('')
    const [brainData, setBrainData] = useState<any>(null)
    const [dailyWorks, setDailyWorks] = useState<any[]>([])
    const [expandedWorkId, setExpandedWorkId] = useState<string | null>(null)

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => { loadStudentData() }, [])

    async function loadStudentData() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return }

            const { data: basicUser } = await supabase
                .from('users')
                .select('user_id, role, full_name, email, school_id, class_id, section_id')
                .eq('email', session.user.email)
                .single()

            if (!basicUser) { await supabase.auth.signOut(); router.push('/login'); return }

            if (basicUser.role !== 'student') {
                const roleMap: Record<string, string> = {
                    super_admin: '/dashboard', sub_admin: '/dashboard',
                    teacher: '/dashboard/teacher', parent: '/dashboard/parent',
                }
                router.replace(roleMap[basicUser.role] || '/dashboard')
                return
            }

            let userData: any = { ...basicUser, classes: null, sections: null }
            if (basicUser.class_id) {
                const { data: c } = await supabase.from('classes').select('name').eq('class_id', basicUser.class_id).single()
                if (c) userData.classes = c
            }
            if (basicUser.section_id) {
                const { data: s } = await supabase.from('sections').select('name').eq('section_id', basicUser.section_id).single()
                if (s) userData.sections = s
            }

            setStudent(userData)
            setClassName(`${userData.classes?.name || ''} ${userData.sections?.name || ''}`.trim())

            // Timetable
            if (userData.class_id && userData.section_id) {
                const today = new Date().getDay()
                const { data: entries } = await supabase
                    .from('timetable_entries')
                    .select('*, users:teacher_id (full_name), timetable_slots (start_time, end_time)')
                    .eq('class_id', userData.class_id)
                    .eq('section_id', userData.section_id)
                    .eq('day_of_week', today)

                if (entries && entries.length > 0) {
                    const subjectIds = [...new Set(entries.map((e: any) => e.subject_id).filter(Boolean))]
                    const subjectMap: Record<string, string> = {}
                    if (subjectIds.length > 0) {
                        const { data: subs } = await supabase.from('subjects').select('subject_id, name').in('subject_id', subjectIds)
                        subs?.forEach((s: any) => { subjectMap[s.subject_id] = s.name })
                    }

                    const substituteIds = new Set<string>()
                    entries.forEach((e: any) => {
                        if (e.notes) {
                            try {
                                const n = JSON.parse(e.notes)
                                if (n.type === 'substitution' && n.substitute_teacher_id) {
                                    e.substitute_teacher_id = n.substitute_teacher_id
                                    substituteIds.add(n.substitute_teacher_id)
                                }
                            } catch {}
                        }
                    })

                    const substituteNames: Record<string, string> = {}
                    if (substituteIds.size > 0) {
                        const { data: subTeachers } = await supabase.from('users').select('user_id, full_name').in('user_id', Array.from(substituteIds))
                        subTeachers?.forEach((t: any) => { substituteNames[t.user_id] = t.full_name })
                    }

                    const formatted = entries.map((e: any) => {
                        const isSub = !!e.substitute_teacher_id
                        return {
                            subject_name: subjectMap[e.subject_id] || 'Unknown',
                            teacher_name: isSub ? (substituteNames[e.substitute_teacher_id] || 'Substitute') : (e.users?.full_name || 'TBA'),
                            start_time: e.timetable_slots?.start_time || '',
                            end_time: e.timetable_slots?.end_time || '',
                            is_current: false,
                            is_substitute: isSub,
                        }
                    })
                    formatted.sort((a: TodayClass, b: TodayClass) => a.start_time.localeCompare(b.start_time))
                    setTodayClasses(formatted)
                }
            }

            // Attendance
            const { data: attData } = await supabase
                .from('attendance_summary').select('percentage').eq('student_id', basicUser.user_id)
                .order('year', { ascending: false }).order('month', { ascending: false }).limit(1).single()
            if (attData) {
                setAttendancePercent(Math.round(attData.percentage))
            } else {
                const { data: recs } = await supabase.from('attendance_records').select('status').eq('student_id', basicUser.user_id)
                if (recs?.length) {
                    const present = recs.filter((r: any) => ['present', 'late'].includes(r.status)).length
                    setAttendancePercent(Math.round((present / recs.length) * 100))
                }
            }

            // Brain activity
            try {
                const res = await fetch(`/api/brain/activity?studentId=${basicUser.user_id}`)
                if (res.ok) setBrainData(await res.json())
            } catch {}

            // Daily work
            try {
                const todayStr = new Date().toISOString().split('T')[0]
                const dwRes = await fetch(`/api/brain/work/daily?class_id=${basicUser.class_id}&date=${todayStr}`)
                if (dwRes.ok) {
                    const dwData = await dwRes.json()
                    const published = (dwData.works || []).filter((w: any) => ['published', 'completed'].includes(w.status))
                    const subjectIds = [...new Set(published.map((w: any) => w.subject_id).filter(Boolean))]
                    const teacherIds = [...new Set(published.map((w: any) => w.created_by).filter(Boolean))]
                    const topicIds = [...new Set(published.map((w: any) => w.topic_id).filter(Boolean))]
                    const [subs, teachers, topics] = await Promise.all([
                        subjectIds.length ? supabase.from('subjects').select('subject_id, name').in('subject_id', subjectIds) : Promise.resolve({ data: [] }),
                        teacherIds.length ? supabase.from('users').select('user_id, full_name').in('user_id', teacherIds) : Promise.resolve({ data: [] }),
                        topicIds.length ? supabase.from('lesson_topics').select('topic_id, topic_title').in('topic_id', topicIds) : Promise.resolve({ data: [] }),
                    ])
                    const subjectMap: Record<string, string> = {}
                    const teacherMap: Record<string, string> = {}
                    const topicMap: Record<string, string> = {}
                    subs.data?.forEach((s: any) => { subjectMap[s.subject_id] = s.name })
                    teachers.data?.forEach((t: any) => { teacherMap[t.user_id] = t.full_name })
                    topics.data?.forEach((t: any) => { topicMap[t.topic_id] = t.topic_title })
                    setDailyWorks(published.map((w: any) => ({
                        ...w,
                        subject_name: subjectMap[w.subject_id] || 'Unknown Subject',
                        teacher_name: teacherMap[w.created_by] || 'Teacher',
                        topic_titles: w.topic_id ? [topicMap[w.topic_id] || 'Topic'] :
                            (w.mcq_questions || []).map((q: any) => q.topic_title).filter(Boolean).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i),
                    })))
                }
            } catch {}

        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    function formatTime(time: string) {
        if (!time) return ''
        const [h, m] = time.split(':')
        const hour = parseInt(h) % 12 || 12
        const ampm = parseInt(h) >= 12 ? 'PM' : 'AM'
        return `${hour}:${m} ${ampm}`
    }

    if (loading) {
        return (
            <div className="min-h-full flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-teal-500/30 border-t-emerald-400 animate-spin mx-auto" />
                        <GraduationCap className="w-6 h-6 text-teal-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="mt-4 text-teal-300 text-sm font-medium animate-pulse">Loading your dashboard...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 space-y-6 text-white">

            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-teal-400 to-emerald-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-teal-500/30">
                        {student?.full_name?.charAt(0) || 'S'}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            Hi, {student?.full_name?.split(' ')[0]}! 👋
                        </h1>
                        <p className="text-sm text-teal-300/60">
                            {className} • {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {student && <NotificationBell userId={student.user_id} />}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl p-4 text-center">
                    <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center mb-2 mx-auto shadow-md shadow-teal-500/20">
                        <GraduationCap className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-white">{todayClasses.length}</p>
                    <p className="text-[11px] text-teal-300/50 mt-0.5 font-medium">Classes Today</p>
                </div>
                <div className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl p-4 text-center">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mb-2 mx-auto shadow-md shadow-green-500/20">
                        <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-white">{attendancePercent}%</p>
                    <p className="text-[11px] text-teal-300/50 mt-0.5 font-medium">Attendance</p>
                </div>
                <div className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl p-4 text-center">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center mb-2 mx-auto shadow-md shadow-orange-500/20">
                        <Flame className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-white">{brainData?.dailyStreak || 0}</p>
                    <p className="text-[11px] text-teal-300/50 mt-0.5 font-medium">Day Streak</p>
                </div>
                <div className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl p-4 text-center">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center mb-2 mx-auto shadow-md shadow-amber-500/20">
                        <Zap className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-white">{brainData?.activityScore || 0}</p>
                    <p className="text-[11px] text-teal-300/50 mt-0.5 font-medium">Points</p>
                </div>
            </div>

            {/* This Week Activity */}
            {brainData?.recentHistory && brainData.recentHistory.length > 0 && (
                <div className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-teal-300/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-teal-400" /> This Week
                    </h3>
                    <div className="flex items-center gap-2">
                        {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                            const d = new Date()
                            d.setDate(d.getDate() - (6 - dayOffset))
                            const dateStr = d.toISOString().split('T')[0]
                            const phase = brainData.recentHistory.find(
                                (p: any) => p.scheduled_date === dateStr && p.phase_type === 'daily'
                            )
                            const dayLabel = d.toLocaleDateString('en-US', { weekday: 'narrow' })
                            const isToday = dateStr === new Date().toISOString().split('T')[0]
                            return (
                                <div key={dayOffset} className="flex-1 text-center">
                                    <div className={`w-9 h-9 mx-auto rounded-xl flex items-center justify-center text-xs font-bold transition-all
                                        ${phase?.status === 'completed'
                                            ? phase.score_percentage >= 80
                                                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                                                : phase.score_percentage >= 50
                                                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                                                    : 'bg-red-500 text-white shadow-md shadow-red-500/30'
                                            : isToday
                                                ? 'bg-teal-500/20 text-teal-300 border-2 border-teal-400/50'
                                                : 'bg-white/5 text-white/30'
                                        }`}>
                                        {phase?.status === 'completed'
                                            ? phase.score_percentage >= 80 ? '✓' : Math.round(phase.score_percentage / 10)
                                            : dayLabel}
                                    </div>
                                    <p className="text-[10px] text-white/30 mt-1">{dayLabel}</p>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Today's Classes */}
            <div className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2 bg-gradient-to-r from-teal-500/20 to-emerald-500/20">
                    <Calendar className="w-5 h-5 text-teal-400" />
                    <h2 className="text-base font-bold text-white">Today&apos;s Classes</h2>
                    <span className="ml-auto text-xs text-teal-300/50">{todayClasses.length} periods</span>
                </div>
                <div className="divide-y divide-white/[0.05]">
                    {todayClasses.length > 0 ? todayClasses.map((cls, idx) => (
                        <div key={idx} className="px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.03] transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-gradient-to-br from-teal-500/20 to-emerald-500/20 border border-teal-500/20 rounded-xl flex items-center justify-center">
                                    <Clock className="w-4 h-4 text-teal-400" />
                                </div>
                                <div>
                                    <p className="font-semibold text-white text-sm">
                                        {cls.is_substitute && (
                                            <span className="text-[9px] uppercase font-bold text-emerald-900 bg-emerald-300 px-1.5 py-0.5 rounded mr-2 align-middle">SUB</span>
                                        )}
                                        {cls.subject_name}
                                    </p>
                                    <p className="text-xs text-teal-300/50">{cls.teacher_name}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-semibold text-teal-400">{formatTime(cls.start_time)}</p>
                                <p className="text-xs text-white/30">{formatTime(cls.end_time)}</p>
                            </div>
                        </div>
                    )) : (
                        <div className="px-5 py-10 text-center">
                            <Calendar className="w-10 h-10 text-teal-400/20 mx-auto mb-2" />
                            <p className="text-white/30 text-sm">No classes scheduled today</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Today's Daily Work */}
            <div className="space-y-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-amber-400" />
                    Today&apos;s Daily Work
                </h3>
                {dailyWorks.map((work: any) => {
                    const isExpanded = expandedWorkId === work.work_id
                    const topicList = work.topic_titles?.length > 0 ? work.topic_titles : ['General']
                    const hasMCQs = (work.mcq_count || 0) > 0
                    const hasHomework = (work.homework_count || 0) > 0
                    return (
                        <div key={work.work_id} className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                            <button
                                onClick={() => setExpandedWorkId(isExpanded ? null : work.work_id)}
                                className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.03] transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/20">
                                        <BookOpen className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-white truncate">{work.subject_name}</p>
                                        <p className="text-xs text-teal-300/50 truncate">
                                            {work.teacher_name} • {new Date(work.work_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                    <div className="flex gap-1">
                                        {hasMCQs && <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-bold rounded-full border border-blue-500/20">MCQ</span>}
                                        {hasHomework && <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-bold rounded-full border border-purple-500/20">HW</span>}
                                    </div>
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                                </div>
                            </button>
                            {isExpanded && (
                                <div className="border-t border-white/[0.07] p-4 space-y-3">
                                    <div>
                                        <p className="text-xs font-semibold text-teal-300/50 uppercase tracking-wider mb-2">Topics</p>
                                        <div className="flex flex-wrap gap-2">
                                            {topicList.map((t: string, i: number) => (
                                                <span key={i} className="px-3 py-1 bg-white/5 border border-white/10 text-white/70 text-xs rounded-full">{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        {hasMCQs && (
                                            <button
                                                onClick={() => router.push(`/dashboard/student/work/daily?work_id=${work.work_id}`)}
                                                className="flex-1 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-blue-500/20 transition-all"
                                            >
                                                <Brain className="w-4 h-4" /> Attend MCQs ({work.mcq_count})
                                            </button>
                                        )}
                                        {hasHomework && (
                                            <button
                                                onClick={() => router.push(`/dashboard/student/work/daily?work_id=${work.work_id}&tab=homework`)}
                                                className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple-500/20 transition-all"
                                            >
                                                <PenLine className="w-4 h-4" /> Homework ({work.homework_count})
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
                {dailyWorks.length === 0 && (
                    <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-8 text-center">
                        <ClipboardList className="w-10 h-10 text-teal-400/20 mx-auto mb-2" />
                        <p className="text-white/30 text-sm">No daily work assigned today</p>
                        <p className="text-white/20 text-xs mt-1">Your teacher will assign MCQs &amp; homework here</p>
                    </div>
                )}
            </div>



        </div>
    )
}

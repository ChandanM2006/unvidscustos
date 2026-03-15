'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { NotificationBell } from '@/components/NotificationBell'
import {
    BookOpen, Clock, Calendar, FileText, CheckCircle,
    ClipboardCheck, ArrowRight, Loader2, Sparkles,
    BarChart3, Bell
} from 'lucide-react'

// ── Interfaces ──

interface ScheduleEntry {
    entry_id: string
    subject_id: string
    subject_name: string
    class_id: string
    class_name: string
    section_name: string
    start_time: string
    end_time: string
    slot_number: number
    room_number?: string
    is_substitute?: boolean
    lesson_topic?: string
    lesson_activities?: string[]
    lesson_type?: string
    plan_id?: string
}

interface DaySchedule {
    date: Date
    dayOfWeek: number
    label: string
    dateStr: string
    entries: ScheduleEntry[]
}

interface LessonPlan {
    plan_id: string
    document_title: string
    class_name: string
    status: string
    start_date: string
}

export default function TeacherDashboard() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [teacher, setTeacher] = useState<any>(null)
    const [scheduleData, setScheduleData] = useState<DaySchedule[]>([])
    const [selectedDayIndex, setSelectedDayIndex] = useState(1)
    const [upcomingPlans, setUpcomingPlans] = useState<LessonPlan[]>([])
    const [currentTime, setCurrentTime] = useState(new Date())
    const [stats, setStats] = useState({ classesToday: 0, completedToday: 0, lessonPlans: 0, pendingAttendance: 0 })

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => { loadTeacherData() }, [])

    async function loadTeacherData() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return }

            const { data: userData } = await supabase.from('users').select('*').eq('email', session.user.email).single()
            if (!userData || userData.role !== 'teacher') { router.replace('/dashboard/redirect'); return }

            setTeacher(userData)
            await Promise.all([loadThreeDaySchedule(userData.user_id), loadLessonPlans(userData.user_id)])
        } catch (err) { console.error(err) } finally { setLoading(false) }
    }

    async function loadThreeDaySchedule(teacherId: string) {
        const now = new Date()
        const days = [-1, 0, 1].map(offset => {
            const d = new Date(now)
            d.setDate(d.getDate() + offset)
            return {
                date: d, dayOfWeek: d.getDay(),
                label: offset === -1 ? 'Yesterday' : offset === 0 ? 'Today' : 'Tomorrow',
                dateStr: d.toISOString().split('T')[0]
            }
        })

        const daysOfWeek = [...new Set(days.map(d => d.dayOfWeek))]
        const { data: entries } = await supabase
            .from('timetable_entries')
            .select('entry_id, class_id, section_id, subject_id, day_of_week, slot_id, room_number, notes, teacher_id')
            .or(`teacher_id.eq.${teacherId},notes.ilike.%${teacherId}%`)
            .in('day_of_week', daysOfWeek)

        let allEntries = (entries || []).filter(e => {
            let subId = null
            if (e.notes) {
                try { const n = JSON.parse(e.notes); if (n.type === 'substitution') subId = n.substitute_teacher_id } catch {}
            }
            if (subId) { if (subId === teacherId) { (e as any).is_substitute = true; return true } return false }
            return e.teacher_id === teacherId
        })

        const classIds = [...new Set(allEntries.map(e => e.class_id).filter(Boolean))]
        const sectionIds = [...new Set(allEntries.map(e => e.section_id).filter(Boolean))]
        const subjectIds = [...new Set(allEntries.map(e => e.subject_id).filter(Boolean))]
        const slotIds = [...new Set(allEntries.map(e => e.slot_id).filter(Boolean))]

        const [classesRes, sectionsRes, subjectsRes, slotsRes] = await Promise.all([
            classIds.length ? supabase.from('classes').select('class_id, name').in('class_id', classIds) : { data: [] },
            sectionIds.length ? supabase.from('sections').select('section_id, name').in('section_id', sectionIds) : { data: [] },
            subjectIds.length ? supabase.from('subjects').select('subject_id, name').in('subject_id', subjectIds) : { data: [] },
            slotIds.length ? supabase.from('timetable_slots').select('slot_id, slot_number, start_time, end_time').in('slot_id', slotIds) : { data: [] },
        ])

        const classMap = new Map((classesRes.data || []).map((c: any) => [c.class_id, c.name]))
        const sectionMap = new Map((sectionsRes.data || []).map((s: any) => [s.section_id, s.name]))
        const subjectMap = new Map((subjectsRes.data || []).map((s: any) => [s.subject_id, s.name]))
        const slotMap = new Map((slotsRes.data || []).map((s: any) => [s.slot_id, { slot_number: s.slot_number, start_time: s.start_time, end_time: s.end_time }]))

        const { data: teacherPlans } = await supabase
            .from('lesson_plans')
            .select('plan_id, class_id, document_id, start_date, end_date, ai_schedule')
            .eq('teacher_id', teacherId)
            .in('status', ['draft', 'published', 'in_progress'])

        const plans = teacherPlans || []
        const dateStringsSet = new Set(days.map(d => d.dateStr))
        const lessonDetailLookup = new Map<string, { topic: string; activities: string[]; type: string; plan_id: string }>()

        function addDays(dateStr: string, n: number) {
            const d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]
        }

        for (const plan of plans) {
            const schedule = plan.ai_schedule?.schedule || plan.ai_schedule || []
            if (!Array.isArray(schedule)) continue
            for (const dayItem of schedule) {
                const dayNum = dayItem.day || dayItem.day_number
                if (!dayNum || !plan.start_date) continue
                const lessonDate = addDays(plan.start_date, dayNum - 1)
                if (!dateStringsSet.has(lessonDate)) continue
                const key = `${lessonDate}_${plan.class_id}`
                if (!lessonDetailLookup.has(key)) {
                    lessonDetailLookup.set(key, {
                        topic: dayItem.topic_title || dayItem.title || 'Lesson scheduled',
                        activities: dayItem.activities || [],
                        type: dayItem.type || 'teaching',
                        plan_id: plan.plan_id
                    })
                }
            }
        }

        const schedules: DaySchedule[] = days.map(day => ({
            ...day,
            entries: allEntries
                .filter(e => e.day_of_week === day.dayOfWeek)
                .map(e => {
                    const slot = slotMap.get(e.slot_id) || { slot_number: 0, start_time: '', end_time: '' }
                    const lessonInfo = lessonDetailLookup.get(`${day.dateStr}_${e.class_id}`)
                    return {
                        entry_id: e.entry_id, subject_id: e.subject_id,
                        subject_name: subjectMap.get(e.subject_id) || 'Unknown Subject',
                        class_id: e.class_id, class_name: classMap.get(e.class_id) || '',
                        section_name: sectionMap.get(e.section_id) || '',
                        start_time: slot.start_time, end_time: slot.end_time, slot_number: slot.slot_number,
                        room_number: e.room_number,
                        lesson_topic: lessonInfo?.topic, lesson_activities: lessonInfo?.activities,
                        lesson_type: lessonInfo?.type, plan_id: lessonInfo?.plan_id,
                        is_substitute: (e as any).is_substitute
                    } as ScheduleEntry
                })
                .sort((a, b) => a.slot_number - b.slot_number)
        }))

        setScheduleData(schedules)

        const todayEntries = schedules[1]?.entries || []
        const todayDateStr = schedules[1]?.dateStr || new Date().toISOString().split('T')[0]
        let pendingCount = todayEntries.length
        if (todayEntries.length > 0) {
            const uniqueClassIds = [...new Set(todayEntries.map(e => e.class_id))]
            const { data: markedAttendance } = await supabase
                .from('attendance_records').select('class_id')
                .eq('attendance_date', todayDateStr).in('class_id', uniqueClassIds)
            const markedClassIds = new Set((markedAttendance || []).map((a: any) => a.class_id))
            pendingCount = uniqueClassIds.filter(cId => !markedClassIds.has(cId)).length
        }
        setStats(prev => ({ ...prev, classesToday: todayEntries.length, pendingAttendance: pendingCount }))
    }

    async function loadLessonPlans(teacherId: string) {
        const { data: plans } = await supabase
            .from('lesson_plans')
            .select('plan_id, document_id, class_id, status, start_date')
            .eq('teacher_id', teacherId)
            .in('status', ['draft', 'published', 'in_progress'])
            .order('start_date', { ascending: true })
            .limit(5)

        if (!plans?.length) { setUpcomingPlans([]); return }

        const docIds = [...new Set(plans.map((p: any) => p.document_id).filter(Boolean))]
        const clsIds = [...new Set(plans.map((p: any) => p.class_id).filter(Boolean))]
        const [docsRes, clsRes] = await Promise.all([
            docIds.length ? supabase.from('syllabus_documents').select('document_id, chapter_title').in('document_id', docIds) : { data: [] },
            clsIds.length ? supabase.from('classes').select('class_id, name').in('class_id', clsIds) : { data: [] },
        ])
        const docMap = new Map((docsRes.data || []).map((d: any) => [d.document_id, d.chapter_title]))
        const clsMap = new Map((clsRes.data || []).map((c: any) => [c.class_id, c.name]))
        setUpcomingPlans(plans.map((p: any) => ({
            plan_id: p.plan_id,
            document_title: docMap.get(p.document_id) || 'Untitled',
            class_name: clsMap.get(p.class_id) || '',
            status: p.status, start_date: p.start_date,
        })))
        setStats(prev => ({ ...prev, lessonPlans: plans.length }))
    }

    function formatTime(time: string) {
        if (!time) return ''
        const [h, m] = time.split(':')
        const hour = parseInt(h) % 12 || 12
        const ampm = parseInt(h) >= 12 ? 'PM' : 'AM'
        return `${hour}:${m} ${ampm}`
    }

    function formatDateShort(date: Date) {
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })
    }

    function getTypeBadge(type?: string) {
        switch (type) {
            case 'revision':   return 'bg-amber-500/20 text-amber-300 border-amber-500/20'
            case 'assessment': return 'bg-red-500/20 text-red-300 border-red-500/20'
            default:           return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/20'
        }
    }

    function getTypeLabel(type?: string) {
        switch (type) {
            case 'revision':   return '📝 Revision'
            case 'assessment': return '📊 Assessment'
            default:           return '📖 Teaching'
        }
    }

    if (loading) {
        return (
            <div className="min-h-full flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-indigo-500/30 border-t-violet-400 animate-spin mx-auto" />
                        <BookOpen className="w-6 h-6 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="mt-4 text-indigo-300 text-sm font-medium animate-pulse">Loading your dashboard...</p>
                </div>
            </div>
        )
    }

    const currentDaySchedule = scheduleData[selectedDayIndex] || null

    return (
        <div className="p-4 sm:p-6 space-y-6 text-white">

            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/30">
                        {teacher?.full_name?.charAt(0) || 'T'}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            Hello, {teacher?.full_name?.split(' ')[0]}! 👋
                        </h1>
                        <p className="text-sm text-indigo-300/60">
                            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {teacher && <NotificationBell userId={teacher.user_id} />}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { icon: Clock,         label: 'Classes Today',      value: stats.classesToday,      gradient: 'from-indigo-500 to-violet-600', shadow: 'shadow-indigo-500/20' },
                    { icon: CheckCircle,   label: 'Completed',          value: stats.completedToday,    gradient: 'from-green-500 to-emerald-600', shadow: 'shadow-green-500/20' },
                    { icon: FileText,      label: 'Active Plans',       value: stats.lessonPlans,       gradient: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/20' },
                    { icon: ClipboardCheck,label: 'Pending Attendance', value: stats.pendingAttendance, gradient: 'from-orange-400 to-red-500',    shadow: 'shadow-orange-500/20' },
                ].map(({ icon: Icon, label, value, gradient, shadow }) => (
                    <div key={label} className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl p-4 text-center">
                        <div className={`w-10 h-10 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center mb-2 mx-auto shadow-md ${shadow}`}>
                            <Icon className="w-5 h-5 text-white" />
                        </div>
                        <p className="text-2xl font-bold text-white">{value}</p>
                        <p className="text-[11px] text-indigo-300/50 mt-0.5 font-medium">{label}</p>
                    </div>
                ))}
            </div>

            {/* 3-Day Schedule */}
            <div className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                {/* Day Tabs */}
                <div className="flex border-b border-white/[0.07]">
                    {scheduleData.map((day, idx) => (
                        <button
                            key={idx}
                            onClick={() => setSelectedDayIndex(idx)}
                            className={`flex-1 py-4 px-4 text-center transition-all relative
                                ${selectedDayIndex === idx
                                    ? 'bg-gradient-to-r from-indigo-500/30 to-violet-500/30 border-b-2 border-indigo-400'
                                    : 'hover:bg-white/[0.04] text-white/40'
                                }`}
                        >
                            <p className={`text-xs font-bold uppercase tracking-wider ${selectedDayIndex === idx ? 'text-indigo-300' : 'text-white/30'}`}>
                                {day.label}
                            </p>
                            <p className={`text-sm font-semibold mt-0.5 ${selectedDayIndex === idx ? 'text-white' : 'text-white/50'}`}>
                                {formatDateShort(day.date)}
                            </p>
                            <p className={`text-xs mt-0.5 ${selectedDayIndex === idx ? 'text-indigo-300/70' : 'text-white/20'}`}>
                                {day.entries.length} {day.entries.length === 1 ? 'class' : 'classes'}
                            </p>
                        </button>
                    ))}
                </div>

                {/* Schedule Content */}
                <div className="divide-y divide-white/[0.05] max-h-[30rem] overflow-y-auto">
                    {currentDaySchedule?.entries.length ? (
                        currentDaySchedule.entries.map((cls, idx) => (
                            <div key={cls.entry_id + idx} className="px-5 py-4 hover:bg-white/[0.03] transition-colors">
                                <div className="flex items-start gap-4">
                                    {/* Time */}
                                    <div className="flex-shrink-0 w-20 text-center pt-0.5">
                                        <p className="text-sm font-bold text-indigo-400">{formatTime(cls.start_time)}</p>
                                        <p className="text-xs text-white/30">{formatTime(cls.end_time)}</p>
                                    </div>
                                    <div className="w-px bg-indigo-500/20 self-stretch min-h-[3rem] flex-shrink-0" />
                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-semibold text-white text-sm">
                                                {cls.is_substitute && (
                                                    <span className="text-[9px] uppercase font-bold text-violet-900 bg-violet-300 px-1.5 py-0.5 rounded mr-2 align-middle">SUB</span>
                                                )}
                                                {cls.subject_name}
                                            </p>
                                            <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs rounded-full">
                                                {cls.class_name} {cls.section_name}
                                            </span>
                                            {cls.room_number && (
                                                <span className="px-2 py-0.5 bg-white/5 border border-white/10 text-white/40 text-xs rounded-full">
                                                    Room {cls.room_number}
                                                </span>
                                            )}
                                        </div>
                                        {cls.lesson_topic ? (
                                            <div className="mt-2 p-2.5 bg-white/[0.04] rounded-xl border border-white/[0.07]">
                                                <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase rounded border ${getTypeBadge(cls.lesson_type)} mb-1`}>
                                                    {getTypeLabel(cls.lesson_type)}
                                                </span>
                                                <p className="text-sm text-white/80">{cls.lesson_topic}</p>
                                                {cls.lesson_activities && cls.lesson_activities.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                        {cls.lesson_activities.map((act, i) => (
                                                            <span key={i} className="px-2 py-0.5 bg-blue-500/10 text-blue-300 text-[11px] rounded-full border border-blue-500/10">{act}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="mt-1.5 text-xs text-white/20 italic">No lesson plan for this date</p>
                                        )}
                                    </div>
                                    {cls.plan_id && (
                                        <button
                                            onClick={() => router.push(`/dashboard/manage/lesson-plans/${cls.plan_id}`)}
                                            className="flex-shrink-0 p-1.5 text-indigo-400/50 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors"
                                        >
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="px-5 py-12 text-center">
                            <Calendar className="w-12 h-12 text-indigo-400/20 mx-auto mb-3" />
                            <p className="text-white/30 font-medium">
                                {currentDaySchedule?.date.getDay() === 0 ? 'Sunday — No classes' : 'No classes scheduled'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Active Lesson Plans */}
            <div className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.07] flex items-center gap-2 bg-gradient-to-r from-violet-500/20 to-pink-500/20">
                    <FileText className="w-5 h-5 text-violet-400" />
                    <h2 className="text-base font-bold text-white">Active Lesson Plans</h2>
                    <span className="ml-auto text-xs text-violet-300/50">{upcomingPlans.length} active</span>
                </div>
                <div className="divide-y divide-white/[0.05] max-h-80 overflow-y-auto">
                    {upcomingPlans.length > 0 ? upcomingPlans.map(plan => (
                        <button
                            key={plan.plan_id}
                            onClick={() => router.push(`/dashboard/manage/lesson-plans/${plan.plan_id}`)}
                            className="w-full px-5 py-3.5 hover:bg-white/[0.03] flex items-center justify-between text-left transition-colors"
                        >
                            <div>
                                <p className="font-semibold text-white text-sm">{plan.document_title}</p>
                                <p className="text-xs text-indigo-300/50">{plan.class_name}</p>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${plan.status === 'published' ? 'bg-green-500/20 text-green-300 border border-green-500/20' :
                                plan.status === 'in_progress' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/20' :
                                    'bg-white/5 text-white/30 border border-white/10'}`}>
                                {plan.status}
                            </span>
                        </button>
                    )) : (
                        <div className="px-5 py-10 text-center">
                            <FileText className="w-10 h-10 text-indigo-400/20 mx-auto mb-2" />
                            <p className="text-white/30 text-sm">No active lesson plans</p>
                            <button
                                onClick={() => router.push('/dashboard/manage/lesson-plans/create')}
                                className="mt-3 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-violet-500/20 transition-all"
                            >
                                <Sparkles className="w-4 h-4 inline mr-1" />
                                Create New Plan
                            </button>
                        </div>
                    )}
                </div>
            </div>

        </div>
    )
}

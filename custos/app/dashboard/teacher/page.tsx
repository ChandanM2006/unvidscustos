'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { NotificationBell } from '@/components/NotificationBell'
import {
    BookOpen, Clock, Calendar, FileText, Brain, CheckCircle,
    ClipboardCheck, ChevronRight, Loader2, Sparkles,
    BarChart3, MessageSquare, ChevronLeft, ArrowRight, Radio, LogOut, Edit3,
    Newspaper
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
    // Lesson plan info (if available for this date)
    lesson_topic?: string
    lesson_activities?: string[]
    lesson_type?: string // 'teaching' | 'revision' | 'assessment'
    plan_id?: string
}

interface DaySchedule {
    date: Date
    dayOfWeek: number
    label: string
    dateStr: string // YYYY-MM-DD
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
    const [selectedDayIndex, setSelectedDayIndex] = useState(1) // 0=yesterday, 1=today, 2=tomorrow
    const [upcomingPlans, setUpcomingPlans] = useState<LessonPlan[]>([])
    const [currentTime, setCurrentTime] = useState(new Date())
    const [stats, setStats] = useState({
        classesToday: 0,
        completedToday: 0,
        lessonPlans: 0,
        pendingAttendance: 0
    })

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        loadTeacherData()
    }, [])

    async function loadTeacherData() {
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

            if (!userData || userData.role !== 'teacher') {
                router.replace('/dashboard/redirect')
                return
            }

            setTeacher(userData)

            // Load 3-day schedule + lesson plans in parallel
            await Promise.all([
                loadThreeDaySchedule(userData.user_id),
                loadLessonPlans(userData.user_id)
            ])

        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    /**
     * Load schedule for yesterday, today, and tomorrow.
     * For each day: get timetable entries, then enrich with lesson plan topics.
     */
    async function loadThreeDaySchedule(teacherId: string) {
        const now = new Date()
        const days: { date: Date; dayOfWeek: number; label: string; dateStr: string }[] = []

        for (let offset = -1; offset <= 1; offset++) {
            const d = new Date(now)
            d.setDate(d.getDate() + offset)
            const dayOfWeek = d.getDay() // 0=Sun
            const label = offset === -1 ? 'Yesterday' : offset === 0 ? 'Today' : 'Tomorrow'
            const dateStr = d.toISOString().split('T')[0]
            days.push({ date: d, dayOfWeek, label, dateStr })
        }

        // Get unique day_of_week values we need
        const daysOfWeek = [...new Set(days.map(d => d.dayOfWeek))]

        // Step 1: Fetch timetable entries for all needed days
        const { data: entries, error } = await supabase
            .from('timetable_entries')
            .select('entry_id, class_id, section_id, subject_id, day_of_week, slot_id, room_number')
            .eq('teacher_id', teacherId)
            .in('day_of_week', daysOfWeek)

        if (error) {
            console.error('Error loading timetable entries:', error)
        }

        const allEntries = entries || []

        // Step 2: Collect unique IDs for lookup
        const classIds = [...new Set(allEntries.map(e => e.class_id).filter(Boolean))]
        const sectionIds = [...new Set(allEntries.map(e => e.section_id).filter(Boolean))]
        const subjectIds = [...new Set(allEntries.map(e => e.subject_id).filter(Boolean))]
        const slotIds = [...new Set(allEntries.map(e => e.slot_id).filter(Boolean))]

        // Step 3: Fetch lookups in parallel
        const [classesRes, sectionsRes, subjectsRes, slotsRes] = await Promise.all([
            classIds.length > 0
                ? supabase.from('classes').select('class_id, name').in('class_id', classIds)
                : { data: [] },
            sectionIds.length > 0
                ? supabase.from('sections').select('section_id, name').in('section_id', sectionIds)
                : { data: [] },
            subjectIds.length > 0
                ? supabase.from('subjects').select('subject_id, name').in('subject_id', subjectIds)
                : { data: [] },
            slotIds.length > 0
                ? supabase.from('timetable_slots').select('slot_id, slot_number, start_time, end_time').in('slot_id', slotIds)
                : { data: [] }
        ])

        const classMap = new Map((classesRes.data || []).map((c: any) => [c.class_id, c.name]))
        const sectionMap = new Map((sectionsRes.data || []).map((s: any) => [s.section_id, s.name]))
        const subjectMap = new Map((subjectsRes.data || []).map((s: any) => [s.subject_id, s.name]))
        const slotMap = new Map((slotsRes.data || []).map((s: any) => [s.slot_id, { slot_number: s.slot_number, start_time: s.start_time, end_time: s.end_time }]))

        // Step 4: Get teacher's active lesson plans WITH ai_schedule
        const { data: teacherPlans } = await supabase
            .from('lesson_plans')
            .select('plan_id, class_id, document_id, start_date, end_date, ai_schedule')
            .eq('teacher_id', teacherId)
            .in('status', ['draft', 'published', 'in_progress'])

        const plans = teacherPlans || []

        // Step 5: Build lookup from ai_schedule JSONB (the actual source of truth)
        // ai_schedule has: { schedule: [{ day: 1, topic_title: "...", activities: [...], type: "teaching" }, ...] }
        const dateStringsSet = new Set(days.map(d => d.dateStr))

        // Helper: add N days to a date string
        function addDays(dateStr: string, n: number): string {
            const d = new Date(dateStr + 'T12:00:00') // noon to avoid TZ issues
            d.setDate(d.getDate() + n)
            return d.toISOString().split('T')[0]
        }

        const lessonDetailLookup = new Map<string, { topic: string; activities: string[]; type: string; plan_id: string }>()

        for (const plan of plans) {
            const schedule = plan.ai_schedule?.schedule || plan.ai_schedule || []
            if (!Array.isArray(schedule) || schedule.length === 0) continue

            for (const dayItem of schedule) {
                const dayNum = dayItem.day || dayItem.day_number
                if (!dayNum || !plan.start_date) continue

                // Compute the date for this day: start_date + (dayNum - 1)
                const lessonDate = addDays(plan.start_date, dayNum - 1)

                if (!dateStringsSet.has(lessonDate)) continue

                const entry = {
                    topic: dayItem.topic_title || dayItem.title || 'Lesson scheduled',
                    activities: dayItem.activities || [],
                    type: dayItem.type || 'teaching',
                    plan_id: plan.plan_id
                }

                // Key: date + class_id (since the plan already knows its class)
                const key = `${lessonDate}_${plan.class_id}`
                if (!lessonDetailLookup.has(key)) {
                    lessonDetailLookup.set(key, entry)
                }
            }
        }

        // Step 8: Assemble each day's schedule
        const schedules: DaySchedule[] = days.map(day => {
            const dayEntries = allEntries
                .filter(e => e.day_of_week === day.dayOfWeek)
                .map(e => {
                    const slot = slotMap.get(e.slot_id) || { slot_number: 0, start_time: '', end_time: '' }

                    // Try subject-specific key first, then class-only fallback
                    const keyWithSubject = `${day.dateStr}_${e.class_id}_${e.subject_id}`
                    const keyClassOnly = `${day.dateStr}_${e.class_id}`
                    const lessonInfo = lessonDetailLookup.get(keyWithSubject) || lessonDetailLookup.get(keyClassOnly)

                    return {
                        entry_id: e.entry_id,
                        subject_id: e.subject_id,
                        subject_name: subjectMap.get(e.subject_id) || 'Unknown Subject',
                        class_id: e.class_id,
                        class_name: classMap.get(e.class_id) || '',
                        section_name: sectionMap.get(e.section_id) || '',
                        start_time: slot.start_time,
                        end_time: slot.end_time,
                        slot_number: slot.slot_number,
                        room_number: e.room_number,
                        lesson_topic: lessonInfo?.topic,
                        lesson_activities: lessonInfo?.activities,
                        lesson_type: lessonInfo?.type,
                        plan_id: lessonInfo?.plan_id
                    } as ScheduleEntry
                })
                .sort((a, b) => a.slot_number - b.slot_number)

            return {
                ...day,
                entries: dayEntries
            }
        })

        setScheduleData(schedules)

        // Update stats (today = index 1)
        const todayEntries = schedules[1]?.entries || []
        setStats(prev => ({ ...prev, classesToday: todayEntries.length }))
    }

    async function loadLessonPlans(teacherId: string) {
        // Load lesson plans (avoid PostgREST join issues)
        const { data: plans } = await supabase
            .from('lesson_plans')
            .select('plan_id, document_id, class_id, status, start_date')
            .eq('teacher_id', teacherId)
            .in('status', ['draft', 'published', 'in_progress'])
            .order('start_date', { ascending: true })
            .limit(5)

        if (!plans || plans.length === 0) {
            setUpcomingPlans([])
            return
        }

        // Fetch document titles and class names
        const docIds = [...new Set(plans.map(p => p.document_id).filter(Boolean))]
        const clsIds = [...new Set(plans.map(p => p.class_id).filter(Boolean))]

        const [docsRes, clsRes] = await Promise.all([
            docIds.length > 0
                ? supabase.from('syllabus_documents').select('document_id, chapter_title').in('document_id', docIds)
                : { data: [] },
            clsIds.length > 0
                ? supabase.from('classes').select('class_id, name').in('class_id', clsIds)
                : { data: [] }
        ])

        const docMap = new Map((docsRes.data || []).map((d: any) => [d.document_id, d.chapter_title]))
        const clsMap = new Map((clsRes.data || []).map((c: any) => [c.class_id, c.name]))

        setUpcomingPlans(plans.map(p => ({
            plan_id: p.plan_id,
            document_title: docMap.get(p.document_id) || 'Untitled',
            class_name: clsMap.get(p.class_id) || '',
            status: p.status,
            start_date: p.start_date
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

    function getTypeColor(type?: string) {
        switch (type) {
            case 'revision': return 'bg-amber-100 text-amber-700 border-amber-200'
            case 'assessment': return 'bg-red-100 text-red-700 border-red-200'
            default: return 'bg-emerald-100 text-emerald-700 border-emerald-200'
        }
    }

    function getTypeLabel(type?: string) {
        switch (type) {
            case 'revision': return '📝 Revision'
            case 'assessment': return '📊 Assessment'
            default: return '📖 Teaching'
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            </div>
        )
    }

    const currentDaySchedule = scheduleData[selectedDayIndex] || null

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            {/* Header */}
            <header className="bg-white border-b shadow-sm sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                            {teacher?.full_name?.charAt(0) || 'T'}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">
                                Hello, {teacher?.full_name?.split(' ')[0]}!
                            </h1>
                            <p className="text-sm text-gray-500">
                                {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {teacher && <NotificationBell userId={teacher.user_id} />}
                        <button
                            onClick={async () => {
                                await supabase.auth.signOut()
                                router.push('/login')
                            }}
                            className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-6 space-y-6">
                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <Clock className="w-8 h-8 text-indigo-600 mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{stats.classesToday}</p>
                        <p className="text-sm text-gray-500">Classes Today</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <CheckCircle className="w-8 h-8 text-green-600 mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{stats.completedToday}</p>
                        <p className="text-sm text-gray-500">Completed</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <FileText className="w-8 h-8 text-purple-600 mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{stats.lessonPlans}</p>
                        <p className="text-sm text-gray-500">Active Plans</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <ClipboardCheck className="w-8 h-8 text-orange-600 mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{stats.pendingAttendance}</p>
                        <p className="text-sm text-gray-500">Pending Attendance</p>
                    </div>
                </div>

                {/* ── 3-Day Schedule ── */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    {/* Day Tabs */}
                    <div className="flex border-b">
                        {scheduleData.map((day, idx) => (
                            <button
                                key={idx}
                                onClick={() => setSelectedDayIndex(idx)}
                                className={`flex-1 py-4 px-4 text-center transition-all relative ${selectedDayIndex === idx
                                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <p className={`text-xs font-bold uppercase tracking-wider ${selectedDayIndex === idx ? 'text-indigo-100' : 'text-gray-400'
                                    }`}>
                                    {day.label}
                                </p>
                                <p className={`text-sm font-semibold mt-0.5 ${selectedDayIndex === idx ? 'text-white' : 'text-gray-700'
                                    }`}>
                                    {formatDateShort(day.date)}
                                </p>
                                <p className={`text-xs mt-0.5 ${selectedDayIndex === idx ? 'text-indigo-200' : 'text-gray-400'
                                    }`}>
                                    {day.entries.length} {day.entries.length === 1 ? 'class' : 'classes'}
                                </p>
                            </button>
                        ))}
                    </div>

                    {/* Schedule Content */}
                    <div className="divide-y max-h-[32rem] overflow-y-auto">
                        {currentDaySchedule && currentDaySchedule.entries.length > 0 ? (
                            currentDaySchedule.entries.map((cls, idx) => (
                                <div
                                    key={cls.entry_id + idx}
                                    className="p-4 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Time Column */}
                                        <div className="flex-shrink-0 w-20 text-center pt-1">
                                            <p className="text-sm font-bold text-indigo-600">
                                                {formatTime(cls.start_time)}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {formatTime(cls.end_time)}
                                            </p>
                                        </div>

                                        {/* Divider line */}
                                        <div className="flex-shrink-0 w-px bg-indigo-200 self-stretch min-h-[3rem]" />

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-semibold text-gray-900 text-base">
                                                    {cls.subject_name}
                                                </p>
                                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded-full border border-indigo-100 font-medium">
                                                    {cls.class_name} {cls.section_name}
                                                </span>
                                                {cls.room_number && (
                                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                                                        Room {cls.room_number}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Lesson Plan Info */}
                                            {cls.lesson_topic ? (
                                                <div className="mt-2 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded border ${getTypeColor(cls.lesson_type)}`}>
                                                            {getTypeLabel(cls.lesson_type)}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-medium text-gray-800">
                                                        {cls.lesson_topic}
                                                    </p>
                                                    {cls.lesson_activities && cls.lesson_activities.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                            {cls.lesson_activities.map((act, i) => (
                                                                <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[11px] rounded-full border border-blue-100">
                                                                    {act}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="mt-1.5 text-xs text-gray-400 italic">
                                                    No lesson plan for this date
                                                </p>
                                            )}
                                        </div>

                                        {/* Action */}
                                        {cls.plan_id && (
                                            <button
                                                onClick={() => router.push(`/dashboard/manage/lesson-plans/${cls.plan_id}`)}
                                                className="flex-shrink-0 p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="View Lesson Plan"
                                            >
                                                <ArrowRight className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-10 text-center text-gray-500">
                                <Calendar className="w-14 h-14 mx-auto mb-3 opacity-20" />
                                <p className="font-medium text-gray-600">
                                    {currentDaySchedule?.date.getDay() === 0
                                        ? 'Sunday — No classes'
                                        : 'No classes scheduled'}
                                </p>
                                <p className="text-sm text-gray-400 mt-1">
                                    {currentDaySchedule?.label === 'Today'
                                        ? 'Your timetable has no entries for today'
                                        : `Nothing on ${formatDateShort(currentDaySchedule?.date || new Date())}`
                                    }
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Active Lesson Plans */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div className="p-6 border-b bg-gradient-to-r from-purple-500 to-pink-600">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            Active Lesson Plans
                        </h2>
                    </div>
                    <div className="divide-y max-h-96 overflow-y-auto">
                        {upcomingPlans.length > 0 ? upcomingPlans.map(plan => (
                            <button
                                key={plan.plan_id}
                                onClick={() => router.push(`/dashboard/manage/lesson-plans/${plan.plan_id}`)}
                                className="w-full p-4 hover:bg-gray-50 flex items-center justify-between text-left"
                            >
                                <div>
                                    <p className="font-semibold text-gray-900">{plan.document_title}</p>
                                    <p className="text-sm text-gray-500">{plan.class_name}</p>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${plan.status === 'published' ? 'bg-green-100 text-green-700' :
                                    plan.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>
                                    {plan.status}
                                </span>
                            </button>
                        )) : (
                            <div className="p-8 text-center text-gray-500">
                                <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                <p>No active lesson plans</p>
                                <button
                                    onClick={() => router.push('/dashboard/manage/lesson-plans/create')}
                                    className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm"
                                >
                                    Create New Plan
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <button
                        onClick={() => router.push('/dashboard/calendar')}
                        className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-center"
                    >
                        <Calendar className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
                        <p className="font-medium text-gray-900">Calendar</p>
                        <p className="text-xs text-gray-500">Events & Schedules</p>
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/posts')}
                        className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-center"
                    >
                        <Newspaper className="w-10 h-10 text-rose-500 mx-auto mb-2" />
                        <p className="font-medium text-gray-900">Posts</p>
                        <p className="text-xs text-gray-500">Announcements</p>
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/teacher/performance')}
                        className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-center"
                    >
                        <BarChart3 className="w-10 h-10 text-indigo-600 mx-auto mb-2" />
                        <p className="font-medium text-gray-900">Performance</p>
                        <p className="text-xs text-gray-500">Class analytics</p>
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/manage/attendance')}
                        className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-center"
                    >
                        <ClipboardCheck className="w-10 h-10 text-orange-600 mx-auto mb-2" />
                        <p className="font-medium text-gray-900">Mark Attendance</p>
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/manage/lesson-plans/create')}
                        className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-center"
                    >
                        <Sparkles className="w-10 h-10 text-purple-600 mx-auto mb-2" />
                        <p className="font-medium text-gray-900">AI Lesson Plan</p>
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/teacher/live-class')}
                        className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-center"
                    >
                        <Radio className="w-10 h-10 text-red-500 mx-auto mb-2" />
                        <p className="font-medium text-gray-900">Live Class</p>
                        <p className="text-xs text-gray-500">Start & Manage Sessions</p>
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/teacher/brain')}
                        className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-center"
                    >
                        <Brain className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                        <p className="font-medium text-gray-900">Brain</p>
                        <p className="text-xs text-gray-500">Daily & Weekly Practice</p>
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/teacher/marks-entry')}
                        className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-center"
                    >
                        <Edit3 className="w-10 h-10 text-rose-600 mx-auto mb-2" />
                        <p className="font-medium text-gray-900">Marks Entry</p>
                        <p className="text-xs text-gray-500">Enter exam marks</p>
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/teacher/doubts')}
                        className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-center"
                    >
                        <MessageSquare className="w-10 h-10 text-cyan-600 mx-auto mb-2" />
                        <p className="font-medium text-gray-900">Student Doubts</p>
                    </button>
                </div>
            </main>
        </div>
    )
}

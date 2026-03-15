'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X,
    Loader2, Sun, Moon, Star, BookOpen, Clock, Users, Trash2,
    GraduationCap, AlertCircle, ArrowLeft, Sparkles, Edit2
} from 'lucide-react'

interface SchoolEvent {
    event_id: string
    title: string
    description: string | null
    event_date: string
    end_date: string | null
    event_type: 'holiday' | 'occasion' | 'exam_period' | 'other'
    color: string
    created_by: string | null
}

interface TimetableEntry {
    entry_id: string
    class_id: string
    section_id: string
    subject_id: string
    teacher_id: string
    day_of_week: number
    slot_id: string
    room_number?: string
    class_name?: string
    section_name?: string
    subject_name?: string
    teacher_name?: string
    start_time?: string
    end_time?: string
    slot_name?: string
    is_break?: boolean
    is_substitute?: boolean
}

interface ExamInfo {
    exam_id: string
    name: string
    exam_type_name: string
    start_date: string
    end_date: string
    status: string
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const EVENT_TYPES = [
    { value: 'holiday', label: 'Holiday', color: '#EF4444', emoji: '🏖️' },
    { value: 'occasion', label: 'Special Occasion', color: '#F59E0B', emoji: '🎉' },
    { value: 'exam_period', label: 'Examination Period', color: '#8B5CF6', emoji: '📝' },
    { value: 'other', label: 'Other', color: '#3B82F6', emoji: '📌' },
]

export default function CalendarPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<any>(null)
    const [schoolId, setSchoolId] = useState<string | null>(null)
    const [isAdmin, setIsAdmin] = useState(false)

    // Calendar state
    const [currentDate, setCurrentDate] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [events, setEvents] = useState<SchoolEvent[]>([])
    const [dailySchedule, setDailySchedule] = useState<TimetableEntry[]>([])
    const [dailyLoading, setDailyLoading] = useState(false)
    const [exams, setExams] = useState<ExamInfo[]>([])

    // Event creation modal
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [creating, setCreating] = useState(false)
    const [newEvent, setNewEvent] = useState({
        title: '',
        description: '',
        event_date: '',
        end_date: '',
        event_type: 'other' as string,
        color: '#3B82F6',
    })

    useEffect(() => {
        loadInitialData()
    }, [])

    useEffect(() => {
        if (schoolId) {
            loadEvents()
        }
    }, [currentDate, schoolId])

    async function loadInitialData() {
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

            if (!userData) {
                router.push('/login')
                return
            }

            setUser(userData)
            setSchoolId(userData.school_id)
            setIsAdmin(['super_admin', 'sub_admin'].includes(userData.role))
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadEvents() {
        if (!schoolId) return

        try {
            // Get first and last day of current month view (with buffer for prev/next month days)
            const year = currentDate.getFullYear()
            const month = currentDate.getMonth()
            const firstDay = new Date(year, month, 1)
            const lastDay = new Date(year, month + 1, 0)

            // Buffer: 7 days before and after
            const startDate = new Date(firstDay)
            startDate.setDate(startDate.getDate() - 7)
            const endDate = new Date(lastDay)
            endDate.setDate(endDate.getDate() + 7)

            const { data, error } = await supabase
                .from('school_events')
                .select('*')
                .eq('school_id', schoolId)
                .gte('event_date', startDate.toISOString().split('T')[0])
                .lte('event_date', endDate.toISOString().split('T')[0])
                .order('event_date', { ascending: true })

            if (error) {
                if (error.code === '42P01' || error.message?.includes('does not exist')) {
                    setEvents([])
                    return
                }
                throw error
            }

            setEvents(data || [])

            // Also load exams for the month
            const { data: examData } = await supabase
                .from('exams')
                .select(`
                    *,
                    exam_types!exam_type_id(name)
                `)
                .gte('start_date', startDate.toISOString().split('T')[0])
                .lte('start_date', endDate.toISOString().split('T')[0])

            if (examData) {
                setExams(examData.map((e: any) => ({
                    exam_id: e.exam_id,
                    name: e.name,
                    exam_type_name: e.exam_types?.name || '',
                    start_date: e.start_date,
                    end_date: e.end_date,
                    status: e.status,
                })))
            }
        } catch (error) {
            console.error('Error loading events:', error)
        }
    }

    async function loadDailySchedule(date: Date) {
        if (!schoolId) return
        setDailyLoading(true)
        setSelectedDate(date)

        try {
            const dayOfWeek = date.getDay() // 0=Sun, 1=Mon, etc.

            // Load timetable entries for this day
            const { data: entries, error } = await supabase
                .from('timetable_entries')
                .select('*')
                .eq('day_of_week', dayOfWeek)

            if (error) {
                if (error.code === '42P01') {
                    setDailySchedule([])
                    return
                }
                throw error
            }

            if (!entries || entries.length === 0) {
                setDailySchedule([])
                return
            }

            // Load associated data
            const classIds = [...new Set(entries.map(e => e.class_id))]
            const sectionIds = [...new Set(entries.map(e => e.section_id).filter(Boolean))]
            const subjectIds = [...new Set(entries.map(e => e.subject_id).filter(Boolean))]
            const slotIds = [...new Set(entries.map(e => e.slot_id).filter(Boolean))]

            // Look for substitutes
            const substituteTeacherIds = new Set<string>();
            entries.forEach(e => {
                if (e.notes) {
                    try {
                        const n = JSON.parse(e.notes);
                        if (n.type === 'substitution' && n.substitute_teacher_id) {
                            e.substitute_teacher_id = n.substitute_teacher_id;
                            substituteTeacherIds.add(n.substitute_teacher_id);
                        }
                    } catch(err) {}
                }
            });
            const teacherIds = [...new Set([...entries.map(e => e.teacher_id).filter(Boolean), ...Array.from(substituteTeacherIds)])]

            const [classRes, sectionRes, subjectRes, teacherRes, slotRes] = await Promise.all([
                classIds.length > 0 ? supabase.from('classes').select('class_id, name').in('class_id', classIds).eq('school_id', schoolId) : { data: [] },
                sectionIds.length > 0 ? supabase.from('sections').select('section_id, name').in('section_id', sectionIds) : { data: [] },
                subjectIds.length > 0 ? supabase.from('subjects').select('subject_id, name').in('subject_id', subjectIds) : { data: [] },
                teacherIds.length > 0 ? supabase.from('users').select('user_id, full_name').in('user_id', teacherIds) : { data: [] },
                slotIds.length > 0 ? supabase.from('timetable_slots').select('*').in('slot_id', slotIds).eq('school_id', schoolId).order('slot_number') : { data: [] },
            ])

            const classMap = new Map((classRes.data || []).map((c: any) => [c.class_id, c.name]))
            const sectionMap = new Map((sectionRes.data || []).map((s: any) => [s.section_id, s.name]))
            const subjectMap = new Map((subjectRes.data || []).map((s: any) => [s.subject_id, s.name]))
            const teacherMap = new Map((teacherRes.data || []).map((t: any) => [t.user_id, t.full_name]))
            const slotMap = new Map((slotRes.data || []).map((s: any) => [s.slot_id, s]))

            // Filter by school classes only
            const schoolClassIds = new Set(classMap.keys())

            const enriched: TimetableEntry[] = entries
                .filter(e => schoolClassIds.has(e.class_id))
                .map(e => {
                    const slot = slotMap.get(e.slot_id);
                    const isSub = !!e.substitute_teacher_id;
                    return {
                        ...e,
                        class_name: classMap.get(e.class_id) || 'Unknown',
                        section_name: sectionMap.get(e.section_id) || '',
                        subject_name: subjectMap.get(e.subject_id) || 'Unknown',
                        teacher_name: isSub ? teacherMap.get(e.substitute_teacher_id) || 'Substitute' : teacherMap.get(e.teacher_id) || 'Unassigned',
                        is_substitute: isSub,
                        start_time: slot?.start_time || '',
                        end_time: slot?.end_time || '',
                        slot_name: slot?.slot_name || '',
                        is_break: slot?.is_break || false,
                    }
                })
                .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))

            setDailySchedule(enriched)
        } catch (error) {
            console.error('Error loading daily schedule:', error)
            setDailySchedule([])
        } finally {
            setDailyLoading(false)
        }
    }

    async function createEvent() {
        if (!schoolId || !user || !newEvent.title || !newEvent.event_date) return

        setCreating(true)
        try {
            const typeConfig = EVENT_TYPES.find(t => t.value === newEvent.event_type)

            const { error } = await supabase
                .from('school_events')
                .insert({
                    school_id: schoolId,
                    title: newEvent.title,
                    description: newEvent.description || null,
                    event_date: newEvent.event_date,
                    end_date: newEvent.end_date || null,
                    event_type: newEvent.event_type,
                    color: typeConfig?.color || newEvent.color,
                    created_by: user.user_id,
                })

            if (error) throw error

            setShowCreateModal(false)
            setNewEvent({ title: '', description: '', event_date: '', end_date: '', event_type: 'other', color: '#3B82F6' })
            await loadEvents()
        } catch (error: any) {
            console.error('Error creating event:', error)
            alert('Error creating event: ' + error.message)
        } finally {
            setCreating(false)
        }
    }

    async function deleteEvent(eventId: string) {
        if (!confirm('Delete this event?')) return

        try {
            const { error } = await supabase
                .from('school_events')
                .delete()
                .eq('event_id', eventId)

            if (error) throw error
            await loadEvents()
        } catch (error: any) {
            console.error('Error deleting event:', error)
            alert('Error: ' + error.message)
        }
    }

    // Calendar helper functions
    function getDaysInMonth(year: number, month: number): number {
        return new Date(year, month + 1, 0).getDate()
    }

    function getFirstDayOfMonth(year: number, month: number): number {
        return new Date(year, month, 1).getDay()
    }

    function getCalendarDays() {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        const daysInMonth = getDaysInMonth(year, month)
        const firstDay = getFirstDayOfMonth(year, month)
        const daysInPrevMonth = getDaysInMonth(year, month - 1)

        const days: { date: Date; isCurrentMonth: boolean; isToday: boolean }[] = []
        const today = new Date()

        // Previous month days
        for (let i = firstDay - 1; i >= 0; i--) {
            const date = new Date(year, month - 1, daysInPrevMonth - i)
            days.push({ date, isCurrentMonth: false, isToday: false })
        }

        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i)
            const isToday = date.toDateString() === today.toDateString()
            days.push({ date, isCurrentMonth: true, isToday })
        }

        // Next month days (fill to 42 = 6 rows)
        const remaining = 42 - days.length
        for (let i = 1; i <= remaining; i++) {
            const date = new Date(year, month + 1, i)
            days.push({ date, isCurrentMonth: false, isToday: false })
        }

        return days
    }

    function getEventsForDate(date: Date): SchoolEvent[] {
        const dateStr = date.toISOString().split('T')[0]
        return events.filter(e => {
            if (e.event_date === dateStr) return true
            if (e.end_date && e.event_date <= dateStr && e.end_date >= dateStr) return true
            return false
        })
    }

    function getExamsForDate(date: Date): ExamInfo[] {
        const dateStr = date.toISOString().split('T')[0]
        return exams.filter(e => {
            if (e.start_date === dateStr) return true
            if (e.end_date && e.start_date <= dateStr && e.end_date >= dateStr) return true
            return false
        })
    }

    function formatTime(time: string): string {
        if (!time) return ''
        const [hours, minutes] = time.split(':')
        const hour = parseInt(hours)
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const displayHour = hour % 12 || 12
        return `${displayHour}:${minutes} ${ampm}`
    }

    function navigateMonth(direction: number) {
        setCurrentDate(prev => {
            const next = new Date(prev)
            next.setMonth(next.getMonth() + direction)
            return next
        })
    }

    function goToToday() {
        setCurrentDate(new Date())
    }

    function getBackPath() {
        if (!user) return '/dashboard'
        if (user.role === 'teacher') return '/dashboard/teacher'
        if (user.role === 'student') return '/dashboard/student'
        if (user.role === 'parent') return '/dashboard/parent'
        return '/dashboard'
    }

    // Group daily schedule by time slot
    function groupBySlot(schedule: TimetableEntry[]) {
        const groups = new Map<string, TimetableEntry[]>()
        for (const entry of schedule) {
            const key = `${entry.start_time}_${entry.end_time}_${entry.slot_name}`
            if (!groups.has(key)) groups.set(key, [])
            groups.get(key)!.push(entry)
        }
        return Array.from(groups.entries()).map(([key, entries]) => ({
            key,
            start_time: entries[0].start_time || '',
            end_time: entries[0].end_time || '',
            slot_name: entries[0].slot_name || '',
            is_break: entries[0].is_break || false,
            entries,
        }))
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
            </div>
        )
    }

    const calendarDays = getCalendarDays()
    const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : []
    const selectedDateExams = selectedDate ? getExamsForDate(selectedDate) : []
    const isSelectedHoliday = selectedDateEvents.some(e => e.event_type === 'holiday')
    const isSelectedExam = selectedDateExams.length > 0 || selectedDateEvents.some(e => e.event_type === 'exam_period')

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
            {/* Header */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(getBackPath())}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-indigo-300" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                                <CalendarIcon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white">School Calendar</h1>
                                <p className="text-xs text-indigo-300/70">Events, Schedules & Timetables</p>
                            </div>
                        </div>
                    </div>

                    {isAdmin && (
                        <button
                            onClick={() => {
                                setNewEvent(prev => ({
                                    ...prev,
                                    event_date: selectedDate
                                        ? selectedDate.toISOString().split('T')[0]
                                        : new Date().toISOString().split('T')[0]
                                }))
                                setShowCreateModal(true)
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all flex items-center gap-2 font-medium shadow-lg shadow-indigo-500/25"
                        >
                            <Plus className="w-4 h-4" />
                            Add Event
                        </button>
                    )}
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Calendar Grid - Left Side */}
                    <div className="lg:col-span-2">
                        {/* Month Navigation */}
                        <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                            <div className="px-6 py-4 flex items-center justify-between border-b border-white/10">
                                <button
                                    onClick={() => navigateMonth(-1)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5 text-indigo-300" />
                                </button>
                                <div className="text-center">
                                    <h2 className="text-xl font-bold text-white">
                                        {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                                    </h2>
                                    <button
                                        onClick={goToToday}
                                        className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 transition-colors"
                                    >
                                        Today
                                    </button>
                                </div>
                                <button
                                    onClick={() => navigateMonth(1)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <ChevronRight className="w-5 h-5 text-indigo-300" />
                                </button>
                            </div>

                            {/* Day Headers */}
                            <div className="grid grid-cols-7 border-b border-white/10">
                                {DAYS_SHORT.map(day => (
                                    <div key={day} className="text-center py-3 text-xs font-semibold text-indigo-300/70 uppercase tracking-wider">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Days */}
                            <div className="grid grid-cols-7">
                                {calendarDays.map((day, idx) => {
                                    const dayEvents = getEventsForDate(day.date)
                                    const dayExams = getExamsForDate(day.date)
                                    const isSelected = selectedDate?.toDateString() === day.date.toDateString()
                                    const hasHoliday = dayEvents.some(e => e.event_type === 'holiday')
                                    const hasExam = dayExams.length > 0 || dayEvents.some(e => e.event_type === 'exam_period')
                                    const isSunday = day.date.getDay() === 0

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => loadDailySchedule(day.date)}
                                            className={`relative min-h-[90px] p-2 border-b border-r border-white/5 transition-all text-left group hover:bg-white/5
                                                ${!day.isCurrentMonth ? 'opacity-30' : ''}
                                                ${isSelected ? 'bg-indigo-500/20 ring-2 ring-indigo-500/50' : ''}
                                                ${day.isToday ? 'bg-white/5' : ''}
                                            `}
                                        >
                                            <span className={`text-sm font-medium inline-flex items-center justify-center w-7 h-7 rounded-full transition-all
                                                ${day.isToday ? 'bg-indigo-500 text-white' : ''}
                                                ${isSunday ? 'text-red-400' : 'text-white/80'}
                                                ${hasHoliday ? 'text-red-400' : ''}
                                            `}>
                                                {day.date.getDate()}
                                            </span>

                                            {/* Event dots */}
                                            <div className="mt-1 space-y-0.5 overflow-hidden">
                                                {dayEvents.slice(0, 2).map((event, i) => (
                                                    <div
                                                        key={i}
                                                        className="text-[10px] px-1.5 py-0.5 rounded-sm truncate font-medium"
                                                        style={{
                                                            backgroundColor: event.color + '30',
                                                            color: event.color,
                                                        }}
                                                    >
                                                        {event.title}
                                                    </div>
                                                ))}
                                                {dayExams.slice(0, 1).map((exam, i) => (
                                                    <div
                                                        key={`exam-${i}`}
                                                        className="text-[10px] px-1.5 py-0.5 rounded-sm truncate font-medium bg-purple-500/20 text-purple-400"
                                                    >
                                                        📝 {exam.name}
                                                    </div>
                                                ))}
                                                {(dayEvents.length + dayExams.length) > 3 && (
                                                    <div className="text-[9px] text-indigo-400 px-1">
                                                        +{dayEvents.length + dayExams.length - 3} more
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="mt-4 flex flex-wrap gap-4">
                            {EVENT_TYPES.map(type => (
                                <div key={type.value} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />
                                    <span className="text-xs text-white/60">{type.emoji} {type.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Daily Detail Panel - Right Side */}
                    <div className="space-y-4">
                        {selectedDate ? (
                            <>
                                {/* Selected Date Header */}
                                <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h3 className="text-lg font-bold text-white">
                                                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                            </h3>
                                            <p className="text-sm text-indigo-300/70">
                                                {isSelectedHoliday ? '🏖️ Holiday' : isSelectedExam ? '📝 Exam Day' : selectedDate.getDay() === 0 ? '☀️ Sunday' : '📚 Teaching Day'}
                                            </p>
                                        </div>
                                        {isAdmin && (
                                            <button
                                                onClick={() => {
                                                    setNewEvent(prev => ({
                                                        ...prev,
                                                        event_date: selectedDate.toISOString().split('T')[0]
                                                    }))
                                                    setShowCreateModal(true)
                                                }}
                                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                                title="Add event on this date"
                                            >
                                                <Plus className="w-5 h-5 text-indigo-400" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Events on selected date */}
                                    {selectedDateEvents.length > 0 && (
                                        <div className="space-y-2 mb-4">
                                            {selectedDateEvents.map(event => (
                                                <div
                                                    key={event.event_id}
                                                    className="flex items-center justify-between p-3 rounded-xl"
                                                    style={{ backgroundColor: event.color + '15', borderLeft: `3px solid ${event.color}` }}
                                                >
                                                    <div>
                                                        <p className="font-medium text-white text-sm">{event.title}</p>
                                                        {event.description && (
                                                            <p className="text-xs text-white/50 mt-0.5">{event.description}</p>
                                                        )}
                                                        <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">
                                                            {EVENT_TYPES.find(t => t.value === event.event_type)?.emoji} {event.event_type.replace('_', ' ')}
                                                        </p>
                                                    </div>
                                                    {isAdmin && (
                                                        <button
                                                            onClick={() => deleteEvent(event.event_id)}
                                                            className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4 text-red-400" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Exams on selected date */}
                                    {selectedDateExams.length > 0 && (
                                        <div className="space-y-2 mb-4">
                                            <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Exams</h4>
                                            {selectedDateExams.map(exam => (
                                                <div
                                                    key={exam.exam_id}
                                                    className="p-3 rounded-xl bg-purple-500/10 border-l-3 border-purple-500"
                                                    style={{ borderLeft: '3px solid #8B5CF6' }}
                                                >
                                                    <p className="font-medium text-white text-sm">{exam.name}</p>
                                                    <p className="text-xs text-purple-300/70">{exam.exam_type_name}</p>
                                                    <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${exam.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                                            exam.status === 'ongoing' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                'bg-blue-500/20 text-blue-400'
                                                        }`}>
                                                        {exam.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Daily Timetable */}
                                <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                                    <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-indigo-400" />
                                        <h4 className="font-semibold text-white text-sm">Daily Schedule</h4>
                                    </div>

                                    {dailyLoading ? (
                                        <div className="p-8 text-center">
                                            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mx-auto" />
                                        </div>
                                    ) : isSelectedHoliday ? (
                                        <div className="p-8 text-center">
                                            <Sun className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
                                            <p className="text-white/60 text-sm">Holiday — No classes today</p>
                                        </div>
                                    ) : selectedDate.getDay() === 0 ? (
                                        <div className="p-8 text-center">
                                            <Sun className="w-10 h-10 text-orange-400 mx-auto mb-2" />
                                            <p className="text-white/60 text-sm">Sunday — No classes</p>
                                        </div>
                                    ) : dailySchedule.length === 0 ? (
                                        <div className="p-8 text-center">
                                            <CalendarIcon className="w-10 h-10 text-indigo-400/30 mx-auto mb-2" />
                                            <p className="text-white/40 text-sm">No timetable entries for this day</p>
                                        </div>
                                    ) : (
                                        <div className="max-h-[500px] overflow-y-auto">
                                            {groupBySlot(dailySchedule).map(slot => (
                                                <div key={slot.key}>
                                                    {slot.is_break ? (
                                                        <div className="px-5 py-3 bg-amber-500/10 border-y border-amber-500/20 flex items-center gap-2">
                                                            <span className="text-amber-400 text-xs">☕</span>
                                                            <span className="text-amber-300 text-xs font-medium">{slot.slot_name}</span>
                                                            <span className="text-amber-300/50 text-xs ml-auto">
                                                                {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="border-b border-white/5">
                                                            <div className="px-5 py-2 bg-white/3 flex items-center justify-between">
                                                                <span className="text-indigo-300 text-xs font-semibold">
                                                                    {slot.slot_name}
                                                                </span>
                                                                <span className="text-white/30 text-xs">
                                                                    {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                                                                </span>
                                                            </div>
                                                            <div className="px-5 py-2 space-y-1.5">
                                                                {slot.entries.map(entry => (
                                                                    <div key={entry.entry_id} className="flex items-center justify-between py-1.5">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                                                            <span className="text-white text-xs font-medium">
                                                                                {entry.class_name} {entry.section_name && `(${entry.section_name})`}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <p className="text-indigo-300/70 text-xs">{entry.subject_name}</p>
                                                                            <p className="text-white/40 text-[10px]">
                                                                                {entry.is_substitute && <span className="text-[8px] uppercase font-bold text-indigo-700 bg-indigo-100 px-1 py-0.5 rounded shadow-sm mr-1">SUB</span>}
                                                                                {entry.teacher_name}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-8 text-center">
                                <CalendarIcon className="w-12 h-12 text-indigo-400/30 mx-auto mb-3" />
                                <p className="text-white/50 font-medium">Select a date</p>
                                <p className="text-white/30 text-sm mt-1">Click any date to view events and timetable</p>
                            </div>
                        )}

                        {/* Upcoming Events Summary */}
                        <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                            <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-400" />
                                <h4 className="font-semibold text-white text-sm">Upcoming Events</h4>
                            </div>
                            <div className="p-4 space-y-2 max-h-[250px] overflow-y-auto">
                                {events
                                    .filter(e => new Date(e.event_date) >= new Date(new Date().toDateString()))
                                    .slice(0, 5)
                                    .map(event => (
                                        <div
                                            key={event.event_id}
                                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                                            onClick={() => loadDailySchedule(new Date(event.event_date + 'T00:00:00'))}
                                        >
                                            <div
                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs flex-shrink-0"
                                                style={{ backgroundColor: event.color + '20', color: event.color }}
                                            >
                                                {new Date(event.event_date + 'T00:00:00').getDate()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-white text-xs font-medium truncate">{event.title}</p>
                                                <p className="text-white/40 text-[10px]">
                                                    {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                }
                                {events.filter(e => new Date(e.event_date) >= new Date(new Date().toDateString())).length === 0 && (
                                    <p className="text-white/30 text-xs text-center py-4">No upcoming events</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Create Event Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
                        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white">Create Event</h3>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-white/50" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-indigo-300 mb-1.5">Event Title *</label>
                                <input
                                    type="text"
                                    value={newEvent.title}
                                    onChange={e => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    placeholder="e.g., Republic Day, Final Exams Start"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-indigo-300 mb-1.5">Description</label>
                                <textarea
                                    value={newEvent.description}
                                    onChange={e => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                                    rows={3}
                                    placeholder="Optional details about the event..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-indigo-300 mb-1.5">Event Type *</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {EVENT_TYPES.map(type => (
                                        <button
                                            key={type.value}
                                            onClick={() => setNewEvent(prev => ({ ...prev, event_type: type.value, color: type.color }))}
                                            className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all flex items-center gap-2
                                                ${newEvent.event_type === type.value
                                                    ? 'border-indigo-500 bg-indigo-500/20 text-white'
                                                    : 'border-white/10 text-white/60 hover:border-white/20 hover:text-white'}
                                            `}
                                        >
                                            <span>{type.emoji}</span>
                                            {type.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-indigo-300 mb-1.5">Start Date *</label>
                                    <input
                                        type="date"
                                        value={newEvent.event_date}
                                        onChange={e => setNewEvent(prev => ({ ...prev, event_date: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 [color-scheme:dark]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-indigo-300 mb-1.5">End Date</label>
                                    <input
                                        type="date"
                                        value={newEvent.end_date}
                                        onChange={e => setNewEvent(prev => ({ ...prev, end_date: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 [color-scheme:dark]"
                                    />
                                    <p className="text-[10px] text-white/30 mt-1">For multi-day events</p>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 text-white/60 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createEvent}
                                disabled={creating || !newEvent.title || !newEvent.event_date}
                                className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all font-medium disabled:opacity-50 flex items-center gap-2"
                            >
                                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Create Event
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

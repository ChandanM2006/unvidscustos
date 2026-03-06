'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Clock, Users, BookOpen, CheckCircle, AlertCircle,
    Radio, RefreshCw, ChevronRight, Loader2, Play, Pause, Timer,
    Check, Target
} from 'lucide-react'

interface LiveClass {
    entry_id: string
    class_name: string
    section_name: string
    subject_name: string
    teacher_name: string
    room_number?: string
    start_time: string
    end_time: string
    status: 'upcoming' | 'in_progress' | 'completed'
    students_present?: number
    total_students?: number
}

interface LiveSessionData {
    session_id: string
    entry_id: string
    teacher_name: string
    class_name: string
    section_name: string
    subject_name: string
    status: string
    started_at: string | null
    ended_at: string | null
    duration_minutes: number | null
    scheduled_topics: any[]
    covered_topics: any[]
    teacher_notes: string | null
    slot_start_time: string
    slot_end_time: string
}

interface TimeSlot {
    slot_id: string
    slot_number: number
    slot_name: string
    start_time: string
    end_time: string
    is_break: boolean
}

export default function LiveClassesPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [liveClasses, setLiveClasses] = useState<LiveClass[]>([])
    const [liveSessions, setLiveSessions] = useState<LiveSessionData[]>([])
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
    const [currentSlot, setCurrentSlot] = useState<TimeSlot | null>(null)
    const [stats, setStats] = useState({
        totalClasses: 0,
        inProgress: 0,
        completed: 0,
        upcoming: 0,
        teacherSessionsLive: 0,
        teacherSessionsDone: 0
    })

    // Update current time every minute
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date())
        }, 60000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        updateCurrentSlot()
        updateClassStatuses()
    }, [currentTime, timeSlots, liveSessions])

    async function loadData() {
        try {
            // Get current user's school_id
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const { data: userData } = await supabase
                .from('users')
                .select('school_id')
                .eq('email', session.user.email)
                .single()

            const schoolId = userData?.school_id

            // Get today's day of week (0=Sun, 1=Mon, etc.)
            const today = new Date().getDay()

            // Load time slots for this school
            let slotsQuery = supabase
                .from('timetable_slots')
                .select('*')
                .order('slot_number')

            if (schoolId) slotsQuery = slotsQuery.eq('school_id', schoolId)

            const { data: slots, error: slotsError } = await slotsQuery

            if (!slotsError && slots) setTimeSlots(slots)

            // Load today's timetable entries with related data
            let entriesQuery = supabase
                .from('timetable_entries')
                .select(`
                    *,
                    classes (name),
                    sections (name),
                    users:teacher_id (full_name),
                    timetable_slots (*)
                `)
                .eq('day_of_week', today)

            const { data: entries, error } = await entriesQuery

            if (error) {
                // Table may not exist yet or schema cache issue — silently fall back to empty
                if (error.code === '42P01' || error.message?.includes('does not exist') || error.code === 'PGRST204' || error.message?.includes('Could not find a relationship')) {
                    setLiveClasses([])
                    updateStats([], [])
                    return
                }
                console.error('Error loading timetable:', error.message || error.code || JSON.stringify(error))
                return
            }

            // Filter by school_id if available (entries are linked via classes which have school_id)
            let filteredEntries = entries || []
            if (schoolId && filteredEntries.length > 0) {
                // Get class IDs for this school
                const { data: schoolClasses } = await supabase
                    .from('classes')
                    .select('class_id')
                    .eq('school_id', schoolId)
                const classIds = new Set(schoolClasses?.map(c => c.class_id) || [])
                filteredEntries = filteredEntries.filter((e: any) => classIds.has(e.class_id))
            }

            // Look up subject names separately (avoids PostgREST schema cache issues)
            const subjectIds = [...new Set(filteredEntries.map((e: any) => e.subject_id).filter(Boolean))]
            let subjectMap: Record<string, string> = {}
            if (subjectIds.length > 0) {
                const { data: subjectsData } = await supabase
                    .from('subjects')
                    .select('subject_id, name')
                    .in('subject_id', subjectIds)
                subjectsData?.forEach((s: any) => { subjectMap[s.subject_id] = s.name })
            }

            // Format data
            const formatted: LiveClass[] = filteredEntries.map((entry: any) => ({
                entry_id: entry.entry_id,
                class_name: entry.classes?.name || 'Unknown',
                section_name: entry.sections?.name || '',
                subject_name: subjectMap[entry.subject_id] || 'Unknown',
                teacher_name: entry.users?.full_name || 'Not Assigned',
                room_number: entry.room_number,
                start_time: entry.timetable_slots?.start_time || '',
                end_time: entry.timetable_slots?.end_time || '',
                status: 'upcoming' as const
            }))

            setLiveClasses(formatted)

            // Load teacher live sessions FIRST, then compute stats
            const sessions = await loadLiveSessions()
            updateStats(formatted, sessions)

        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadLiveSessions(): Promise<LiveSessionData[]> {
        try {
            const res = await fetch('/api/admin/live-sessions')
            if (res.ok) {
                const data = await res.json()
                const sessions = data.sessions || []
                setLiveSessions(sessions)
                return sessions
            }
        } catch (err) {
            console.error('Error loading live sessions:', err)
        }
        return []
    }

    function updateCurrentSlot() {
        const now = currentTime
        const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

        const slot = timeSlots.find(s => {
            return currentTimeStr >= s.start_time.slice(0, 5) && currentTimeStr < s.end_time.slice(0, 5)
        })

        setCurrentSlot(slot || null)
    }

    function updateClassStatuses() {
        if (liveClasses.length === 0) return

        const now = currentTime
        const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

        const updated = liveClasses.map(cls => {
            // First check if there's a live session for this entry
            const session = liveSessions.find(s => s.entry_id === cls.entry_id)

            if (session?.status === 'completed') {
                return { ...cls, status: 'completed' as const }
            }
            if (session?.status === 'in_progress') {
                return { ...cls, status: 'in_progress' as const }
            }

            // Fallback: time-based status
            let status: 'upcoming' | 'in_progress' | 'completed' = 'upcoming'

            if (currentTimeStr >= cls.start_time.slice(0, 5) && currentTimeStr < cls.end_time.slice(0, 5)) {
                status = 'in_progress'
            } else if (currentTimeStr >= cls.end_time.slice(0, 5)) {
                status = 'completed'
            }

            return { ...cls, status }
        })

        setLiveClasses(updated)
        updateStats(updated, liveSessions)
    }

    function updateStats(classes: LiveClass[], sessions?: LiveSessionData[]) {
        const sessionList = sessions || liveSessions
        const liveCount = sessionList.filter(s => s.status === 'in_progress').length
        const doneCount = sessionList.filter(s => s.status === 'completed').length
        setStats({
            totalClasses: classes.length,
            inProgress: classes.filter(c => c.status === 'in_progress').length,
            completed: classes.filter(c => c.status === 'completed').length,
            upcoming: classes.filter(c => c.status === 'upcoming').length,
            teacherSessionsLive: liveCount,
            teacherSessionsDone: doneCount
        })
    }

    function getSessionForEntry(entryId: string): LiveSessionData | undefined {
        return liveSessions.find(s => s.entry_id === entryId)
    }

    function getSessionElapsed(session: LiveSessionData): string {
        if (!session.started_at) return ''
        if (session.status === 'completed' && session.duration_minutes) {
            return `${session.duration_minutes} min`
        }
        const start = new Date(session.started_at).getTime()
        const elapsed = Math.floor((Date.now() - start) / 60000)
        return `${elapsed} min`
    }

    function formatTime(time: string) {
        if (!time) return ''
        const [hours, minutes] = time.split(':')
        const h = parseInt(hours)
        const ampm = h >= 12 ? 'PM' : 'AM'
        const hour = h % 12 || 12
        return `${hour}:${minutes} ${ampm}`
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'in_progress':
                return (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center gap-1">
                        <Radio className="w-3 h-3 animate-pulse" />
                        LIVE
                    </span>
                )
            case 'completed':
                return (
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Done
                    </span>
                )
            default:
                return (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center gap-1">
                        <Timer className="w-3 h-3" />
                        Upcoming
                    </span>
                )
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
                    <p className="text-purple-200">Loading live data...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
            {/* Header */}
            <header className="border-b border-white/10 backdrop-blur-lg bg-black/20 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-lg">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Radio className="w-6 h-6 text-red-400 animate-pulse" />
                                Live Classes
                            </h1>
                            <p className="text-purple-300 text-sm">Real-time school monitoring</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-2xl font-mono font-bold">
                                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-purple-300 text-sm">
                                {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </p>
                        </div>
                        <button
                            onClick={loadData}
                            className="p-2 hover:bg-white/10 rounded-lg"
                            title="Refresh"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6">
                {/* Current Period Banner */}
                {currentSlot && !currentSlot.is_break && (
                    <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-6 mb-8 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                                <Play className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-green-100 text-sm uppercase tracking-wider">Currently</p>
                                <h2 className="text-3xl font-bold">{currentSlot.slot_name}</h2>
                                <p className="text-green-100">
                                    {formatTime(currentSlot.start_time)} - {formatTime(currentSlot.end_time)}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-5xl font-bold">{stats.inProgress}</p>
                            <p className="text-green-100">Classes in Progress</p>
                        </div>
                    </div>
                )}

                {currentSlot?.is_break && (
                    <div className="bg-gradient-to-r from-orange-600 to-amber-600 rounded-2xl p-6 mb-8 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                                <Pause className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-orange-100 text-sm uppercase tracking-wider">Currently</p>
                                <h2 className="text-3xl font-bold">{currentSlot.slot_name}</h2>
                                <p className="text-orange-100">
                                    {formatTime(currentSlot.start_time)} - {formatTime(currentSlot.end_time)}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/10">
                        <p className="text-purple-300 text-sm">Total Today</p>
                        <p className="text-3xl font-bold">{stats.totalClasses}</p>
                    </div>
                    <div className="bg-green-500/20 backdrop-blur-lg rounded-xl p-4 border border-green-500/30">
                        <p className="text-green-300 text-sm">In Progress</p>
                        <p className="text-3xl font-bold text-green-400">{stats.inProgress}</p>
                    </div>
                    <div className="bg-gray-500/20 backdrop-blur-lg rounded-xl p-4 border border-gray-500/30">
                        <p className="text-gray-300 text-sm">Completed</p>
                        <p className="text-3xl font-bold text-gray-400">{stats.completed}</p>
                    </div>
                    <div className="bg-blue-500/20 backdrop-blur-lg rounded-xl p-4 border border-blue-500/30">
                        <p className="text-blue-300 text-sm">Upcoming</p>
                        <p className="text-3xl font-bold text-blue-400">{stats.upcoming}</p>
                    </div>
                </div>

                {/* Teacher Sessions Summary */}
                {liveSessions.length > 0 && (
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-green-500/10 backdrop-blur-lg rounded-xl p-4 border border-green-500/20">
                            <div className="flex items-center gap-2 mb-1">
                                <Radio className="w-4 h-4 text-green-400 animate-pulse" />
                                <p className="text-green-300 text-sm font-medium">Teacher Sessions LIVE</p>
                            </div>
                            <p className="text-3xl font-bold text-green-400">{stats.teacherSessionsLive}</p>
                            <p className="text-xs text-gray-500 mt-1">Teachers who clicked "Start Class"</p>
                        </div>
                        <div className="bg-purple-500/10 backdrop-blur-lg rounded-xl p-4 border border-purple-500/20">
                            <div className="flex items-center gap-2 mb-1">
                                <Target className="w-4 h-4 text-purple-400" />
                                <p className="text-purple-300 text-sm font-medium">Sessions Completed</p>
                            </div>
                            <p className="text-3xl font-bold text-purple-400">{stats.teacherSessionsDone}</p>
                            <p className="text-xs text-gray-500 mt-1">With topic coverage reports</p>
                        </div>
                    </div>
                )}

                {/* Live Classes Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {liveClasses
                        .sort((a, b) => {
                            // Sort: in_progress first, then upcoming, then completed
                            const order = { in_progress: 0, upcoming: 1, completed: 2 }
                            return order[a.status] - order[b.status]
                        })
                        .map(cls => {
                            const session = getSessionForEntry(cls.entry_id)
                            const hasActiveSession = session?.status === 'in_progress'
                            const hasCompletedSession = session?.status === 'completed'

                            return (
                                <div
                                    key={cls.entry_id}
                                    className={`rounded-xl p-5 border transition-all ${hasActiveSession
                                        ? 'bg-green-500/10 border-green-500/30 ring-2 ring-green-500/20'
                                        : cls.status === 'in_progress'
                                            ? 'bg-green-500/10 border-green-500/30 ring-1 ring-green-500/20'
                                            : cls.status === 'completed'
                                                ? 'bg-white/5 border-white/10 opacity-60'
                                                : 'bg-white/10 border-white/10'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="font-bold text-lg">
                                                {cls.class_name} {cls.section_name}
                                            </h3>
                                            <p className="text-purple-300">{cls.subject_name}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            {getStatusBadge(cls.status)}
                                            {hasActiveSession && (
                                                <span className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full text-[10px] font-bold">
                                                    Teacher LIVE
                                                </span>
                                            )}
                                            {hasCompletedSession && (
                                                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full text-[10px] font-bold">
                                                    Session Done
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center gap-2 text-gray-300">
                                            <Users className="w-4 h-4" />
                                            <span>{cls.teacher_name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-300">
                                            <Clock className="w-4 h-4" />
                                            <span>{formatTime(cls.start_time)} - {formatTime(cls.end_time)}</span>
                                        </div>
                                        {cls.room_number && (
                                            <div className="flex items-center gap-2 text-gray-300">
                                                <BookOpen className="w-4 h-4" />
                                                <span>Room {cls.room_number}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Teacher Session Details */}
                                    {session && (
                                        <div className="mt-4 pt-3 border-t border-white/10">
                                            {/* Session Timing */}
                                            <div className="flex items-center justify-between text-sm mb-3">
                                                <span className={hasActiveSession ? 'text-green-300' : 'text-gray-400'}>
                                                    {hasActiveSession ? 'Session Active' : 'Session Ended'}
                                                </span>
                                                <span className={`font-mono font-bold ${hasActiveSession ? 'text-green-400' : 'text-gray-400'}`}>
                                                    {getSessionElapsed(session)}
                                                </span>
                                            </div>

                                            {/* Scheduled Topics */}
                                            {(session.scheduled_topics || []).length > 0 && (
                                                <div className="mb-2">
                                                    <p className="text-[10px] text-gray-500 mb-1 font-medium uppercase">Topics</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {(session.scheduled_topics || []).map((topic: any, i: number) => {
                                                            const isCovered = (session.covered_topics || []).some(
                                                                (ct: any) => ct.topic_id === topic.topic_id
                                                            )
                                                            return (
                                                                <span
                                                                    key={topic.topic_id || i}
                                                                    className={`px-2 py-0.5 text-[10px] rounded-md border flex items-center gap-0.5 ${isCovered
                                                                        ? 'bg-green-500/15 border-green-500/30 text-green-300'
                                                                        : hasCompletedSession
                                                                            ? 'bg-red-500/10 border-red-500/20 text-red-300 line-through'
                                                                            : 'bg-white/5 border-white/10 text-gray-400'
                                                                        }`}
                                                                >
                                                                    {isCovered && <Check className="w-2.5 h-2.5" />}
                                                                    {topic.topic_title}
                                                                </span>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Coverage Summary */}
                                            {hasCompletedSession && (
                                                <div className="text-xs text-gray-500 mt-2">
                                                    <Check className="w-3 h-3 inline mr-1 text-green-400" />
                                                    {(session.covered_topics || []).length}/{(session.scheduled_topics || []).length} topics covered
                                                    {session.teacher_notes && (
                                                        <p className="mt-1 italic text-gray-600">Note: "{session.teacher_notes}"</p>
                                                    )}
                                                </div>
                                            )}

                                            {hasActiveSession && (
                                                <div className="flex items-center gap-1 text-green-400 text-sm mt-1">
                                                    <Radio className="w-3 h-3 animate-pulse" />
                                                    <span>Teacher is live</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Fallback for non-session classes */}
                                    {!session && cls.status === 'in_progress' && (
                                        <div className="mt-4 pt-3 border-t border-white/10">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-amber-300">No session started</span>
                                                <span className="text-xs text-gray-500">Teacher hasn't clicked Start</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                </div>

                {liveClasses.length === 0 && (
                    <div className="text-center py-12">
                        <AlertCircle className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                        <h3 className="text-xl font-bold mb-2">No Classes Today</h3>
                        <p className="text-purple-300">
                            Either it's a holiday or the timetable hasn't been configured yet.
                        </p>
                        <button
                            onClick={() => router.push('/dashboard/manage/timetable')}
                            className="mt-4 px-6 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
                        >
                            Configure Timetable
                        </button>
                    </div>
                )}
            </main>
        </div>
    )
}

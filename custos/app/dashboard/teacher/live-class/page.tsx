'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Radio, Play, Square, Clock, BookOpen, CheckCircle,
    Loader2, AlertCircle, ChevronRight, Timer, Users, Sparkles,
    XCircle, Check, Circle, AlertTriangle, RotateCcw, Edit3, Save
} from 'lucide-react'

// ── Interfaces ──
interface ScheduledClass {
    entry_id: string
    class_id: string
    class_name: string
    section_id: string
    section_name: string
    subject_id: string
    subject_name: string
    slot_id: string
    slot_number: number
    start_time: string
    end_time: string
    room_number?: string
    is_substitute?: boolean
    // Lesson plan info
    plan_id?: string
    topics: TopicItem[]
    pending_topics: TopicItem[] // carried from previous class
}

interface TopicItem {
    topic_id: string
    topic_title: string
    type: string // 'teaching' | 'revision' | 'assessment' | 'pending'
    from_date?: string // for pending topics
}

interface LiveSession {
    session_id: string
    entry_id: string
    class_id: string
    subject_id: string
    status: 'not_started' | 'in_progress' | 'completed' | 'cancelled'
    scheduled_topics: TopicItem[]
    pending_topics: TopicItem[]
    covered_topics: TopicItem[]
    uncovered_topics: TopicItem[]
    started_at: string | null
    ended_at: string | null
    duration_minutes: number | null
    late_minutes?: number | null
    teacher_notes: string | null
}

export default function TeacherLiveClassPage() {
    const { goBack, router } = useSmartBack('/dashboard/teacher')
    const [loading, setLoading] = useState(true)
    const [teacher, setTeacher] = useState<any>(null)
    const [todayClasses, setTodayClasses] = useState<ScheduledClass[]>([])
    const [sessions, setSessions] = useState<LiveSession[]>([])
    const [currentTime, setCurrentTime] = useState(new Date())

    // Session flow states
    const [selectedClass, setSelectedClass] = useState<ScheduledClass | null>(null)
    const [activeSession, setActiveSession] = useState<LiveSession | null>(null)
    const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set())
    const [teacherNote, setTeacherNote] = useState('')
    const [actionLoading, setActionLoading] = useState(false)
    const [showEndFlow, setShowEndFlow] = useState(false)
    const [elapsedTime, setElapsedTime] = useState(0)

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    // Elapsed time counter for active session
    useEffect(() => {
        if (!activeSession?.started_at) return
        const interval = setInterval(() => {
            const start = new Date(activeSession.started_at!).getTime()
            const now = Date.now()
            setElapsedTime(Math.floor((now - start) / 1000))
        }, 1000)
        return () => clearInterval(interval)
    }, [activeSession?.started_at])

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return }

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
            await Promise.all([
                loadTodayClasses(userData.user_id),
                loadSessions(userData.user_id)
            ])
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadTodayClasses(teacherId: string) {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const todayStr = today.toISOString().split('T')[0]

        // Get timetable entries for today
        const { data: entries } = await supabase
            .from('timetable_entries')
            .select('entry_id, class_id, section_id, subject_id, slot_id, room_number, notes, teacher_id')
            .or(`teacher_id.eq.${teacherId},notes.ilike.%${teacherId}%`)
            .eq('day_of_week', dayOfWeek)

        if (!entries || entries.length === 0) {
            setTodayClasses([])
            return
        }

        let allEntries = entries || []
        allEntries = allEntries.filter(e => {
            let subId = null;
            if (e.notes) {
                try { const n = JSON.parse(e.notes); if (n.type === 'substitution') subId = n.substitute_teacher_id; } catch(err){}
            }
            if (subId) {
                if (subId === teacherId) {
                    (e as any).is_substitute = true;
                    return true;
                }
                return false; // I am primary but someone else is substituting
            }
            return e.teacher_id === teacherId;
        });

        // ── DEDUPLICATION: Remove duplicates (same class + section + slot) ──
        // Keep only the first entry for each unique combination
        const seen = new Set<string>()
        const uniqueEntries = allEntries.filter(e => {
            const key = `${e.class_id}_${e.section_id || 'none'}_${e.slot_id || 'none'}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })

        // Lookup data
        const classIds = [...new Set(uniqueEntries.map(e => e.class_id))]
        const sectionIds = [...new Set(uniqueEntries.map(e => e.section_id).filter(Boolean))]
        const subjectIds = [...new Set(uniqueEntries.map(e => e.subject_id))]
        const slotIds = [...new Set(uniqueEntries.map(e => e.slot_id).filter(Boolean))]

        const [classesRes, sectionsRes, subjectsRes, slotsRes] = await Promise.all([
            supabase.from('classes').select('class_id, name').in('class_id', classIds),
            sectionIds.length > 0
                ? supabase.from('sections').select('section_id, name').in('section_id', sectionIds)
                : { data: [] },
            supabase.from('subjects').select('subject_id, name').in('subject_id', subjectIds),
            slotIds.length > 0
                ? supabase.from('timetable_slots').select('slot_id, slot_number, start_time, end_time').in('slot_id', slotIds)
                : { data: [] },
        ])

        const classMap = new Map((classesRes.data || []).map((c: any) => [c.class_id, c.name]))
        const sectionMap = new Map((sectionsRes.data || []).map((s: any) => [s.section_id, s.name]))
        const subjectMap = new Map((subjectsRes.data || []).map((s: any) => [s.subject_id, s.name]))
        const slotMap = new Map((slotsRes.data || []).map((s: any) => [s.slot_id, {
            slot_number: s.slot_number,
            start_time: s.start_time,
            end_time: s.end_time
        }]))

        // Get lesson plan topics for today
        const { data: plans } = await supabase
            .from('lesson_plans')
            .select('plan_id, class_id, start_date, ai_schedule')
            .eq('teacher_id', teacherId)
            .in('status', ['draft', 'published', 'in_progress'])

        function addDays(dateStr: string, n: number): string {
            const d = new Date(dateStr + 'T12:00:00')
            d.setDate(d.getDate() + n)
            return d.toISOString().split('T')[0]
        }

        // Build topic lookup: date_classId -> { plan_id, topics[], pendingTopics[] }
        const topicLookup = new Map<string, { plan_id: string; topics: TopicItem[]; pendingTopics: TopicItem[] }>()

        for (const plan of (plans || [])) {
            const schedule = plan.ai_schedule?.schedule || plan.ai_schedule || []
            if (!Array.isArray(schedule) || schedule.length === 0) continue

            for (const dayItem of schedule) {
                const dayNum = dayItem.day || dayItem.day_number
                if (!dayNum || !plan.start_date) continue

                const lessonDate = addDays(plan.start_date, dayNum - 1)
                if (lessonDate !== todayStr) continue

                const key = `${lessonDate}_${plan.class_id}`
                const existing = topicLookup.get(key) || { plan_id: plan.plan_id, topics: [] as TopicItem[], pendingTopics: [] as TopicItem[] }

                // Extract topics from the day's content
                const topicTitle = dayItem.topic_title || dayItem.title || 'Lesson scheduled'
                const topicId = dayItem.topic_id || `${plan.plan_id}_day${dayNum}`
                existing.topics.push({
                    topic_id: topicId,
                    topic_title: topicTitle,
                    type: dayItem.type || 'teaching'
                })

                // Add sub-topics if available
                if (dayItem.activities && Array.isArray(dayItem.activities)) {
                    for (const act of dayItem.activities) {
                        if (typeof act === 'string' && act.trim()) {
                            existing.topics.push({
                                topic_id: `${topicId}_act_${existing.topics.length}`,
                                topic_title: act,
                                type: 'activity'
                            })
                        }
                    }
                }

                // ── Check for pending topics from previous class ──
                if (dayItem.pending_from_previous && Array.isArray(dayItem.pending_from_previous)) {
                    for (const pendingTitle of dayItem.pending_from_previous) {
                        existing.pendingTopics.push({
                            topic_id: `pending_${plan.plan_id}_${existing.pendingTopics.length}`,
                            topic_title: pendingTitle,
                            type: 'pending',
                            from_date: 'previous class'
                        })
                    }
                }

                topicLookup.set(key, existing)
            }
        }

        // ── Also check for uncovered topics from previous sessions (today or recent) ──
        // Look for completed sessions from earlier today for this teacher+class combo
        const { data: recentSessions } = await supabase
            .from('live_class_sessions')
            .select('class_id, uncovered_topics, session_date, entry_id')
            .eq('teacher_id', teacherId)
            .eq('status', 'completed')
            .gte('session_date', addDays(todayStr, -7))
            .order('session_date', { ascending: false })

        // Build a map: class_id -> uncovered topics from most recent completed session
        const uncoveredByClass = new Map<string, TopicItem[]>()
        for (const sess of (recentSessions || [])) {
            if (!sess.uncovered_topics || sess.uncovered_topics.length === 0) continue
            if (uncoveredByClass.has(sess.class_id)) continue // only take most recent
            uncoveredByClass.set(sess.class_id, sess.uncovered_topics.map((t: any) => ({
                ...t,
                type: 'pending',
                from_date: sess.session_date
            })))
        }

        // Build final class list
        const classes: ScheduledClass[] = uniqueEntries
            .map(e => {
                const slot = slotMap.get(e.slot_id) || { slot_number: 0, start_time: '', end_time: '' }
                const key = `${todayStr}_${e.class_id}`
                const planInfo = topicLookup.get(key)

                // Combine pending from schedule + pending from previous sessions
                const schedulePending = planInfo?.pendingTopics || []
                const sessionPending = uncoveredByClass.get(e.class_id) || []
                // Deduplicate pending topics by title
                const allPending: TopicItem[] = []
                const seenTitles = new Set<string>()
                for (const t of [...schedulePending, ...sessionPending]) {
                    if (!seenTitles.has(t.topic_title)) {
                        seenTitles.add(t.topic_title)
                        allPending.push(t)
                    }
                }

                return {
                    entry_id: e.entry_id,
                    class_id: e.class_id,
                    class_name: classMap.get(e.class_id) || 'Unknown',
                    section_id: e.section_id,
                    section_name: sectionMap.get(e.section_id) || '',
                    subject_id: e.subject_id,
                    subject_name: subjectMap.get(e.subject_id) || 'Unknown',
                    slot_id: e.slot_id,
                    slot_number: slot.slot_number,
                    start_time: slot.start_time,
                    end_time: slot.end_time,
                    room_number: e.room_number,
                    is_substitute: (e as any).is_substitute,
                    plan_id: planInfo?.plan_id,
                    topics: planInfo?.topics || [],
                    pending_topics: allPending
                }
            })
            .sort((a, b) => a.slot_number - b.slot_number)

        setTodayClasses(classes)
    }

    async function loadSessions(teacherId: string) {
        const today = new Date().toISOString().split('T')[0]
        const { data, error } = await supabase
            .from('live_class_sessions')
            .select('*')
            .eq('teacher_id', teacherId)
            .eq('session_date', today)

        if (error) {
            // Table might not exist yet — handle gracefully
            if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
                console.warn('live_class_sessions table not found. Please run the schema SQL.', error.message)
                setSessions([])
                return
            }
            console.error('Error loading sessions:', error)
            setSessions([])
            return
        }

        setSessions(data || [])

        // Check if there's an active session
        const active = (data || []).find((s: any) => s.status === 'in_progress')
        if (active) {
            setActiveSession(active)
            const cls = todayClasses.find(c => c.entry_id === active.entry_id)
            if (cls) setSelectedClass(cls)
        }
    }

    function getSessionForEntry(entryId: string): LiveSession | undefined {
        return sessions.find(s => s.entry_id === entryId)
    }

    async function startSession(cls: ScheduledClass) {
        setActionLoading(true)
        try {
            const res = await fetch('/api/teacher/live-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teacher_id: teacher.user_id,
                    entry_id: cls.entry_id,
                    class_id: cls.class_id,
                    section_id: cls.section_id,
                    subject_id: cls.subject_id,
                    slot_id: cls.slot_id,
                    slot_start_time: cls.start_time,
                    plan_id: cls.plan_id || null,
                    scheduled_topics: cls.topics,
                    pending_topics: cls.pending_topics || []
                })
            })
            const data = await res.json()
            if (!res.ok) {
                alert(data.error || 'Failed to start session')
                return
            }
            setActiveSession(data.session)
            setSelectedClass(cls)
            setShowEndFlow(false)
            if (teacher) await loadSessions(teacher.user_id)
        } catch (error) {
            console.error('Start session error:', error)
            alert('Failed to start session')
        } finally {
            setActionLoading(false)
        }
    }

    async function endSession() {
        if (!activeSession) return
        setActionLoading(true)
        try {
            // Combine scheduled + pending into all topics
            const allTopics = [
                ...(activeSession.scheduled_topics || []),
                ...(activeSession.pending_topics || [])
            ]
            const coveredTopics = allTopics.filter(t =>
                selectedTopics.has(t.topic_id)
            )

            const res = await fetch('/api/teacher/live-session', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: activeSession.session_id,
                    action: 'end',
                    covered_topics: coveredTopics,
                    teacher_notes: teacherNote || null
                })
            })
            const data = await res.json()
            if (!res.ok) {
                alert(data.error || 'Failed to end session')
                return
            }

            // Show uncovered topics info if any
            if (data.uncovered_topics && data.uncovered_topics.length > 0) {
                const uncoveredNames = data.uncovered_topics.map((t: any) => t.topic_title).join(', ')
                alert(`Session ended! ${data.uncovered_topics.length} topic(s) not covered will be moved to next class:\n\n${uncoveredNames}\n\nYou can review the updated schedule from your lesson plans.`)
            }

            setActiveSession(null)
            setSelectedClass(null)
            setSelectedTopics(new Set())
            setTeacherNote('')
            setShowEndFlow(false)
            setElapsedTime(0)
            if (teacher) {
                await loadTodayClasses(teacher.user_id)
                await loadSessions(teacher.user_id)
            }
        } catch (error) {
            console.error('End session error:', error)
            alert('Failed to end session')
        } finally {
            setActionLoading(false)
        }
    }

    function toggleTopic(topicId: string) {
        setSelectedTopics(prev => {
            const next = new Set(prev)
            if (next.has(topicId)) next.delete(topicId)
            else next.add(topicId)
            return next
        })
    }

    function selectAllTopics() {
        if (!activeSession) return
        const allIds = [
            ...(activeSession.scheduled_topics || []).map(t => t.topic_id),
            ...(activeSession.pending_topics || []).map(t => t.topic_id)
        ]
        setSelectedTopics(new Set(allIds))
    }

    function formatTime(time: string) {
        if (!time) return ''
        const [h, m] = time.split(':')
        const hour = parseInt(h) % 12 || 12
        const ampm = parseInt(h) >= 12 ? 'PM' : 'AM'
        return `${hour}:${m} ${ampm}`
    }

    function formatElapsed(seconds: number) {
        const hrs = Math.floor(seconds / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        const secs = seconds % 60
        if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`
        if (mins > 0) return `${mins}m ${secs}s`
        return `${secs}s`
    }

    function getTimeStatus(cls: ScheduledClass) {
        const now = currentTime
        const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
        const start = cls.start_time?.slice(0, 5) || ''
        const end = cls.end_time?.slice(0, 5) || ''

        if (currentTimeStr >= start && currentTimeStr < end) return 'current'
        if (currentTimeStr >= end) return 'past'
        return 'upcoming'
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <Radio className="w-12 h-12 text-red-400 mx-auto mb-4 animate-pulse" />
                    <Loader2 className="w-8 h-8 text-purple-400 mx-auto animate-spin" />
                    <p className="text-purple-200 mt-3">Loading live class data...</p>
                </div>
            </div>
        )
    }

    // ─── Active Session View ───
    if (activeSession && selectedClass) {
        // Combine scheduled + pending for the active session view
        const allSessionTopics = [
            ...(activeSession.pending_topics || []),
            ...(activeSession.scheduled_topics || [])
        ]
        const hasPending = (activeSession.pending_topics || []).length > 0

        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
                {/* Live Header */}
                <header className="border-b border-white/10 backdrop-blur-lg bg-black/20 sticky top-0 z-10">
                    <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-red-400 text-sm font-bold uppercase tracking-wider">Live</span>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">
                                    {selectedClass.is_substitute && <span className="text-[10px] uppercase font-bold text-white bg-purple-500/50 px-1 py-0.5 rounded shadow-sm mr-2 align-middle">SUB</span>}
                                    {selectedClass.subject_name}
                                </h1>
                                <p className="text-sm text-purple-300">
                                    {selectedClass.class_name} {selectedClass.section_name} •
                                    {formatTime(selectedClass.start_time)} - {formatTime(selectedClass.end_time)}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-mono font-bold text-green-400">
                                {formatElapsed(elapsedTime)}
                            </p>
                            <p className="text-xs text-gray-400">Session Duration</p>
                        </div>
                    </div>
                </header>

                <main className="max-w-4xl mx-auto p-6 space-y-6">
                    {/* Session Info Card */}
                    <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 rounded-2xl p-6 border border-green-500/30">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                                    <Radio className="w-6 h-6 text-green-400 animate-pulse" />
                                </div>
                                <div>
                                    <p className="font-bold text-lg">Session In Progress</p>
                                    <p className="text-sm text-green-300/70">
                                        Started at {activeSession.started_at ? new Date(activeSession.started_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {activeSession.late_minutes && activeSession.late_minutes > 0 ? (
                                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 ${activeSession.late_minutes <= 5
                                            ? 'bg-green-500/20 text-green-300'
                                            : activeSession.late_minutes <= 10
                                                ? 'bg-orange-500/20 text-orange-300'
                                                : 'bg-red-500/20 text-red-300'
                                        }`}>
                                        <AlertTriangle className="w-3 h-3" />
                                        Started late by {activeSession.late_minutes} min
                                    </span>
                                ) : null}
                                <span className="px-3 py-1.5 bg-green-500/30 text-green-300 rounded-full text-xs font-bold flex items-center gap-1">
                                    <Radio className="w-3 h-3 animate-pulse" />
                                    LIVE
                                </span>
                            </div>
                        </div>

                        {/* ── Pending Topics (from previous class) ── */}
                        {hasPending && (
                            <div className="mt-4 mb-4">
                                <h3 className="text-sm font-bold text-amber-300/80 mb-3 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    Pending Topics (from previous class)
                                </h3>
                                <div className="space-y-2">
                                    {(activeSession.pending_topics || []).map((topic, idx) => (
                                        <div key={topic.topic_id} className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                                            <span className="w-6 h-6 bg-amber-500/20 rounded-full flex items-center justify-center text-xs font-bold text-amber-400">
                                                P{idx + 1}
                                            </span>
                                            <span className="flex-1 text-sm">{topic.topic_title}</span>
                                            <span className="px-2 py-0.5 text-[10px] rounded-full font-medium bg-amber-500/20 text-amber-300">
                                                pending
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Today's Scheduled Topics ── */}
                        <div className="mt-4">
                            <h3 className="text-sm font-bold text-white/80 mb-3 flex items-center gap-2">
                                <BookOpen className="w-4 h-4" />
                                Today&apos;s Topics ({activeSession.scheduled_topics.length})
                            </h3>
                            {activeSession.scheduled_topics.length > 0 ? (
                                <div className="space-y-2">
                                    {activeSession.scheduled_topics.map((topic, idx) => (
                                        <div key={topic.topic_id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                                            <span className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center text-xs font-bold text-green-400">
                                                {idx + 1}
                                            </span>
                                            <span className="flex-1 text-sm">{topic.topic_title}</span>
                                            <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${topic.type === 'activity' ? 'bg-blue-500/20 text-blue-300' :
                                                topic.type === 'revision' ? 'bg-amber-500/20 text-amber-300' :
                                                    topic.type === 'assessment' ? 'bg-red-500/20 text-red-300' :
                                                        'bg-emerald-500/20 text-emerald-300'
                                                }`}>
                                                {topic.type}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 italic">No specific topics scheduled for this period</p>
                            )}
                        </div>
                    </div>

                    {/* End Session Flow */}
                    {!showEndFlow ? (
                        <button
                            onClick={() => {
                                setShowEndFlow(true)
                                selectAllTopics()
                            }}
                            className="w-full py-4 bg-gradient-to-r from-red-600 to-rose-600 rounded-xl font-bold text-lg hover:from-red-700 hover:to-rose-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-red-500/20"
                        >
                            <Square className="w-5 h-5" />
                            End Session
                        </button>
                    ) : (
                        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                            <div className="p-5 border-b border-white/10 bg-red-500/10">
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-red-400" />
                                    Select Topics You Covered
                                </h3>
                                <p className="text-sm text-gray-400 mt-1">
                                    Check the topics you finished teaching. Unchecked topics will be moved to your next class.
                                </p>
                            </div>

                            <div className="p-5 space-y-2">
                                {(allSessionTopics.length > 0) ? (
                                    <>
                                        {/* Select All / Deselect All */}
                                        <div className="flex gap-3 mb-4">
                                            <button
                                                onClick={selectAllTopics}
                                                className="px-3 py-1.5 bg-green-500/20 text-green-300 rounded-lg text-xs font-medium hover:bg-green-500/30 transition-colors"
                                            >
                                                Select All
                                            </button>
                                            <button
                                                onClick={() => setSelectedTopics(new Set())}
                                                className="px-3 py-1.5 bg-gray-500/20 text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-500/30 transition-colors"
                                            >
                                                Deselect All
                                            </button>
                                        </div>

                                        {/* Pending Topics Section */}
                                        {hasPending && (
                                            <div className="mb-4">
                                                <p className="text-[10px] text-amber-400 font-bold mb-2 uppercase tracking-wider">
                                                    ⚠ Pending from Previous Class
                                                </p>
                                                {(activeSession.pending_topics || []).map((topic) => (
                                                    <button
                                                        key={topic.topic_id}
                                                        onClick={() => toggleTopic(topic.topic_id)}
                                                        className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all mb-1.5 ${selectedTopics.has(topic.topic_id)
                                                            ? 'bg-green-500/15 border-green-500/40 ring-1 ring-green-500/20'
                                                            : 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
                                                            }`}
                                                    >
                                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${selectedTopics.has(topic.topic_id)
                                                            ? 'bg-green-500 text-white'
                                                            : 'bg-amber-500/20 text-amber-400'
                                                            }`}>
                                                            {selectedTopics.has(topic.topic_id) ? (
                                                                <Check className="w-4 h-4" />
                                                            ) : (
                                                                <Circle className="w-4 h-4" />
                                                            )}
                                                        </div>
                                                        <span className={`flex-1 text-left text-sm ${selectedTopics.has(topic.topic_id) ? 'text-white' : 'text-amber-200'}`}>
                                                            {topic.topic_title}
                                                        </span>
                                                        <span className="px-2 py-0.5 text-[10px] rounded-full font-medium bg-amber-500/20 text-amber-300">
                                                            pending
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Today's Topics Section */}
                                        <p className="text-[10px] text-green-400 font-bold mb-2 uppercase tracking-wider">
                                            📚 Today&apos;s Topics
                                        </p>
                                        {activeSession.scheduled_topics.map((topic) => (
                                            <button
                                                key={topic.topic_id}
                                                onClick={() => toggleTopic(topic.topic_id)}
                                                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all ${selectedTopics.has(topic.topic_id)
                                                    ? 'bg-green-500/15 border-green-500/40 ring-1 ring-green-500/20'
                                                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                    }`}
                                            >
                                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${selectedTopics.has(topic.topic_id)
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-white/10 text-gray-500'
                                                    }`}>
                                                    {selectedTopics.has(topic.topic_id) ? (
                                                        <Check className="w-4 h-4" />
                                                    ) : (
                                                        <Circle className="w-4 h-4" />
                                                    )}
                                                </div>
                                                <span className={`flex-1 text-left text-sm ${selectedTopics.has(topic.topic_id) ? 'text-white' : 'text-gray-400'}`}>
                                                    {topic.topic_title}
                                                </span>
                                                <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${topic.type === 'activity' ? 'bg-blue-500/20 text-blue-300' :
                                                    'bg-emerald-500/20 text-emerald-300'
                                                    }`}>
                                                    {topic.type}
                                                </span>
                                            </button>
                                        ))}
                                    </>
                                ) : (
                                    <p className="text-sm text-gray-400 text-center py-4">No topics were scheduled — you can still end the session</p>
                                )}

                                {/* Uncovered Topics Preview */}
                                {selectedTopics.size < allSessionTopics.length && allSessionTopics.length > 0 && (
                                    <div className="mt-4 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                        <p className="text-xs text-amber-300 font-bold mb-1 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" />
                                            These topics will be moved to next class:
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                            {allSessionTopics
                                                .filter(t => !selectedTopics.has(t.topic_id))
                                                .map(t => (
                                                    <span key={t.topic_id} className="px-2 py-0.5 bg-amber-500/10 text-amber-200 text-[10px] rounded-md border border-amber-500/20">
                                                        {t.topic_title}
                                                    </span>
                                                ))
                                            }
                                        </div>
                                    </div>
                                )}

                                {/* Teacher Note */}
                                <div className="mt-4">
                                    <label className="block text-xs text-gray-400 mb-1.5 font-medium">Session Note (optional)</label>
                                    <textarea
                                        value={teacherNote}
                                        onChange={(e) => setTeacherNote(e.target.value)}
                                        placeholder="Any remarks about today's class..."
                                        className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-600 focus:ring-2 focus:ring-red-500 outline-none resize-none"
                                        rows={2}
                                    />
                                </div>

                                {/* Summary */}
                                <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/10">
                                    <p className="text-xs text-gray-400">
                                        <span className="text-green-400 font-bold">{selectedTopics.size}</span> of{' '}
                                        <span className="font-bold">{allSessionTopics.length}</span> topics covered •{' '}
                                        Duration: <span className="text-green-400 font-bold">{formatElapsed(elapsedTime)}</span>
                                        {selectedTopics.size < allSessionTopics.length && (
                                            <span className="text-amber-300 ml-2">
                                                ({allSessionTopics.length - selectedTopics.size} will carry over)
                                            </span>
                                        )}
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 mt-4">
                                    <button
                                        onClick={() => setShowEndFlow(false)}
                                        className="flex-1 py-3 bg-white/10 text-gray-300 rounded-xl font-medium hover:bg-white/15 transition-colors"
                                    >
                                        Continue Teaching
                                    </button>
                                    <button
                                        onClick={endSession}
                                        disabled={actionLoading}
                                        className="flex-1 py-3 bg-gradient-to-r from-red-600 to-rose-600 rounded-xl font-bold hover:from-red-700 hover:to-rose-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {actionLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Square className="w-4 h-4" />
                                        )}
                                        End Session
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        )
    }

    // ─── Main View: Today's Classes ───
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
            {/* Header */}
            <header className="border-b border-white/10 backdrop-blur-lg bg-black/20 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={goBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Radio className="w-6 h-6 text-red-400" />
                                Live Class
                            </h1>
                            <p className="text-sm text-purple-300">Start and manage your class sessions</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-mono font-bold">
                            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-xs text-purple-300">
                            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6 space-y-4">
                {/* Today's Stats */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/10 text-center">
                        <p className="text-purple-300 text-xs">Total Classes</p>
                        <p className="text-2xl font-bold">{todayClasses.length}</p>
                    </div>
                    <div className="bg-green-500/10 backdrop-blur-lg rounded-xl p-4 border border-green-500/20 text-center">
                        <p className="text-green-300 text-xs">Completed</p>
                        <p className="text-2xl font-bold text-green-400">
                            {sessions.filter(s => s.status === 'completed').length}
                        </p>
                    </div>
                    <div className="bg-blue-500/10 backdrop-blur-lg rounded-xl p-4 border border-blue-500/20 text-center">
                        <p className="text-blue-300 text-xs">Remaining</p>
                        <p className="text-2xl font-bold text-blue-400">
                            {todayClasses.length - sessions.filter(s => s.status === 'completed').length}
                        </p>
                    </div>
                </div>

                {/* Classes List */}
                {todayClasses.length > 0 ? (
                    <div className="space-y-3">
                        {todayClasses.map(cls => {
                            const session = getSessionForEntry(cls.entry_id)
                            const timeStatus = getTimeStatus(cls)
                            const isCompleted = session?.status === 'completed'
                            const isActive = session?.status === 'in_progress'
                            const hasPendingTopics = cls.pending_topics.length > 0

                            return (
                                <div
                                    key={cls.entry_id}
                                    className={`rounded-xl border transition-all overflow-hidden ${isActive
                                        ? 'bg-green-500/10 border-green-500/30 ring-2 ring-green-500/20'
                                        : isCompleted
                                            ? 'bg-white/5 border-white/10 opacity-70'
                                            : timeStatus === 'current'
                                                ? 'bg-purple-500/10 border-purple-500/30 ring-1 ring-purple-500/20'
                                                : 'bg-white/5 border-white/10'
                                        }`}
                                >
                                    <div className="p-5">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-bold text-lg">
                                                        {cls.is_substitute && <span className="text-[10px] uppercase font-bold text-white bg-purple-500/50 px-1 py-0.5 rounded shadow-sm mr-2 align-middle">SUB</span>}
                                                        {cls.subject_name}
                                                    </h3>
                                                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full font-medium">
                                                        {cls.class_name} {cls.section_name}
                                                    </span>
                                                    {hasPendingTopics && !isCompleted && (
                                                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] rounded-full font-bold">
                                                            ⚠ {cls.pending_topics.length} pending
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-sm text-gray-400">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                                                    </span>
                                                    {cls.room_number && (
                                                        <span>Room {cls.room_number}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Status Badge */}
                                            {isActive && (
                                                <span className="px-3 py-1.5 bg-green-500/30 text-green-300 rounded-full text-xs font-bold flex items-center gap-1">
                                                    <Radio className="w-3 h-3 animate-pulse" />
                                                    LIVE
                                                </span>
                                            )}
                                            {isCompleted && (
                                                <div className="flex items-center gap-2">
                                                    {session?.late_minutes && session.late_minutes > 0 ? (
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${session.late_minutes <= 5
                                                                ? 'bg-green-500/20 text-green-300'
                                                                : session.late_minutes <= 10
                                                                    ? 'bg-orange-500/20 text-orange-300'
                                                                    : 'bg-red-500/20 text-red-300'
                                                            }`}>
                                                            <AlertTriangle className="w-2 h-2" />
                                                            Late: {session.late_minutes}m
                                                        </span>
                                                    ) : null}
                                                    <span className="px-3 py-1.5 bg-gray-500/20 text-gray-400 rounded-full text-xs font-bold flex items-center gap-1">
                                                        <CheckCircle className="w-3 h-3" />
                                                        Done
                                                    </span>
                                                </div>
                                            )}
                                            {!isActive && !isCompleted && timeStatus === 'current' && (
                                                <span className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full text-xs font-bold flex items-center gap-1">
                                                    <Timer className="w-3 h-3" />
                                                    Current
                                                </span>
                                            )}
                                        </div>

                                        {/* ── Pending Topics (from previous class) ── */}
                                        {hasPendingTopics && !isCompleted && (
                                            <div className="mb-3">
                                                <p className="text-[10px] text-amber-400 mb-1.5 font-bold uppercase tracking-wider flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Pending from previous class
                                                </p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {cls.pending_topics.map(topic => (
                                                        <span
                                                            key={topic.topic_id}
                                                            className="px-2.5 py-1 text-xs rounded-lg border bg-amber-500/10 border-amber-500/20 text-amber-300 flex items-center gap-1"
                                                        >
                                                            <RotateCcw className="w-3 h-3" />
                                                            {topic.topic_title}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* ── Today's Scheduled Topics ── */}
                                        {cls.topics.length > 0 && (
                                            <div className="mb-4">
                                                <p className="text-xs text-gray-500 mb-2 font-medium">
                                                    {hasPendingTopics ? "TODAY'S TOPICS" : 'SCHEDULED TOPICS'}
                                                </p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {cls.topics.slice(0, 5).map(topic => {
                                                        const isCovered = isCompleted && session?.covered_topics?.some(
                                                            (ct: any) => ct.topic_id === topic.topic_id
                                                        )
                                                        return (
                                                            <span
                                                                key={topic.topic_id}
                                                                className={`px-2.5 py-1 text-xs rounded-lg border flex items-center gap-1 ${isCovered
                                                                    ? 'bg-green-500/15 border-green-500/30 text-green-300'
                                                                    : isCompleted
                                                                        ? 'bg-red-500/10 border-red-500/20 text-red-300 line-through'
                                                                        : 'bg-white/5 border-white/10 text-gray-300'
                                                                    }`}
                                                            >
                                                                {isCovered && <Check className="w-3 h-3" />}
                                                                {topic.topic_title}
                                                            </span>
                                                        )
                                                    })}
                                                    {cls.topics.length > 5 && (
                                                        <span className="px-2 py-1 text-xs text-gray-500">
                                                            +{cls.topics.length - 5} more
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Completed Session Summary */}
                                        {isCompleted && session && (
                                            <div className="p-3 bg-white/5 rounded-lg border border-white/10 mb-3">
                                                <div className="flex items-center justify-between text-xs text-gray-400">
                                                    <span>
                                                        <CheckCircle className="w-3 h-3 inline mr-1 text-green-400" />
                                                        {(session.covered_topics || []).length} of {((session.scheduled_topics || []).length + (session.pending_topics || []).length)} topics covered
                                                    </span>
                                                    <span>{session.duration_minutes || 0} min</span>
                                                </div>
                                                {session.teacher_notes && (
                                                    <p className="text-xs text-gray-500 mt-1 italic">&quot;{session.teacher_notes}&quot;</p>
                                                )}
                                                {(session.uncovered_topics || []).length > 0 && (
                                                    <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-300">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        {(session.uncovered_topics || []).length} topic(s) moved to next class
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Action Button */}
                                        {!isCompleted && !isActive && (
                                            <>
                                                {timeStatus === 'past' ? (
                                                    <div className="w-full py-3 bg-red-500/10 text-red-400 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border border-red-500/20">
                                                        <XCircle className="w-4 h-4" />
                                                        Class time has ended. Cannot start.
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => startSession(cls)}
                                                        disabled={actionLoading || sessions.some(s => s.status === 'in_progress')}
                                                        className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${sessions.some(s => s.status === 'in_progress')
                                                            ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                                                            : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-500/20'
                                                            }`}
                                                    >
                                                        {actionLoading ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Play className="w-4 h-4" />
                                                        )}
                                                        {sessions.some(s => s.status === 'in_progress')
                                                            ? 'Another session is active'
                                                            : hasPendingTopics
                                                                ? `Start Class (${cls.pending_topics.length} pending + ${cls.topics.length} new)`
                                                                : 'Start Class'
                                                        }
                                                    </button>
                                                )}
                                            </>
                                        )}

                                        {isActive && (
                                            <button
                                                onClick={() => {
                                                    setSelectedClass(cls)
                                                    setActiveSession(session!)
                                                }}
                                                className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:from-green-700 hover:to-emerald-700 transition-all"
                                            >
                                                <Radio className="w-4 h-4 animate-pulse" />
                                                View Active Session
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <AlertCircle className="w-16 h-16 text-purple-400 mx-auto mb-4 opacity-50" />
                        <h3 className="text-xl font-bold mb-2">No Classes Today</h3>
                        <p className="text-purple-300 text-sm">
                            {new Date().getDay() === 0 ? "It's Sunday — enjoy your day off!" : "No classes found in your timetable for today."}
                        </p>
                    </div>
                )}
            </main>
        </div>
    )
}

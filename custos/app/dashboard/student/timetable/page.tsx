'use client'

import { useEffect, useState } from 'react'
import { supabase, type User } from '@/lib/supabase'
import { useSmartBack } from '@/lib/navigation'
import {
    Calendar, ArrowLeft, Loader2, Clock
} from 'lucide-react'

interface TimetableEntry {
    start_time: string
    end_time: string
    subject: string
    teacher: string
    is_substitute?: boolean
    room: string
    slot_number: number
}

export default function StudentTimetablePage() {
    const { goBack, router } = useSmartBack('/dashboard/student')
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [selectedDay, setSelectedDay] = useState(new Date().getDay())
    const [schedule, setSchedule] = useState<TimetableEntry[]>([])

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    useEffect(() => {
        checkAuth()
    }, [])

    useEffect(() => {
        if (user) loadTimetable()
    }, [selectedDay, user])

    const checkAuth = async () => {
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

            if (!userData || userData.role !== 'student') {
                router.push('/login')
                return
            }

            setUser(userData)
        } catch (error) {
            console.error('Auth error:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadTimetable = async () => {
        if (!user?.class_id) return

        try {
            // Step 1: Fetch raw timetable entries (no PostgREST joins)
            let query = supabase
                .from('timetable_entries')
                .select('entry_id, day_of_week, room_number, subject_id, teacher_id, slot_id, notes')
                .eq('class_id', user.class_id)
                .eq('day_of_week', selectedDay)

            if (user.section_id) {
                query = query.eq('section_id', user.section_id)
            }

            const { data: entries, error } = await query

            if (error) {
                console.error('Error fetching entries:', error)
            }

            if (!entries || entries.length === 0) {
                setSchedule([])
                return
            }

            // Step 2: Collect unique IDs for lookup
            const subjectIds = [...new Set(entries.map(e => e.subject_id).filter(Boolean))]
            const teacherIdsObj = new Set<string>();
            entries.forEach((e: any) => {
                let tid = e.teacher_id;
                if (e.notes) {
                    try { const n = JSON.parse(e.notes); if (n.type === 'substitution' && n.substitute_teacher_id) tid = n.substitute_teacher_id; } catch(err){}
                }
                e.actual_teacher_id = tid;
                if (tid) teacherIdsObj.add(tid);
            });
            const teacherIds = Array.from(teacherIdsObj);
            const slotIds = [...new Set(entries.map(e => e.slot_id).filter(Boolean))]

            // Step 3: Fetch lookups in parallel
            const [subjectsRes, teachersRes, slotsRes] = await Promise.all([
                subjectIds.length > 0
                    ? supabase.from('subjects').select('subject_id, name').in('subject_id', subjectIds)
                    : { data: [] },
                teacherIds.length > 0
                    ? supabase.from('users').select('user_id, full_name').in('user_id', teacherIds)
                    : { data: [] },
                slotIds.length > 0
                    ? supabase.from('timetable_slots').select('slot_id, slot_number, start_time, end_time').in('slot_id', slotIds)
                    : { data: [] }
            ])

            const subjectMap = new Map((subjectsRes.data || []).map((s: any) => [s.subject_id, s.name]))
            const teacherMap = new Map((teachersRes.data || []).map((t: any) => [t.user_id, t.full_name]))
            const slotMap = new Map((slotsRes.data || []).map((s: any) => [s.slot_id, {
                slot_number: s.slot_number,
                start_time: s.start_time,
                end_time: s.end_time
            }]))

            // Step 4: Build formatted schedule
            const formatted = entries
                .map((entry: any) => {
                    const slot = slotMap.get(entry.slot_id) || { slot_number: 0, start_time: '', end_time: '' }
                    let isSub = false;
                    if (entry.notes) {
                        try { const n = JSON.parse(entry.notes); if (n.type === 'substitution' && n.substitute_teacher_id) isSub = true; } catch(err){}
                    }
                    return {
                        start_time: slot.start_time || '',
                        end_time: slot.end_time || '',
                        subject: subjectMap.get(entry.subject_id) || 'Subject',
                        teacher: teacherMap.get(entry.actual_teacher_id) || 'TBA',
                        is_substitute: isSub,
                        room: entry.room_number || '',
                        slot_number: slot.slot_number || 0
                    }
                })
                .sort((a, b) => a.slot_number - b.slot_number || a.start_time.localeCompare(b.start_time))

            setSchedule(formatted)
        } catch (error) {
            console.error('Error loading timetable:', error)
        }
    }

    function formatTime(time: string) {
        if (!time) return 'TBD'
        const [h, m] = time.split(':')
        const hour = parseInt(h) % 12 || 12
        const ampm = parseInt(h) >= 12 ? 'PM' : 'AM'
        return `${hour}:${m} ${ampm}`
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-green-900 to-slate-900">
                <Loader2 className="w-12 h-12 text-green-400 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900 to-slate-900">
            {/* Header */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                <div className="max-w-4xl mx-auto flex items-center gap-4">
                    <button
                        onClick={goBack}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-green-300" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <Calendar className="w-6 h-6 text-cyan-400" />
                            My Timetable
                        </h1>
                        <p className="text-sm text-green-300/70">View your class schedule</p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6">
                {/* Day Selector */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {days.map((day, index) => (
                        <button
                            key={day}
                            onClick={() => setSelectedDay(index)}
                            className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${selectedDay === index
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                                : 'bg-white/10 text-white/70 hover:bg-white/20'
                                }`}
                        >
                            {day}
                        </button>
                    ))}
                </div>

                {/* Schedule */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                    <div className="p-5 border-b border-white/10">
                        <h2 className="text-lg font-bold text-white">{days[selectedDay]}&apos;s Schedule</h2>
                    </div>

                    {schedule.length === 0 ? (
                        <div className="p-12 text-center">
                            <Calendar className="w-16 h-16 mx-auto mb-4 text-green-300/50" />
                            <h3 className="text-lg font-bold text-white mb-2">No Classes</h3>
                            <p className="text-green-300/70">No classes scheduled for {days[selectedDay]}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/10">
                            {schedule.map((period, i) => (
                                <div key={i} className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors">
                                    <div className="text-center min-w-[80px]">
                                        <Clock className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                                        <p className="text-sm font-medium text-white">{formatTime(period.start_time)}</p>
                                        <p className="text-xs text-green-300/50">{formatTime(period.end_time)}</p>
                                    </div>
                                    <div className="w-px h-10 bg-white/10" />
                                    <div className="flex-1">
                                        <p className="font-semibold text-white">{period.subject}</p>
                                        <p className="text-sm text-green-300/70">
                                            {period.is_substitute && <span className="text-[10px] uppercase font-bold text-purple-600 bg-purple-100 px-1 py-0.5 rounded shadow-sm mr-1">SUB</span>}
                                            {period.teacher}
                                        </p>
                                    </div>
                                    {period.room && (
                                        <span className="px-2 py-1 bg-white/10 text-white/60 text-xs rounded-lg">
                                            Room {period.room}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}

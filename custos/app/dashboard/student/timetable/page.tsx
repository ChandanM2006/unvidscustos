'use client'

import { useEffect, useState } from 'react'
import { supabase, type User } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
    Calendar, ArrowLeft, Loader2, Clock
} from 'lucide-react'

interface TimetableEntry {
    time: string
    subject: string
    teacher: string
    room: string
}

export default function StudentTimetablePage() {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [selectedDay, setSelectedDay] = useState(new Date().getDay() || 1)
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
            const { data } = await supabase
                .from('timetable_entries')
                .select(`
                    entry_id,
                    timetable_slots (start_time, end_time, day_of_week),
                    subjects (name),
                    users!timetable_entries_teacher_id_fkey (full_name)
                `)
                .eq('class_id', user.class_id)

            if (data) {
                const filtered = data
                    .filter((entry: any) => entry.timetable_slots?.day_of_week === selectedDay)
                    .map((entry: any) => ({
                        time: entry.timetable_slots?.start_time || 'TBD',
                        subject: entry.subjects?.name || 'Subject',
                        teacher: entry.users?.full_name || 'Teacher',
                        room: 'Room TBD'
                    }))
                    .sort((a: TimetableEntry, b: TimetableEntry) => a.time.localeCompare(b.time))

                setSchedule(filtered)
            }
        } catch (error) {
            console.error('Error loading timetable:', error)
        }
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
                        onClick={() => router.push('/dashboard/student')}
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
                        <h2 className="text-lg font-bold text-white">{days[selectedDay]}'s Schedule</h2>
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
                                    <div className="text-center min-w-[70px]">
                                        <Clock className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                                        <p className="text-sm font-medium text-white">{period.time}</p>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-white">{period.subject}</p>
                                        <p className="text-sm text-green-300/70">{period.teacher}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}

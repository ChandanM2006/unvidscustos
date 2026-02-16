'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Clock, Calendar, Loader2
} from 'lucide-react'

interface TimeSlot {
    slot_id: string
    slot_number: number
    slot_name: string
    start_time: string
    end_time: string
    is_break: boolean
}

interface TimetableEntry {
    entry_id: string
    day_of_week: number
    slot_id: string
    subjects?: { name: string }
    classes?: { name: string }
    sections?: { name: string }
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SCHOOL_DAYS = [1, 2, 3, 4, 5, 6] // Mon-Sat

export default function TeacherTimetablePage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [slots, setSlots] = useState<TimeSlot[]>([])
    const [entries, setEntries] = useState<TimetableEntry[]>([])
    const [teacherName, setTeacherName] = useState('')

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }

            const { data: userData } = await supabase
                .from('users')
                .select('user_id, full_name, role, school_id')
                .eq('email', session.user.email)
                .single()

            if (!userData || userData.role !== 'teacher') {
                router.push('/login')
                return
            }

            setTeacherName(userData.full_name)

            // Load time slots
            const { data: slotData } = await supabase
                .from('timetable_slots')
                .select('*')
                .eq('school_id', userData.school_id)
                .order('slot_number')

            setSlots(slotData || [])

            // Load teacher's timetable entries
            const { data: entryData } = await supabase
                .from('timetable_entries')
                .select(`
                    entry_id,
                    day_of_week,
                    slot_id,
                    subjects (name),
                    classes (name),
                    sections (name)
                `)
                .eq('teacher_id', userData.user_id)

            setEntries((entryData as any) || [])

        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    function getEntry(day: number, slotId: string): TimetableEntry | undefined {
        return entries.find(e => e.day_of_week === day && e.slot_id === slotId)
    }

    function formatTime(time: string): string {
        if (!time) return ''
        const [hours, minutes] = time.split(':')
        const hour = parseInt(hours)
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const displayHour = hour % 12 || 12
        return `${displayHour}:${minutes} ${ampm}`
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
                <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
            {/* Header */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/dashboard/teacher')} className="p-2 hover:bg-white/10 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-blue-300" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-white flex items-center gap-2">
                                <Calendar className="w-6 h-6 text-cyan-400" />
                                My Timetable
                            </h1>
                            <p className="text-sm text-blue-300/70">Your weekly teaching schedule</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-white font-medium">{teacherName}</p>
                        <p className="text-sm text-blue-300/70">{entries.length} periods/week</p>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6">
                {slots.length === 0 ? (
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-12 text-center">
                        <Clock className="w-16 h-16 mx-auto mb-4 text-blue-300/50" />
                        <h3 className="text-xl font-bold text-white mb-2">No Timetable Configured</h3>
                        <p className="text-blue-300/70">The school admin hasn't set up time slots yet.</p>
                    </div>
                ) : (
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                                        <th className="p-4 text-left text-white font-semibold w-32">Time</th>
                                        {SCHOOL_DAYS.map(day => (
                                            <th key={day} className="p-4 text-center text-white font-semibold min-w-[140px]">
                                                {DAYS[day]}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {slots.map(slot => (
                                        <tr
                                            key={slot.slot_id}
                                            className={`border-b border-white/10 ${slot.is_break ? 'bg-yellow-500/10' : ''}`}
                                        >
                                            <td className="p-3 border-r border-white/10">
                                                <div className="text-sm font-medium text-white">{slot.slot_name}</div>
                                                <div className="text-xs text-blue-300/70">
                                                    {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                                                </div>
                                            </td>
                                            {SCHOOL_DAYS.map(day => {
                                                const entry = getEntry(day, slot.slot_id)

                                                if (slot.is_break) {
                                                    return (
                                                        <td key={day} className="p-3 text-center text-yellow-300/70 italic">
                                                            {slot.slot_name}
                                                        </td>
                                                    )
                                                }

                                                return (
                                                    <td key={day} className="p-2 border-r border-white/10">
                                                        {entry ? (
                                                            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/30 to-indigo-500/30 border border-blue-400/30">
                                                                <div className="text-sm font-semibold text-white">
                                                                    {entry.subjects?.name || 'Subject'}
                                                                </div>
                                                                <div className="text-xs text-blue-300">
                                                                    {entry.classes?.name}{entry.sections?.name ? ` - ${entry.sections.name}` : ''}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="p-2 text-center text-white/30 text-xs">
                                                                Free
                                                            </div>
                                                        )}
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Legend */}
                <div className="mt-6 flex items-center gap-6 justify-center">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-gradient-to-r from-blue-500/30 to-indigo-500/30 border border-blue-400/30"></div>
                        <span className="text-sm text-blue-300/70">Your Class</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-yellow-500/20"></div>
                        <span className="text-sm text-blue-300/70">Break</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-white/5"></div>
                        <span className="text-sm text-blue-300/70">Free Period</span>
                    </div>
                </div>
            </main>
        </div>
    )
}

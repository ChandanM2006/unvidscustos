'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Calendar, Clock, Loader2, Users
} from 'lucide-react'

interface Child {
    user_id: string
    full_name: string
    class_id: string
    class_name: string
}

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
    teachers?: { full_name: string }
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SCHOOL_DAYS = [1, 2, 3, 4, 5, 6] // Mon-Sat

export default function ParentTimetablePage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)

    const [children, setChildren] = useState<Child[]>([])
    const [selectedChild, setSelectedChild] = useState<Child | null>(null)
    const [slots, setSlots] = useState<TimeSlot[]>([])
    const [entries, setEntries] = useState<TimetableEntry[]>([])

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        if (selectedChild) {
            loadTimetable()
        }
    }, [selectedChild])

    async function loadData() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }

            const { data: userData } = await supabase
                .from('users')
                .select('user_id, role, school_id')
                .eq('email', session.user.email)
                .single()

            if (!userData || userData.role !== 'parent') {
                router.push('/login')
                return
            }

            // Load linked children
            const { data: linksData } = await supabase
                .from('parent_student_links')
                .select('student_id')
                .eq('parent_id', userData.user_id)

            if (linksData && linksData.length > 0) {
                const studentIds = linksData.map(l => l.student_id)

                const { data: childrenData } = await supabase
                    .from('users')
                    .select('user_id, full_name, class_id, classes(name)')
                    .in('user_id', studentIds)

                const formattedChildren = (childrenData || []).map((c: any) => ({
                    user_id: c.user_id,
                    full_name: c.full_name,
                    class_id: c.class_id,
                    class_name: c.classes?.name || 'No class'
                }))

                setChildren(formattedChildren)
                if (formattedChildren.length > 0) {
                    setSelectedChild(formattedChildren[0])
                }
            }

            // Load time slots
            const { data: slotData } = await supabase
                .from('timetable_slots')
                .select('*')
                .eq('school_id', userData.school_id)
                .order('slot_number')

            setSlots(slotData || [])

        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadTimetable() {
        if (!selectedChild?.class_id) return

        const { data } = await supabase
            .from('timetable_entries')
            .select(`
                entry_id,
                day_of_week,
                slot_id,
                subjects (name),
                users:teacher_id (full_name)
            `)
            .eq('class_id', selectedChild.class_id)

        const formatted = (data || []).map((e: any) => ({
            ...e,
            teachers: e.users
        }))

        setEntries(formatted)
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
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
                <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Header */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/dashboard/parent')} className="p-2 hover:bg-white/10 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-purple-300" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-white flex items-center gap-2">
                                <Calendar className="w-6 h-6 text-purple-400" />
                                Child's Timetable
                            </h1>
                            <p className="text-sm text-purple-300/70">View your child's class schedule</p>
                        </div>
                    </div>

                    {/* Child Selector */}
                    {children.length > 1 && (
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-purple-300/70" />
                            <select
                                value={selectedChild?.user_id || ''}
                                onChange={(e) => {
                                    const child = children.find(c => c.user_id === e.target.value)
                                    setSelectedChild(child || null)
                                }}
                                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                            >
                                {children.map(child => (
                                    <option key={child.user_id} value={child.user_id} className="bg-slate-800">
                                        {child.full_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6">
                {children.length === 0 ? (
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-12 text-center">
                        <Users className="w-16 h-16 mx-auto mb-4 text-purple-300/50" />
                        <h3 className="text-xl font-bold text-white mb-2">No Children Linked</h3>
                        <p className="text-purple-300/70">Contact school admin to link your account to your child.</p>
                    </div>
                ) : !selectedChild?.class_id ? (
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-12 text-center">
                        <Calendar className="w-16 h-16 mx-auto mb-4 text-purple-300/50" />
                        <h3 className="text-xl font-bold text-white mb-2">No Class Assigned</h3>
                        <p className="text-purple-300/70">{selectedChild?.full_name} hasn't been assigned to a class yet.</p>
                    </div>
                ) : slots.length === 0 ? (
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-12 text-center">
                        <Clock className="w-16 h-16 mx-auto mb-4 text-purple-300/50" />
                        <h3 className="text-xl font-bold text-white mb-2">No Timetable Configured</h3>
                        <p className="text-purple-300/70">The school hasn't set up the timetable yet.</p>
                    </div>
                ) : (
                    <>
                        {/* Child Info Card */}
                        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 mb-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">{selectedChild.full_name}</h2>
                                    <p className="text-purple-200">{selectedChild.class_name}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-bold text-white">{entries.length}</p>
                                    <p className="text-purple-200">periods/week</p>
                                </div>
                            </div>
                        </div>

                        {/* Timetable Grid */}
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-purple-600 to-pink-600">
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
                                                    <div className="text-xs text-purple-300/70">
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
                                                                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-purple-400/30">
                                                                    <div className="text-sm font-semibold text-white">
                                                                        {entry.subjects?.name || 'Subject'}
                                                                    </div>
                                                                    {entry.teachers?.full_name && (
                                                                        <div className="text-xs text-purple-300">
                                                                            {entry.teachers.full_name}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="p-2 text-center text-white/30 text-xs">
                                                                    -
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

                        {/* Legend */}
                        <div className="mt-6 flex items-center gap-6 justify-center">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded bg-gradient-to-r from-purple-500/30 to-pink-500/30 border border-purple-400/30"></div>
                                <span className="text-sm text-purple-300/70">Scheduled Class</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded bg-yellow-500/20"></div>
                                <span className="text-sm text-purple-300/70">Break</span>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    )
}

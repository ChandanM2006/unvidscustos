'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Clock, Calendar, Plus, Edit2, Trash2,
    ChevronLeft, ChevronRight, Loader2, Save, Users, BookOpen
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
    class_id: string
    section_id: string
    subject_id: string
    teacher_id: string
    day_of_week: number
    slot_id: string
    room_number?: string
    subjects?: { name: string; code?: string }
    users?: { full_name: string }
}

interface ClassItem {
    class_id: string
    name: string
}

interface Section {
    section_id: string
    name: string
}

interface Subject {
    subject_id: string
    name: string
    code?: string
}

interface Teacher {
    user_id: string
    full_name: string
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SCHOOL_DAYS = [1, 2, 3, 4, 5, 6] // Mon-Sat

export default function TimetablePage() {
    const router = useRouter()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Data
    const [classes, setClasses] = useState<ClassItem[]>([])
    const [sections, setSections] = useState<Section[]>([])
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [teachers, setTeachers] = useState<Teacher[]>([])
    const [slots, setSlots] = useState<TimeSlot[]>([])
    const [entries, setEntries] = useState<TimetableEntry[]>([])

    // Selection
    const [selectedClassId, setSelectedClassId] = useState('')
    const [selectedSectionId, setSelectedSectionId] = useState('')

    // Edit mode
    const [editingCell, setEditingCell] = useState<{ day: number; slotId: string } | null>(null)
    const [editForm, setEditForm] = useState({ subject_id: '', teacher_id: '', room_number: '' })

    useEffect(() => {
        loadInitialData()
    }, [])

    useEffect(() => {
        if (selectedClassId) {
            loadSections()
            loadSubjects()
        }
    }, [selectedClassId])

    useEffect(() => {
        if (selectedClassId && selectedSectionId) {
            loadTimetable()
        }
    }, [selectedClassId, selectedSectionId])

    async function loadInitialData() {
        try {
            // Check role - only admins can access this page
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }

            const { data: userData } = await supabase
                .from('users')
                .select('role')
                .eq('email', session.user.email)
                .single()

            if (!userData || !['super_admin', 'sub_admin'].includes(userData.role)) {
                alert('Only administrators can manage the timetable.')
                if (userData?.role === 'teacher') {
                    router.push('/dashboard/teacher/timetable')
                } else {
                    router.push('/dashboard')
                }
                return
            }

            // Load classes
            const { data: classData } = await supabase
                .from('classes')
                .select('*')
                .order('grade_level', { ascending: true })
            setClasses(classData || [])

            // Load teachers
            const { data: teacherData } = await supabase
                .from('users')
                .select('user_id, full_name')
                .eq('role', 'teacher')
                .order('full_name', { ascending: true })
            setTeachers(teacherData || [])

            // Load time slots (table may not exist yet)
            const { data: slotData, error: slotError } = await supabase
                .from('timetable_slots')
                .select('*')
                .order('slot_number', { ascending: true })
            if (!slotError) setSlots(slotData || [])

        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadSections() {
        const { data } = await supabase
            .from('sections')
            .select('*')
            .eq('class_id', selectedClassId)
            .order('name', { ascending: true })
        setSections(data || [])
    }

    async function loadSubjects() {
        const { data } = await supabase
            .from('subjects')
            .select('*')
            .eq('class_id', selectedClassId)
            .order('name', { ascending: true })
        setSubjects(data || [])
    }

    async function loadTimetable() {
        try {
            const { data, error } = await supabase
                .from('timetable_entries')
                .select(`
                    *,
                    subjects (name, code),
                    users:teacher_id (full_name)
                `)
                .eq('class_id', selectedClassId)
                .eq('section_id', selectedSectionId)

            if (error) {
                // Table may not exist yet — silently fall back to empty
                if (error.code === '42P01' || error.message?.includes('does not exist') || error.code === 'PGRST204') {
                    setEntries([])
                    return
                }
                throw error
            }
            setEntries(data || [])
        } catch (error: any) {
            // Only log real errors, not missing-table issues
            if (error?.code !== '42P01') {
                console.error('Error loading timetable:', error?.message || error)
            }
            setEntries([])
        }
    }

    function getEntry(day: number, slotId: string): TimetableEntry | undefined {
        return entries.find(e => e.day_of_week === day && e.slot_id === slotId)
    }

    function startEdit(day: number, slotId: string) {
        const existing = getEntry(day, slotId)
        setEditForm({
            subject_id: existing?.subject_id || '',
            teacher_id: existing?.teacher_id || '',
            room_number: existing?.room_number || ''
        })
        setEditingCell({ day, slotId })
    }

    async function saveEntry() {
        if (!editingCell || !selectedClassId || !selectedSectionId) return

        setSaving(true)

        try {
            const existingEntry = getEntry(editingCell.day, editingCell.slotId)

            if (editForm.subject_id) {
                // Upsert entry
                const entryData = {
                    class_id: selectedClassId,
                    section_id: selectedSectionId,
                    day_of_week: editingCell.day,
                    slot_id: editingCell.slotId,
                    subject_id: editForm.subject_id || null,
                    teacher_id: editForm.teacher_id || null,
                    room_number: editForm.room_number || null
                }

                if (existingEntry) {
                    await supabase
                        .from('timetable_entries')
                        .update(entryData)
                        .eq('entry_id', existingEntry.entry_id)
                } else {
                    await supabase
                        .from('timetable_entries')
                        .insert(entryData)
                }
            } else if (existingEntry) {
                // Delete if no subject selected
                await supabase
                    .from('timetable_entries')
                    .delete()
                    .eq('entry_id', existingEntry.entry_id)
            }

            // Reload timetable
            await loadTimetable()
            setEditingCell(null)

        } catch (error: any) {
            console.error('Error saving entry:', error)
            alert('Error saving: ' + error.message)
        } finally {
            setSaving(false)
        }
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
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 p-8">
            <div className="max-w-full mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/dashboard/manage')}
                            className="p-2 hover:bg-white rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Timetable</h1>
                            <p className="text-gray-600">Manage class schedules and teacher assignments</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/dashboard/manage/timetable/settings')}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
                        >
                            <Clock className="w-5 h-5" />
                            Configure Time Slots
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                            <select
                                value={selectedClassId}
                                onChange={(e) => {
                                    setSelectedClassId(e.target.value)
                                    setSelectedSectionId('')
                                }}
                                className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white"
                            >
                                <option value="">Select Class</option>
                                {classes.map(c => (
                                    <option key={c.class_id} value={c.class_id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                            <select
                                value={selectedSectionId}
                                onChange={(e) => setSelectedSectionId(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white"
                                disabled={!selectedClassId}
                            >
                                <option value="">Select Section</option>
                                {sections.map(s => (
                                    <option key={s.section_id} value={s.section_id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <p className="text-sm text-gray-500">
                                {entries.length} periods scheduled
                            </p>
                        </div>
                    </div>
                </div>

                {/* Timetable Grid */}
                {slots.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
                        <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No Time Slots Configured</h3>
                        <p className="text-gray-500 mb-4">Set up your school's daily periods and breaks</p>
                        <button
                            onClick={() => router.push('/dashboard/manage/timetable/settings')}
                            className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 font-medium"
                        >
                            Configure Time Slots
                        </button>
                    </div>
                ) : !selectedClassId || !selectedSectionId ? (
                    <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
                        <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Select Class & Section</h3>
                        <p className="text-gray-500">Choose a class and section to view/edit the timetable</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                                        <th className="p-4 text-left font-semibold w-32">Time</th>
                                        {SCHOOL_DAYS.map(day => (
                                            <th key={day} className="p-4 text-center font-semibold min-w-[140px]">
                                                {DAYS[day]}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {slots.map(slot => (
                                        <tr
                                            key={slot.slot_id}
                                            className={`border-b ${slot.is_break ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                                        >
                                            <td className="p-3 border-r">
                                                <div className="text-sm font-medium text-gray-900">{slot.slot_name}</div>
                                                <div className="text-xs text-gray-500">
                                                    {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                                                </div>
                                            </td>
                                            {SCHOOL_DAYS.map(day => {
                                                const entry = getEntry(day, slot.slot_id)
                                                const isEditing = editingCell?.day === day && editingCell?.slotId === slot.slot_id

                                                if (slot.is_break) {
                                                    return (
                                                        <td key={day} className="p-3 text-center text-gray-400 italic">
                                                            {slot.slot_name}
                                                        </td>
                                                    )
                                                }

                                                return (
                                                    <td key={day} className="p-2 border-r">
                                                        {isEditing ? (
                                                            <div className="space-y-2 p-2 bg-orange-50 rounded-lg">
                                                                <select
                                                                    value={editForm.subject_id}
                                                                    onChange={(e) => setEditForm(f => ({ ...f, subject_id: e.target.value }))}
                                                                    className="w-full p-2 border rounded text-sm text-gray-900"
                                                                >
                                                                    <option value="">No Subject</option>
                                                                    {subjects.map(s => (
                                                                        <option key={s.subject_id} value={s.subject_id}>{s.name}</option>
                                                                    ))}
                                                                </select>
                                                                <select
                                                                    value={editForm.teacher_id}
                                                                    onChange={(e) => setEditForm(f => ({ ...f, teacher_id: e.target.value }))}
                                                                    className="w-full p-2 border rounded text-sm text-gray-900"
                                                                >
                                                                    <option value="">No Teacher</option>
                                                                    {teachers.map(t => (
                                                                        <option key={t.user_id} value={t.user_id}>{t.full_name}</option>
                                                                    ))}
                                                                </select>
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        onClick={saveEntry}
                                                                        disabled={saving}
                                                                        className="flex-1 py-1 bg-green-600 text-white rounded text-xs font-medium"
                                                                    >
                                                                        {saving ? '...' : 'Save'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setEditingCell(null)}
                                                                        className="flex-1 py-1 bg-gray-400 text-white rounded text-xs font-medium"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div
                                                                onClick={() => startEdit(day, slot.slot_id)}
                                                                className={`p-2 rounded-lg cursor-pointer transition-all min-h-[60px] ${entry
                                                                    ? 'bg-gradient-to-br from-orange-100 to-amber-100 border border-orange-200 hover:shadow-md'
                                                                    : 'bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300'
                                                                    }`}
                                                            >
                                                                {entry ? (
                                                                    <>
                                                                        <div className="text-sm font-semibold text-orange-800">
                                                                            {entry.subjects?.name || 'Subject'}
                                                                        </div>
                                                                        <div className="text-xs text-orange-600">
                                                                            {entry.users?.full_name || 'No teacher'}
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <div className="text-xs text-gray-400 text-center">
                                                                        + Add
                                                                    </div>
                                                                )}
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
            </div>
        </div>
    )
}

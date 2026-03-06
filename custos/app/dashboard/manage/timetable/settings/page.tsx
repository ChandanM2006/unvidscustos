'use client'

import { useState, useEffect } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Clock, Plus, Trash2, Save, Loader2,
    GripVertical, Coffee, BookOpen
} from 'lucide-react'

interface TimeSlot {
    slot_id: string
    slot_number: number
    slot_name: string
    start_time: string
    end_time: string
    is_break: boolean
}

export default function TimeSlotSettingsPage() {
    const { goBack, router } = useSmartBack('/dashboard/manage/timetable')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [schoolId, setSchoolId] = useState<string | null>(null)
    const [slots, setSlots] = useState<TimeSlot[]>([])

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            // Get current user's school
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }

            const { data: userData } = await supabase
                .from('users')
                .select('school_id, role')
                .eq('email', session.user.email)
                .single()

            if (!userData || !['super_admin', 'sub_admin'].includes(userData.role)) {
                alert('Only admins can access this page')
                router.replace('/dashboard/redirect')
                return
            }

            setSchoolId(userData.school_id)

            // Load existing slots
            const { data: slotsData } = await supabase
                .from('timetable_slots')
                .select('*')
                .eq('school_id', userData.school_id)
                .order('slot_number')

            if (slotsData && slotsData.length > 0) {
                setSlots(slotsData)
            } else {
                // Default empty slots
                setSlots([
                    { slot_id: '', slot_number: 1, slot_name: 'Period 1', start_time: '08:00', end_time: '08:45', is_break: false }
                ])
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    function addSlot() {
        const lastSlot = slots[slots.length - 1]
        const newNumber = lastSlot ? lastSlot.slot_number + 1 : 1
        const periodCount = slots.filter(s => !s.is_break).length + 1

        // Auto-calculate next time (45 min after last end)
        let nextStart = '08:00'
        let nextEnd = '08:45'
        if (lastSlot) {
            nextStart = lastSlot.end_time
            const [h, m] = nextStart.split(':').map(Number)
            const endMinutes = h * 60 + m + 45
            nextEnd = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
        }

        setSlots([...slots, {
            slot_id: '',
            slot_number: newNumber,
            slot_name: `Period ${periodCount}`,
            start_time: nextStart,
            end_time: nextEnd,
            is_break: false
        }])
    }

    function addBreak() {
        const lastSlot = slots[slots.length - 1]
        const newNumber = lastSlot ? lastSlot.slot_number + 1 : 1

        let nextStart = '10:00'
        let nextEnd = '10:15'
        if (lastSlot) {
            nextStart = lastSlot.end_time
            const [h, m] = nextStart.split(':').map(Number)
            const endMinutes = h * 60 + m + 15
            nextEnd = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
        }

        setSlots([...slots, {
            slot_id: '',
            slot_number: newNumber,
            slot_name: 'Break',
            start_time: nextStart,
            end_time: nextEnd,
            is_break: true
        }])
    }

    function updateSlot(index: number, field: keyof TimeSlot, value: string | boolean) {
        const updated = [...slots]
        updated[index] = { ...updated[index], [field]: value }
        setSlots(updated)
    }

    function removeSlot(index: number) {
        if (slots.length <= 1) {
            alert('You must have at least one slot')
            return
        }
        const updated = slots.filter((_, i) => i !== index)
        // Renumber
        updated.forEach((slot, i) => {
            slot.slot_number = i + 1
        })
        setSlots(updated)
    }

    function moveSlot(index: number, direction: 'up' | 'down') {
        if (direction === 'up' && index === 0) return
        if (direction === 'down' && index === slots.length - 1) return

        const updated = [...slots]
        const targetIndex = direction === 'up' ? index - 1 : index + 1

        // Swap
        const temp = updated[index]
        updated[index] = updated[targetIndex]
        updated[targetIndex] = temp

        // Renumber
        updated.forEach((slot, i) => {
            slot.slot_number = i + 1
        })

        setSlots(updated)
    }

    async function saveSlots() {
        if (!schoolId) return

        // Validate
        for (const slot of slots) {
            if (!slot.slot_name.trim()) {
                alert('All slots must have a name')
                return
            }
            if (!slot.start_time || !slot.end_time) {
                alert('All slots must have start and end times')
                return
            }
            if (slot.start_time >= slot.end_time) {
                alert(`${slot.slot_name}: End time must be after start time`)
                return
            }
        }

        setSaving(true)
        try {
            // Delete existing slots
            await supabase
                .from('timetable_slots')
                .delete()
                .eq('school_id', schoolId)

            // Insert new slots
            const slotsToInsert = slots.map((slot, index) => ({
                school_id: schoolId,
                slot_number: index + 1,
                slot_name: slot.slot_name,
                start_time: slot.start_time,
                end_time: slot.end_time,
                is_break: slot.is_break
            }))

            const { error } = await supabase
                .from('timetable_slots')
                .insert(slotsToInsert)

            if (error) throw error

            alert('Time slots saved successfully!')
            router.push('/dashboard/manage/timetable')
        } catch (error: any) {
            console.error('Error saving:', error)
            alert('Error: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-orange-900 to-slate-900">
                <Loader2 className="w-12 h-12 text-orange-400 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-orange-900 to-slate-900">
            {/* Header */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={goBack} className="p-2 hover:bg-white/10 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-orange-300" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-white flex items-center gap-2">
                                <Clock className="w-6 h-6 text-orange-400" />
                                Time Slot Settings
                            </h1>
                            <p className="text-sm text-orange-300/70">Configure your school's daily schedule</p>
                        </div>
                    </div>
                    <button
                        onClick={saveSlots}
                        disabled={saving}
                        className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Save Changes
                    </button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6">
                {/* Info */}
                <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl p-4 mb-6">
                    <p className="text-orange-200 text-sm">
                        💡 <strong>Tip:</strong> Add periods in order. Mark breaks (recess, lunch) separately.
                        Times auto-calculate based on the previous slot.
                    </p>
                </div>

                {/* Time Slots List */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden mb-6">
                    <div className="p-5 border-b border-white/10">
                        <h2 className="text-lg font-bold text-white">Daily Schedule</h2>
                    </div>

                    <div className="divide-y divide-white/10">
                        {slots.map((slot, index) => (
                            <div
                                key={index}
                                className={`p-4 flex items-center gap-4 ${slot.is_break ? 'bg-yellow-500/10' : 'hover:bg-white/5'}`}
                            >
                                {/* Drag Handle & Number */}
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col gap-1">
                                        <button
                                            onClick={() => moveSlot(index, 'up')}
                                            disabled={index === 0}
                                            className="text-white/30 hover:text-white disabled:opacity-20"
                                        >
                                            ▲
                                        </button>
                                        <button
                                            onClick={() => moveSlot(index, 'down')}
                                            disabled={index === slots.length - 1}
                                            className="text-white/30 hover:text-white disabled:opacity-20"
                                        >
                                            ▼
                                        </button>
                                    </div>
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${slot.is_break ? 'bg-yellow-500/30' : 'bg-orange-500/30'
                                        }`}>
                                        {slot.is_break ? <Coffee className="w-5 h-5 text-yellow-400" /> : <span className="font-bold text-orange-400">{index + 1}</span>}
                                    </div>
                                </div>

                                {/* Name */}
                                <input
                                    type="text"
                                    value={slot.slot_name}
                                    onChange={(e) => updateSlot(index, 'slot_name', e.target.value)}
                                    placeholder="Period name"
                                    className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 min-w-[120px]"
                                />

                                {/* Start Time */}
                                <div className="flex items-center gap-2">
                                    <input
                                        type="time"
                                        value={slot.start_time}
                                        onChange={(e) => updateSlot(index, 'start_time', e.target.value)}
                                        className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white w-32"
                                    />
                                    <span className="text-white/50">to</span>
                                    <input
                                        type="time"
                                        value={slot.end_time}
                                        onChange={(e) => updateSlot(index, 'end_time', e.target.value)}
                                        className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white w-32"
                                    />
                                </div>

                                {/* Break Toggle */}
                                <button
                                    onClick={() => updateSlot(index, 'is_break', !slot.is_break)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${slot.is_break
                                        ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50'
                                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                                        }`}
                                >
                                    {slot.is_break ? '☕ Break' : 'Period'}
                                </button>

                                {/* Delete */}
                                <button
                                    onClick={() => removeSlot(index)}
                                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Add Buttons */}
                <div className="flex gap-4">
                    <button
                        onClick={addSlot}
                        className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-xl font-medium hover:opacity-90 flex items-center justify-center gap-2"
                    >
                        <BookOpen className="w-5 h-5" />
                        Add Period
                    </button>
                    <button
                        onClick={addBreak}
                        className="flex-1 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-medium hover:opacity-90 flex items-center justify-center gap-2"
                    >
                        <Coffee className="w-5 h-5" />
                        Add Break
                    </button>
                </div>

                {/* Preview */}
                <div className="mt-8 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Preview</h3>
                    <div className="space-y-2">
                        {slots.map((slot, i) => (
                            <div
                                key={i}
                                className={`flex items-center justify-between p-3 rounded-lg ${slot.is_break ? 'bg-yellow-500/20' : 'bg-white/5'
                                    }`}
                            >
                                <span className="font-medium text-white">{slot.slot_name}</span>
                                <span className="text-orange-300/70">
                                    {slot.start_time} - {slot.end_time}
                                </span>
                            </div>
                        ))}
                    </div>
                    {slots.length > 0 && (
                        <p className="mt-4 text-sm text-orange-300/50 text-center">
                            Total: {slots.filter(s => !s.is_break).length} periods, {slots.filter(s => s.is_break).length} breaks
                        </p>
                    )}
                </div>
            </main>
        </div>
    )
}

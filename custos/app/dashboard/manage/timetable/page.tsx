'use client'

import { useState, useEffect } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Clock, Calendar, Plus, Edit2, Trash2,
    ChevronLeft, ChevronRight, Loader2, Save, Users, BookOpen,
    AlertTriangle, ShieldAlert, X, CheckCircle, Zap
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
    notes?: string
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

interface ConflictGroup {
    teacher_id: string
    teacher_name: string
    day_of_week: number
    slot_id: string
    slot_name: string
    slot_time: string
    entries: {
        entry_id: string
        class_name: string
        section_name: string
        subject_name: string
    }[]
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SCHOOL_DAYS = [1, 2, 3, 4, 5, 6] // Mon-Sat

export default function TimetablePage() {
    const { goBack, router } = useSmartBack('/dashboard/manage')

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
    const [editForm, setEditForm] = useState({ subject_id: '', teacher_id: '', substitute_teacher_id: '', room_number: '' })
    const [conflictError, setConflictError] = useState<string | null>(null)

    // ── Conflict detection ──
    const [conflicts, setConflicts] = useState<ConflictGroup[]>([])
    const [showConflictPanel, setShowConflictPanel] = useState(false)
    const [conflictLoading, setConflictLoading] = useState(false)
    const [schoolId, setSchoolId] = useState<string | null>(null)

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
    }, [selectedClassId, selectedSectionId, subjects])

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
                .select('role, school_id')
                .eq('email', session.user.email)
                .single()

            if (!userData || !['super_admin', 'sub_admin'].includes(userData.role)) {
                alert('Only administrators can manage the timetable.')
                if (userData?.role === 'teacher') {
                    router.push('/dashboard/teacher/timetable')
                } else {
                    router.replace('/dashboard/redirect')
                }
                return
            }

            setSchoolId(userData.school_id)

            // Load classes for this school only
            const { data: classData } = await supabase
                .from('classes')
                .select('*')
                .eq('school_id', userData.school_id)
                .order('grade_level', { ascending: true })
            setClasses(classData || [])

            // Load teachers for this school only
            const { data: teacherData } = await supabase
                .from('users')
                .select('user_id, full_name')
                .eq('role', 'teacher')
                .eq('school_id', userData.school_id)
                .order('full_name', { ascending: true })
            setTeachers(teacherData || [])

            // Load time slots (table may not exist yet)
            const { data: slotData, error: slotError } = await supabase
                .from('timetable_slots')
                .select('*')
                .eq('school_id', userData.school_id)
                .order('slot_number', { ascending: true })
            if (!slotError) setSlots(slotData || [])

            // Check for conflicts on page load
            await detectAllConflicts(teacherData || [], slotData || [], classData || [])

        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    // ── Detect all teacher conflicts across the entire timetable ──
    async function detectAllConflicts(
        teacherList?: Teacher[],
        slotList?: TimeSlot[],
        classList?: ClassItem[]
    ) {
        setConflictLoading(true)
        try {
            const tList = teacherList || teachers
            const sList = slotList || slots
            const cList = classList || classes

            // Fetch ALL entries across the school
            const { data: allEntries, error } = await supabase
                .from('timetable_entries')
                .select('entry_id, class_id, section_id, subject_id, teacher_id, day_of_week, slot_id, notes')

            if (error || !allEntries) {
                setConflicts([])
                return
            }

            // Fetch section names
            const sectionIds = [...new Set(allEntries.map(e => e.section_id).filter(Boolean))]
            let sectionMap = new Map<string, string>()
            if (sectionIds.length > 0) {
                const { data: secs } = await supabase
                    .from('sections')
                    .select('section_id, name')
                    .in('section_id', sectionIds)
                sectionMap = new Map((secs || []).map((s: any) => [s.section_id, s.name]))
            }

            // Fetch subject names
            const subjectIds = [...new Set(allEntries.map(e => e.subject_id).filter(Boolean))]
            let subjectMap = new Map<string, string>()
            if (subjectIds.length > 0) {
                const { data: subs } = await supabase
                    .from('subjects')
                    .select('subject_id, name')
                    .in('subject_id', subjectIds)
                subjectMap = new Map((subs || []).map((s: any) => [s.subject_id, s.name]))
            }

            const classMap = new Map(cList.map(c => [c.class_id, c.name]))
            const teacherMap = new Map(tList.map(t => [t.user_id, t.full_name]))
            const slotMap = new Map(sList.map(s => [s.slot_id, s]))

            // Group by teacher + day + slot
            const groups = new Map<string, TimetableEntry[]>()
            for (const entry of allEntries) {
                let actualTeacherId = entry.teacher_id;
                if (entry.notes) {
                    try { const n = JSON.parse(entry.notes); if (n.type === 'substitution' && n.substitute_teacher_id) actualTeacherId = n.substitute_teacher_id; } catch(e){}
                }
                if (!actualTeacherId) continue
                const key = `${actualTeacherId}_${entry.day_of_week}_${entry.slot_id}`
                if (!groups.has(key)) groups.set(key, [])
                groups.get(key)!.push({ ...entry, effective_teacher_id: actualTeacherId } as any)
            }

            // Find conflicts (groups with 2+ entries)
            const conflictGroups: ConflictGroup[] = []
            for (const [key, groupEntries] of groups) {
                if (groupEntries.length <= 1) continue
                const first = groupEntries[0]
                const slotObj = slotMap.get(first.slot_id)
                conflictGroups.push({
                    teacher_id: (first as any).effective_teacher_id,
                    teacher_name: teacherMap.get((first as any).effective_teacher_id) || 'Unknown',
                    day_of_week: first.day_of_week,
                    slot_id: first.slot_id,
                    slot_name: slotObj?.slot_name || 'Unknown',
                    slot_time: slotObj ? `${formatTime(slotObj.start_time)} - ${formatTime(slotObj.end_time)}` : '',
                    entries: groupEntries.map(e => ({
                        entry_id: e.entry_id,
                        class_name: classMap.get(e.class_id) || 'Unknown',
                        section_name: sectionMap.get(e.section_id) || '',
                        subject_name: subjectMap.get(e.subject_id) || 'Unknown'
                    }))
                })
            }

            setConflicts(conflictGroups)

            // Auto-show panel if conflicts found
            if (conflictGroups.length > 0) {
                setShowConflictPanel(true)
            }
        } catch (error) {
            console.error('Error detecting conflicts:', error)
        } finally {
            setConflictLoading(false)
        }
    }

    // ── Resolve a conflict by deleting a specific entry ──
    async function resolveConflict(entryId: string) {
        try {
            const { error } = await supabase
                .from('timetable_entries')
                .delete()
                .eq('entry_id', entryId)

            if (error) throw error

            // Refresh conflicts and timetable
            await detectAllConflicts()
            if (selectedClassId && selectedSectionId) {
                await loadTimetable()
            }
        } catch (error: any) {
            console.error('Error resolving conflict:', error)
            alert('Failed to remove entry: ' + error.message)
        }
    }

    // ── Auto-fix all conflicts (keep oldest entry) ──
    async function autoFixAllConflicts() {
        if (!confirm('This will remove duplicate entries, keeping only the first assignment for each teacher at each time slot. Continue?')) return

        setConflictLoading(true)
        try {
            const entriesToDelete: string[] = []
            for (const group of conflicts) {
                // Keep the first entry, delete the rest
                for (let i = 1; i < group.entries.length; i++) {
                    entriesToDelete.push(group.entries[i].entry_id)
                }
            }

            if (entriesToDelete.length > 0) {
                const { error } = await supabase
                    .from('timetable_entries')
                    .delete()
                    .in('entry_id', entriesToDelete)

                if (error) throw error
            }

            await detectAllConflicts()
            if (selectedClassId && selectedSectionId) {
                await loadTimetable()
            }
            alert(`✅ Fixed ${entriesToDelete.length} conflicting entries!`)
        } catch (error: any) {
            console.error('Auto-fix error:', error)
            alert('Failed: ' + error.message)
        } finally {
            setConflictLoading(false)
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
        // Subjects are linked to classes via class_section_subjects junction table
        const { data: assignments } = await supabase
            .from('class_section_subjects')
            .select('subject_id')
            .eq('class_id', selectedClassId)

        const subjectIds = [...new Set((assignments || []).map((a: any) => a.subject_id))]

        if (subjectIds.length > 0) {
            const { data } = await supabase
                .from('subjects')
                .select('*')
                .in('subject_id', subjectIds)
                .order('name', { ascending: true })
            setSubjects(data || [])
        } else {
            // Fallback: load all subjects for the school
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                const { data: userData } = await supabase
                    .from('users')
                    .select('school_id')
                    .eq('email', session.user.email)
                    .single()

                if (userData) {
                    const { data } = await supabase
                        .from('subjects')
                        .select('*')
                        .eq('school_id', userData.school_id)
                        .order('name', { ascending: true })
                    setSubjects(data || [])
                } else {
                    setSubjects([])
                }
            }
        }
    }

    async function loadTimetable() {
        try {
            const { data, error } = await supabase
                .from('timetable_entries')
                .select('*')
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

            // Enrich entries with subject and teacher names from loaded state
            const enriched = (data || []).map((entry: any) => {
                let actualTeacherId = entry.teacher_id;
                let isSub = false;
                if (entry.notes) {
                    try { const n = JSON.parse(entry.notes); if (n.type === 'substitution' && n.substitute_teacher_id) { actualTeacherId = n.substitute_teacher_id; isSub = true; } } catch(e){}
                }
                const sub = subjects.find((s: any) => s.subject_id === entry.subject_id)
                const teacher = teachers.find((t: any) => t.user_id === actualTeacherId)
                return {
                    ...entry,
                    subjects: sub ? { name: sub.name, code: sub.code } : null,
                    users: teacher ? { full_name: teacher.full_name, is_substitute: isSub } : null
                }
            })
            setEntries(enriched)
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

    // ── Check if a specific cell has a teacher conflict ──
    function getCellConflict(day: number, slotId: string): ConflictGroup | undefined {
        const entry = getEntry(day, slotId)
        let tId = entry?.teacher_id;
        if (entry?.notes) {
            try { const n = JSON.parse(entry.notes); if (n.type === 'substitution' && n.substitute_teacher_id) tId = n.substitute_teacher_id; } catch(e){}
        }
        if (!tId) return undefined
        return conflicts.find(c =>
            c.teacher_id === tId &&
            c.day_of_week === day &&
            c.slot_id === slotId
        )
    }

    function startEdit(day: number, slotId: string) {
        const existing = getEntry(day, slotId)
        let subId = ''
        if (existing?.notes) {
            try { const n = JSON.parse(existing.notes); if (n.type === 'substitution' && n.substitute_teacher_id) subId = n.substitute_teacher_id; } catch(e) {}
        }
        setEditForm({
            subject_id: existing?.subject_id || '',
            teacher_id: existing?.teacher_id || '',
            substitute_teacher_id: subId,
            room_number: existing?.room_number || ''
        })
        setConflictError(null)
        setEditingCell({ day, slotId })
    }

    async function saveEntry() {
        if (!editingCell || !selectedClassId || !selectedSectionId) return

        setSaving(true)
        setConflictError(null)

        try {
            const existingEntry = getEntry(editingCell.day, editingCell.slotId)

            if (editForm.subject_id) {
                let effectiveTeacherId = editForm.substitute_teacher_id || editForm.teacher_id;
                // ── Teacher conflict check ──
                if (effectiveTeacherId) {
                    const { data: allSlotEntries } = await supabase
                        .from('timetable_entries')
                        .select('entry_id, class_id, section_id, notes, teacher_id, classes:class_id(name), sections:section_id(name)')
                        .eq('day_of_week', editingCell.day)
                        .eq('slot_id', editingCell.slotId)

                    // Filter out the current entry being edited (same class+section)
                    const otherConflicts = (allSlotEntries || []).filter((c: any) => {
                        if (c.class_id === selectedClassId && c.section_id === selectedSectionId) return false;
                        let cid = c.teacher_id;
                        if (c.notes) {
                            try { const n = JSON.parse(c.notes); if (n.type === 'substitution' && n.substitute_teacher_id) cid = n.substitute_teacher_id; } catch(e){}
                        }
                        return cid === effectiveTeacherId;
                    })

                    if (otherConflicts.length > 0) {
                        const conflict = otherConflicts[0] as any
                        const className = conflict.classes?.name || 'another class'
                        const sectionName = conflict.sections?.name || ''
                        const teacherName = teachers.find(t => t.user_id === effectiveTeacherId)?.full_name || 'This teacher'
                        const slotObj = slots.find(s => s.slot_id === editingCell.slotId)
                        const slotLabel = slotObj ? `${slotObj.slot_name} (${formatTime(slotObj.start_time)} - ${formatTime(slotObj.end_time)})` : 'this period'

                        setConflictError(
                            `❌ Cannot assign ${teacherName} — already teaching ${className}${sectionName ? ` (${sectionName})` : ''} on ${DAYS[editingCell.day]} during ${slotLabel}. Clear that assignment first.`
                        )
                        setSaving(false)
                        return
                    }
                }

                // Upsert entry
                const notesObj = editForm.substitute_teacher_id 
                    ? { type: 'substitution', substitute_teacher_id: editForm.substitute_teacher_id } 
                    : null;
                const entryData = {
                    class_id: selectedClassId,
                    section_id: selectedSectionId,
                    day_of_week: editingCell.day,
                    slot_id: editingCell.slotId,
                    subject_id: editForm.subject_id || null,
                    teacher_id: editForm.teacher_id || null,
                    room_number: editForm.room_number || null,
                    notes: notesObj ? JSON.stringify(notesObj) : null
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

            // Reload timetable + re-check conflicts
            await loadTimetable()
            await detectAllConflicts()
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
                            onClick={goBack}
                            className="p-2 hover:bg-white rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Timetable</h1>
                            <p className="text-gray-600">Manage class schedules and teacher assignments</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Conflict warning button */}
                        <button
                            onClick={() => {
                                detectAllConflicts()
                                setShowConflictPanel(true)
                            }}
                            className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-all ${conflicts.length > 0
                                ? 'bg-red-100 text-red-700 border-2 border-red-300 hover:bg-red-200 animate-pulse'
                                : 'bg-green-100 text-green-700 border border-green-300 hover:bg-green-200'
                                }`}
                        >
                            {conflicts.length > 0 ? (
                                <>
                                    <ShieldAlert className="w-5 h-5" />
                                    {conflicts.length} Conflict{conflicts.length > 1 ? 's' : ''} Found
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-5 h-5" />
                                    No Conflicts
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => router.push('/dashboard/manage/timetable/settings')}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
                        >
                            <Clock className="w-5 h-5" />
                            Configure Time Slots
                        </button>
                    </div>
                </div>

                {/* ═══ Conflict Warning Banner ═══ */}
                {conflicts.length > 0 && !showConflictPanel && (
                    <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <ShieldAlert className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <p className="font-bold text-red-800">
                                    ⚠️ {conflicts.length} Teacher Schedule Conflict{conflicts.length > 1 ? 's' : ''} Detected
                                </p>
                                <p className="text-sm text-red-600">
                                    Same teacher assigned to different classes at the same time. This must be resolved.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowConflictPanel(true)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                        >
                            View & Fix
                        </button>
                    </div>
                )}

                {/* ═══ Conflict Resolution Panel (Modal-like Slide) ═══ */}
                {showConflictPanel && (
                    <div className="bg-white border-2 border-red-200 rounded-2xl shadow-2xl mb-6 overflow-hidden">
                        <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white p-5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <ShieldAlert className="w-6 h-6" />
                                <div>
                                    <h2 className="text-lg font-bold">Teacher Schedule Conflicts</h2>
                                    <p className="text-sm text-red-100">
                                        {conflicts.length > 0
                                            ? `${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''} — same teacher assigned to multiple classes at the same time`
                                            : 'No conflicts detected! All clear ✅'
                                        }
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {conflicts.length > 0 && (
                                    <button
                                        onClick={autoFixAllConflicts}
                                        disabled={conflictLoading}
                                        className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
                                    >
                                        {conflictLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Zap className="w-4 h-4" />
                                        )}
                                        Auto-Fix All
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowConflictPanel(false)}
                                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {conflictLoading ? (
                            <div className="p-8 text-center">
                                <Loader2 className="w-8 h-8 animate-spin text-red-400 mx-auto" />
                                <p className="text-gray-500 mt-2">Scanning timetable...</p>
                            </div>
                        ) : conflicts.length === 0 ? (
                            <div className="p-8 text-center">
                                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                                <p className="text-lg font-bold text-gray-900">All Clear!</p>
                                <p className="text-gray-500 text-sm">No teacher scheduling conflicts found.</p>
                            </div>
                        ) : (
                            <div className="p-5 space-y-4 max-h-[480px] overflow-y-auto">
                                {conflicts.map((group, idx) => (
                                    <div key={idx} className="border-2 border-red-100 rounded-xl overflow-hidden">
                                        {/* Conflict header */}
                                        <div className="bg-red-50 p-4 flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-red-800 flex items-center gap-2">
                                                    <AlertTriangle className="w-4 h-4" />
                                                    {group.teacher_name}
                                                </p>
                                                <p className="text-sm text-red-600">
                                                    {DAYS[group.day_of_week]} • {group.slot_name} ({group.slot_time})
                                                </p>
                                            </div>
                                            <span className="px-3 py-1 bg-red-200 text-red-800 rounded-full text-xs font-bold">
                                                {group.entries.length} classes at same time
                                            </span>
                                        </div>

                                        {/* Conflicting entries */}
                                        <div className="divide-y divide-red-50">
                                            {group.entries.map((entry, entryIdx) => (
                                                <div key={entry.entry_id} className="p-4 flex items-center justify-between hover:bg-red-25">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${entryIdx === 0
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-red-100 text-red-700'
                                                            }`}>
                                                            {entryIdx === 0 ? '✓' : entryIdx + 1}
                                                        </span>
                                                        <div>
                                                            <p className="font-medium text-gray-900">
                                                                {entry.class_name} {entry.section_name && `(${entry.section_name})`}
                                                            </p>
                                                            <p className="text-sm text-gray-500">{entry.subject_name}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {entryIdx === 0 ? (
                                                            <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                                                                Keep
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() => resolveConflict(entry.entry_id)}
                                                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 flex items-center gap-1 transition-colors"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                                Remove
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

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
                        <p className="text-gray-500 mb-4">Set up your school&apos;s daily periods and breaks</p>
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
                                                const cellConflict = getCellConflict(day, slot.slot_id)

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
                                                            <div className="space-y-1 p-2 bg-orange-50 rounded-lg">
                                                                <div className="mb-2">
                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Subject</label>
                                                                    <select
                                                                        value={editForm.subject_id}
                                                                        onChange={(e) => setEditForm(f => ({ ...f, subject_id: e.target.value }))}
                                                                        className="w-full p-1.5 border border-orange-200 rounded text-sm text-gray-900 focus:ring-1 focus:ring-orange-500 transition-shadow"
                                                                    >
                                                                        <option value="">No Subject</option>
                                                                        {subjects.map(s => (
                                                                            <option key={s.subject_id} value={s.subject_id}>{s.name}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div className="mb-2">
                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Primary Teacher</label>
                                                                    <select
                                                                        value={editForm.teacher_id}
                                                                        onChange={(e) => setEditForm(f => ({ ...f, teacher_id: e.target.value }))}
                                                                        className="w-full p-1.5 border border-orange-200 rounded text-sm text-gray-900 focus:ring-1 focus:ring-orange-500 transition-shadow"
                                                                    >
                                                                        <option value="">No Teacher</option>
                                                                        {teachers.map(t => (
                                                                            <option key={t.user_id} value={t.user_id}>{t.full_name}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div className="mb-3 pt-2 border-t border-orange-200/60">
                                                                    <label className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1 flex items-center gap-1"><Users className="w-3 h-3"/> Override: Substitute</label>
                                                                    <select
                                                                        value={editForm.substitute_teacher_id}
                                                                        onChange={(e) => setEditForm(f => ({ ...f, substitute_teacher_id: e.target.value }))}
                                                                        className="w-full p-1.5 border border-purple-200 bg-purple-50 rounded text-sm text-purple-900 focus:ring-1 focus:ring-purple-500 transition-shadow"
                                                                    >
                                                                        <option value="">No Substitution</option>
                                                                        {teachers.map(t => (
                                                                            <option key={t.user_id} value={t.user_id}>{t.full_name}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                {/* Conflict error message */}
                                                                {conflictError && (
                                                                    <div className="flex items-start gap-1.5 p-2 bg-red-50 border border-red-200 rounded-lg">
                                                                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                                                        <p className="text-[11px] text-red-700 font-medium leading-tight">{conflictError}</p>
                                                                    </div>
                                                                )}
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        onClick={saveEntry}
                                                                        disabled={saving}
                                                                        className="flex-1 py-1 bg-green-600 text-white rounded text-xs font-medium"
                                                                    >
                                                                        {saving ? '...' : 'Save'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setEditingCell(null); setConflictError(null) }}
                                                                        className="flex-1 py-1 bg-gray-400 text-white rounded text-xs font-medium"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div
                                                                onClick={() => startEdit(day, slot.slot_id)}
                                                                className={`p-2 rounded-lg cursor-pointer transition-all min-h-[60px] relative ${entry
                                                                    ? cellConflict
                                                                        ? 'bg-gradient-to-br from-red-100 to-red-50 border-2 border-red-400 hover:shadow-md ring-2 ring-red-200'
                                                                        : 'bg-gradient-to-br from-orange-100 to-amber-100 border border-orange-200 hover:shadow-md'
                                                                    : 'bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300'
                                                                    }`}
                                                            >
                                                                {entry ? (
                                                                    <>
                                                                        <div className={`text-sm font-semibold ${cellConflict ? 'text-red-800' : 'text-orange-800'}`}>
                                                                            {entry.subjects?.name || 'Subject'}
                                                                        </div>
                                                                        <div className={`text-xs ${cellConflict ? 'text-red-600' : 'text-orange-600'}`}>
                                                                            {(entry as any).users?.is_substitute && <span className="text-[10px] uppercase font-bold text-purple-600 bg-purple-100 px-1 py-0.5 rounded shadow-sm mr-1">SUB</span>}
                                                                            {entry.users?.full_name || 'No teacher'}
                                                                        </div>
                                                                        {/* Conflict badge on cell */}
                                                                        {cellConflict && (
                                                                            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center" title={`Conflict: ${cellConflict.teacher_name} is also assigned to ${cellConflict.entries.filter(e => e.entry_id !== entry.entry_id).map(e => e.class_name).join(', ')} at the same time`}>
                                                                                <AlertTriangle className="w-3 h-3 text-white" />
                                                                            </div>
                                                                        )}
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

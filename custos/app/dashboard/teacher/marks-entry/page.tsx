'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Edit3, Save, Loader2, Users, BookOpen,
    GraduationCap, CheckCircle, AlertCircle, ChevronRight
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────

interface TimetableAssignment {
    class_id: string
    class_name: string
    grade_level: number
    section_id: string
    section_name: string
    subject_id: string
    subject_name: string
}

interface Student {
    user_id: string
    full_name: string
}

interface Exam {
    exam_id: string
    name: string
    status: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exam_types?: any
}

interface Mark {
    student_id: string
    subject_id: string
    marks_obtained: number
    max_marks: number
    grade: string
}

// ─── Component ───────────────────────────────────────────

export default function TeacherMarksEntryPage() {
    const { goBack, router } = useSmartBack('/dashboard/teacher')

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [teacherId, setTeacherId] = useState('')

    // Timetable-derived data
    const [assignments, setAssignments] = useState<TimetableAssignment[]>([])
    const [students, setStudents] = useState<Student[]>([])
    const [exams, setExams] = useState<Exam[]>([])
    const [marks, setMarks] = useState<Record<string, Record<string, Mark>>>({}) // student_id -> subject_id -> Mark

    // Selections
    const [selectedClassId, setSelectedClassId] = useState('')
    const [selectedSectionId, setSelectedSectionId] = useState('')
    const [selectedExamId, setSelectedExamId] = useState('')
    const [savedStudentIds, setSavedStudentIds] = useState<Set<string>>(new Set())

    // ─── Derived lists from assignments ──────────────────

    // Unique classes this teacher is assigned to
    const assignedClasses = useMemo(() => {
        const seen = new Set<string>()
        return assignments
            .filter(a => { if (seen.has(a.class_id)) return false; seen.add(a.class_id); return true })
            .sort((a, b) => a.grade_level - b.grade_level)
            .map(a => ({ class_id: a.class_id, name: a.class_name, grade_level: a.grade_level }))
    }, [assignments])

    // Sections for selected class
    const assignedSections = useMemo(() => {
        const seen = new Set<string>()
        return assignments
            .filter(a => a.class_id === selectedClassId)
            .filter(a => { if (seen.has(a.section_id)) return false; seen.add(a.section_id); return true })
            .sort((a, b) => a.section_name.localeCompare(b.section_name))
            .map(a => ({ section_id: a.section_id, name: a.section_name }))
    }, [assignments, selectedClassId])

    // Subjects for selected class + section (the teacher's subjects only)
    const assignedSubjects = useMemo(() => {
        const seen = new Set<string>()
        return assignments
            .filter(a => a.class_id === selectedClassId && a.section_id === selectedSectionId)
            .filter(a => { if (seen.has(a.subject_id)) return false; seen.add(a.subject_id); return true })
            .sort((a, b) => a.subject_name.localeCompare(b.subject_name))
            .map(a => ({ subject_id: a.subject_id, name: a.subject_name }))
    }, [assignments, selectedClassId, selectedSectionId])

    // ─── Effects ─────────────────────────────────────────

    useEffect(() => { initPage() }, [])

    useEffect(() => {
        setSelectedSectionId('')
        setSelectedExamId('')
        setStudents([])
        setMarks({})
        setSavedStudentIds(new Set())
    }, [selectedClassId])

    useEffect(() => {
        if (selectedSectionId) {
            loadStudents()
        } else {
            setStudents([])
            setMarks({})
        }
        setSelectedExamId('')
        setSavedStudentIds(new Set())
    }, [selectedSectionId])

    useEffect(() => {
        if (selectedExamId && students.length > 0 && assignedSubjects.length > 0) {
            loadMarks()
        }
    }, [selectedExamId, students, assignedSubjects])

    // ─── Init ────────────────────────────────────────────

    async function initPage() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return }

            const { data: userData } = await supabase
                .from('users')
                .select('user_id, role')
                .eq('email', session.user.email)
                .single()

            if (!userData || userData.role !== 'teacher') {
                router.replace('/dashboard/redirect')
                return
            }

            setTeacherId(userData.user_id)

            await Promise.all([
                loadAssignments(userData.user_id),
                loadExams(),
            ])
        } catch (err) {
            console.error('Init error:', err)
        } finally {
            setLoading(false)
        }
    }

    // ─── Data Loading ─────────────────────────────────────

    async function loadAssignments(tid: string) {
        // 1. Fetch timetable entries for this teacher (flat, no joins)
        const { data: entries, error } = await supabase
            .from('timetable_entries')
            .select('class_id, section_id, subject_id')
            .eq('teacher_id', tid)

        if (error) { console.error('Assignment load error:', error); return }
        if (!entries || entries.length === 0) { setAssignments([]); return }

        // 2. Collect unique IDs
        const classIds = [...new Set(entries.map(e => e.class_id).filter(Boolean))]
        const sectionIds = [...new Set(entries.map(e => e.section_id).filter(Boolean))]
        const subjectIds = [...new Set(entries.map(e => e.subject_id).filter(Boolean))]

        // 3. Fetch names in parallel
        const [classRes, sectionRes, subjectRes] = await Promise.all([
            classIds.length > 0
                ? supabase.from('classes').select('class_id, name, grade_level').in('class_id', classIds)
                : { data: [] },
            sectionIds.length > 0
                ? supabase.from('sections').select('section_id, name').in('section_id', sectionIds)
                : { data: [] },
            subjectIds.length > 0
                ? supabase.from('subjects').select('subject_id, name').in('subject_id', subjectIds)
                : { data: [] },
        ])

        const classMap = new Map((classRes.data || []).map((c: any) => [c.class_id, c]))
        const sectionMap = new Map((sectionRes.data || []).map((s: any) => [s.section_id, s]))
        const subjectMap = new Map((subjectRes.data || []).map((s: any) => [s.subject_id, s]))

        // 4. Deduplicate & merge
        const seen = new Set<string>()
        const mapped: TimetableAssignment[] = []
        for (const row of entries) {
            const key = `${row.class_id}:${row.section_id}:${row.subject_id}`
            if (seen.has(key)) continue
            seen.add(key)

            const cls = classMap.get(row.class_id)
            const sec = sectionMap.get(row.section_id)
            const sub = subjectMap.get(row.subject_id)
            if (!cls || !sec || !sub) continue

            mapped.push({
                class_id: row.class_id,
                class_name: cls.name,
                grade_level: cls.grade_level,
                section_id: row.section_id,
                section_name: sec.name,
                subject_id: row.subject_id,
                subject_name: sub.name,
            })
        }
        setAssignments(mapped)
    }

    async function loadExams() {
        const { data } = await supabase
            .from('exams')
            .select('exam_id, name, status, exam_types(name, short_code)')
            .in('status', ['ongoing', 'scheduled', 'completed'])
            .order('created_at', { ascending: false })
        setExams(data || [])
    }

    async function loadStudents() {
        const { data } = await supabase
            .from('users')
            .select('user_id, full_name')
            .eq('role', 'student')
            .eq('section_id', selectedSectionId)
            .order('full_name', { ascending: true })
        setStudents(data || [])
    }

    async function loadMarks() {
        if (assignedSubjects.length === 0 || students.length === 0) return

        const subjectIds = assignedSubjects.map(s => s.subject_id)

        const { data } = await supabase
            .from('student_marks')
            .select('*')
            .eq('exam_id', selectedExamId)
            .in('subject_id', subjectIds)
            .in('student_id', students.map(s => s.user_id))

        // Build marks map: student_id -> subject_id -> Mark
        const marksMap: Record<string, Record<string, Mark>> = {}

        // Detect max_marks per subject from existing entries (admin may have set custom values)
        const detectedMax: Record<string, number> = {}
        assignedSubjects.forEach(sub => {
            const existingMark = data?.find(m => m.subject_id === sub.subject_id && m.max_marks > 0)
            detectedMax[sub.subject_id] = existingMark?.max_marks || 100
        })

        // Initialize empty marks for every student x every assigned subject
        students.forEach(s => {
            marksMap[s.user_id] = {}
            assignedSubjects.forEach(sub => {
                marksMap[s.user_id][sub.subject_id] = {
                    student_id: s.user_id,
                    subject_id: sub.subject_id,
                    marks_obtained: 0,
                    max_marks: detectedMax[sub.subject_id] || 100,
                    grade: ''
                }
            })
        })

        // Fill in existing marks from DB
        data?.forEach(m => {
            if (!marksMap[m.student_id]) marksMap[m.student_id] = {}
            marksMap[m.student_id][m.subject_id] = {
                student_id: m.student_id,
                subject_id: m.subject_id,
                marks_obtained: m.marks_obtained,
                max_marks: m.max_marks || 100,
                grade: m.grade || ''
            }
        })

        // Pre-fill already saved student IDs
        const saved = new Set(data?.map(m => m.student_id) || [])
        setSavedStudentIds(saved)
        setMarks(marksMap)
    }

    // ─── Marks Helpers ────────────────────────────────────

    function calculateGrade(obtained: number, maxMarks: number = 100): string {
        const pct = maxMarks > 0 ? (obtained / maxMarks) * 100 : 0
        if (pct >= 90) return 'A+'
        if (pct >= 80) return 'A'
        if (pct >= 70) return 'B+'
        if (pct >= 60) return 'B'
        if (pct >= 50) return 'C+'
        if (pct >= 40) return 'C'
        if (pct >= 33) return 'D'
        return 'F'
    }

    function getGradeColor(grade: string): string {
        switch (grade) {
            case 'A+': case 'A': return 'text-emerald-600 bg-emerald-50'
            case 'B+': case 'B': return 'text-blue-600 bg-blue-50'
            case 'C+': case 'C': return 'text-amber-600 bg-amber-50'
            case 'D': return 'text-orange-600 bg-orange-50'
            case 'F': return 'text-red-600 bg-red-50'
            default: return 'text-gray-500 bg-gray-50'
        }
    }

    function updateMark(studentId: string, value: number, subjectId: string) {
        setMarks(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [subjectId]: {
                    ...(prev[studentId]?.[subjectId] || {}),
                    student_id: studentId,
                    subject_id: subjectId,
                    marks_obtained: value,
                    max_marks: prev[studentId]?.[subjectId]?.max_marks || 100,
                    grade: calculateGrade(value, prev[studentId]?.[subjectId]?.max_marks || 100)
                }
            }
        }))
    }

    // ─── Save Marks ───────────────────────────────────────

    async function saveMarks(subjectId: string) {
        if (!selectedExamId || !subjectId) return
        setSaving(true)
        try {
            const toSave = Object.entries(marks)
                .map(([studentId, subjectMap]) => subjectMap[subjectId])
                .filter(m => m && m.marks_obtained > 0)
                .map(m => ({
                    student_id: m.student_id,
                    exam_id: selectedExamId,
                    subject_id: subjectId,
                    marks_obtained: m.marks_obtained,
                    max_marks: m.max_marks || 100,
                    grade: m.grade || calculateGrade(m.marks_obtained, m.max_marks || 100),
                    entered_by: teacherId
                }))

            if (toSave.length === 0) {
                alert('No marks entered yet')
                setSaving(false)
                return
            }

            const { error } = await supabase
                .from('student_marks')
                .upsert(toSave, { onConflict: 'student_id,exam_id,subject_id', ignoreDuplicates: false })

            if (error) throw error

            const newSaved = new Set(savedStudentIds)
            toSave.forEach(m => newSaved.add(m.student_id))
            setSavedStudentIds(newSaved)

            alert(`✅ Marks saved for ${toSave.length} students!`)
        } catch (err: any) {
            alert('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    // ─── Render ──────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            </div>
        )
    }

    const selectedExam = exams.find(e => e.exam_id === selectedExamId)
    const isReadyForMarks = selectedClassId && selectedSectionId && selectedExamId && assignedSubjects.length > 0 && students.length > 0

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            {/* Header */}
            <header className="bg-white border-b shadow-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Edit3 className="w-5 h-5 text-indigo-600" />
                            Marks Entry
                        </h1>
                        <p className="text-sm text-gray-500">Enter marks for your assigned subjects</p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6 space-y-6">

                {/* ─── No Assignments Warning ─── */}
                {assignments.length === 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
                        <AlertCircle className="w-6 h-6 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <h3 className="font-semibold text-amber-800">No class assignments found</h3>
                            <p className="text-sm text-amber-600 mt-1">
                                You haven&apos;t been assigned to any class subjects yet. Please contact your admin to set up your timetable.
                            </p>
                        </div>
                    </div>
                )}

                {/* ─── Filters ─── */}
                <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
                    <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-indigo-500" />
                        Select Class, Section &amp; Exam
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Class */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Class</label>
                            <select
                                value={selectedClassId}
                                onChange={e => setSelectedClassId(e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-indigo-300 outline-none"
                            >
                                <option value="">Select Class</option>
                                {assignedClasses.map(c => (
                                    <option key={c.class_id} value={c.class_id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Section */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Section</label>
                            <select
                                value={selectedSectionId}
                                onChange={e => setSelectedSectionId(e.target.value)}
                                disabled={!selectedClassId}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-indigo-300 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="">Select Section</option>
                                {assignedSections.map(s => (
                                    <option key={s.section_id} value={s.section_id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Exam */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Exam</label>
                            <select
                                value={selectedExamId}
                                onChange={e => setSelectedExamId(e.target.value)}
                                disabled={!selectedSectionId}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-indigo-300 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="">Select Exam</option>
                                {exams.map(e => (
                                    <option key={e.exam_id} value={e.exam_id}>
                                        {e.name} ({e.exam_types?.short_code || e.exam_types?.name})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Assigned subjects info chip */}
                    {selectedSectionId && assignedSubjects.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            <span className="text-xs text-gray-500 mr-1 mt-1 font-medium">Your subjects:</span>
                            {assignedSubjects.map(s => (
                                <span
                                    key={s.subject_id}
                                    className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold flex items-center gap-1"
                                >
                                    <BookOpen className="w-3 h-3" />
                                    {s.name}
                                </span>
                            ))}
                        </div>
                    )}

                    {selectedSectionId && assignedSubjects.length === 0 && (
                        <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">
                            ⚠️ No subjects assigned for this section. Your timetable may not be configured.
                        </p>
                    )}
                </div>

                {/* ─── Marks Entry per Subject ─── */}
                {!isReadyForMarks ? (
                    <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                        <GraduationCap className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Ready to Enter Marks?</h3>
                        <p className="text-gray-500 text-sm">Select a class, section, and exam to begin</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {assignedSubjects.map(subject => {
                            const enteredCount = students.filter(
                                s => (marks[s.user_id]?.[subject.subject_id]?.marks_obtained || 0) > 0
                            ).length

                            return (
                                <div key={subject.subject_id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                    {/* Subject Header */}
                                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                                                <BookOpen className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-white font-bold">{subject.name}</h3>
                                                <p className="text-indigo-200 text-xs">
                                                    {enteredCount}/{students.length} marks entered
                                                    {selectedExam && ` · ${selectedExam.name}`}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => saveMarks(subject.subject_id)}
                                            disabled={saving || enteredCount === 0}
                                            className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 rounded-xl text-sm font-semibold hover:bg-indigo-50 disabled:opacity-50 transition-colors shadow-sm"
                                        >
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Save
                                        </button>
                                    </div>

                                    {/* Student List */}
                                    <div className="divide-y divide-gray-100">
                                        {students.map((student, idx) => {
                                            const studentMark = marks[student.user_id]?.[subject.subject_id]
                                            const marksObtained = studentMark?.marks_obtained || 0
                                            const maxMarks = studentMark?.max_marks || 100
                                            const grade = marksObtained > 0 ? calculateGrade(marksObtained, maxMarks) : ''
                                            const isSaved = savedStudentIds.has(student.user_id)

                                            return (
                                                <div
                                                    key={student.user_id}
                                                    className="flex items-center justify-between px-6 py-3 hover:bg-indigo-50/40 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs flex-shrink-0">
                                                            {idx + 1}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-gray-900 text-sm">{student.full_name}</p>
                                                            {isSaved && marksObtained > 0 && (
                                                                <p className="text-xs text-emerald-600 flex items-center gap-1">
                                                                    <CheckCircle className="w-3 h-3" /> Saved
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={maxMarks}
                                                                value={marksObtained || ''}
                                                                onChange={e => updateMark(
                                                                    student.user_id,
                                                                    parseFloat(e.target.value) || 0,
                                                                    subject.subject_id
                                                                )}
                                                                className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-center text-gray-900 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
                                                                placeholder="0"
                                                            />
                                                            <span className="text-gray-400 text-sm">/ {maxMarks}</span>
                                                        </div>
                                                        {grade ? (
                                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold min-w-[2.5rem] text-center ${getGradeColor(grade)}`}>
                                                                {grade}
                                                            </span>
                                                        ) : (
                                                            <span className="w-10" />
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Subject Footer Save */}
                                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                                        <button
                                            onClick={() => saveMarks(subject.subject_id)}
                                            disabled={saving || enteredCount === 0}
                                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                                        >
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Save {subject.name} Marks ({enteredCount} students)
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>
        </div>
    )
}

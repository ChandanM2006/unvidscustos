'use client'

import { useState, useEffect } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, FileText, Users, Plus,
    Award, Loader2, Sparkles,
    Calendar, Edit3, Trash2, Save, X,
    ChevronDown, BookOpen, ClipboardList,
    BarChart3, GraduationCap, AlertCircle, Send,
    CheckCircle, Clock, XCircle
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────

interface ClassItem {
    class_id: string
    name: string
    grade_level: number
}

interface Section {
    section_id: string
    class_id: string
    name: string
}

interface Subject {
    subject_id: string
    name: string
}

interface Student {
    user_id: string
    full_name: string
    email: string
}

interface ExamType {
    exam_type_id: string
    name: string
    short_code: string
    weightage: number
    is_active: boolean
}

interface Exam {
    exam_id: string
    exam_type_id: string
    academic_year_id: string | null
    name: string
    start_date: string | null
    end_date: string | null
    status: string
    exam_types?: { name: string; short_code: string }
}

interface Mark {
    student_id: string
    subject_id: string
    marks_obtained: number
    max_marks: number
    grade: string
}

type TabView = 'exams' | 'results'

// ─── Component ───────────────────────────────────────────

export default function ReportCardsPage() {
    const { goBack, router } = useSmartBack('/dashboard/manage')

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [userId, setUserId] = useState('')
    const [schoolId, setSchoolId] = useState('')

    // Data
    const [classes, setClasses] = useState<ClassItem[]>([])
    const [sections, setSections] = useState<Section[]>([])
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [students, setStudents] = useState<Student[]>([])
    const [examTypes, setExamTypes] = useState<ExamType[]>([])
    const [exams, setExams] = useState<Exam[]>([])
    const [marks, setMarks] = useState<Record<string, Record<string, Mark>>>({})
    const [maxMarksConfig, setMaxMarksConfig] = useState<Record<string, number>>({})
    const [savingMaxMarks, setSavingMaxMarks] = useState(false)

    // Selection
    const [selectedClassId, setSelectedClassId] = useState('')
    const [selectedSectionId, setSelectedSectionId] = useState('')
    const [selectedExamId, setSelectedExamId] = useState('')

    // View
    const [activeTab, setActiveTab] = useState<TabView>('exams')

    // Create Exam Type Modal
    const [showCreateType, setShowCreateType] = useState(false)
    const [newTypeName, setNewTypeName] = useState('')
    const [newTypeCode, setNewTypeCode] = useState('')

    // Create Exam Modal
    const [showCreateExam, setShowCreateExam] = useState(false)
    const [newExamName, setNewExamName] = useState('')
    const [newExamTypeId, setNewExamTypeId] = useState('')
    const [newExamStartDate, setNewExamStartDate] = useState('')
    const [newExamEndDate, setNewExamEndDate] = useState('')

    // ─── Init ────────────────────────────────────────────

    useEffect(() => {
        initPage()
    }, [])

    useEffect(() => {
        if (selectedClassId) {
            loadSections()
            setSelectedSectionId('')
            setSubjects([])
            setStudents([])
        }
    }, [selectedClassId])

    useEffect(() => {
        if (selectedSectionId) {
            loadStudents()
            loadSubjects()
        }
    }, [selectedSectionId])

    useEffect(() => {
        if (selectedClassId && selectedSectionId && selectedExamId && students.length > 0 && subjects.length > 0) {
            loadMarks()
        }
    }, [selectedClassId, selectedSectionId, selectedExamId, students, subjects])

    async function initPage() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return }

            const { data: userData } = await supabase
                .from('users')
                .select('user_id, role, school_id')
                .eq('email', session.user.email)
                .single()

            if (!userData || !['super_admin', 'sub_admin'].includes(userData.role)) {
                router.replace('/dashboard/redirect')
                return
            }

            setUserId(userData.user_id)
            setSchoolId(userData.school_id || '')

            await Promise.all([
                loadClasses(),
                loadExamTypes(userData.school_id),
                loadExams(),
            ])
        } catch (error) {
            console.error('Init error:', error)
        } finally {
            setLoading(false)
        }
    }

    // ─── Data Loading ────────────────────────────────────

    async function loadClasses() {
        const { data } = await supabase
            .from('classes')
            .select('class_id, name, grade_level')
            .order('grade_level', { ascending: true })
        setClasses(data || [])
    }

    async function loadExamTypes(sid?: string) {
        const query = supabase.from('exam_types').select('*').order('created_at', { ascending: true })
        const { data } = sid ? await query.eq('school_id', sid) : await query
        setExamTypes(data || [])
    }

    async function loadExams() {
        const { data } = await supabase
            .from('exams')
            .select('*, exam_types(name, short_code)')
            .order('created_at', { ascending: false })
        setExams(data || [])
    }

    async function loadSections() {
        const { data } = await supabase
            .from('sections')
            .select('section_id, class_id, name')
            .eq('class_id', selectedClassId)
            .order('name', { ascending: true })
        setSections(data || [])
    }

    async function loadStudents() {
        if (selectedSectionId) {
            const { data } = await supabase
                .from('users')
                .select('user_id, full_name, email')
                .eq('role', 'student')
                .eq('section_id', selectedSectionId)
                .order('full_name', { ascending: true })
            setStudents(data || [])
        } else {
            const { data } = await supabase
                .from('users')
                .select('user_id, full_name, email')
                .eq('role', 'student')
                .eq('class_id', selectedClassId)
                .order('full_name', { ascending: true })
            setStudents(data || [])
        }
    }

    async function loadSubjects() {
        if (!selectedSectionId) {
            setSubjects([])
            return
        }

        // Try class_section_subjects first
        const { data: cssData } = await supabase
            .from('class_section_subjects')
            .select('subjects(subject_id, name)')
            .eq('section_id', selectedSectionId)

        let mapped: Subject[] = []
        if (cssData) {
            mapped = cssData
                .map((item: any) => item.subjects)
                .filter(Boolean) as Subject[]
        }

        // Fallback: also pull from timetable_entries for this class+section
        if (mapped.length === 0 && selectedClassId) {
            const { data: ttData } = await supabase
                .from('timetable_entries')
                .select('subject_id')
                .eq('class_id', selectedClassId)
                .eq('section_id', selectedSectionId)

            if (ttData && ttData.length > 0) {
                const uniqueSubjectIds = [...new Set(ttData.map(t => t.subject_id).filter(Boolean))]
                if (uniqueSubjectIds.length > 0) {
                    const { data: subData } = await supabase
                        .from('subjects')
                        .select('subject_id, name')
                        .in('subject_id', uniqueSubjectIds)
                    mapped = (subData || []) as Subject[]
                }
            }
        }

        mapped.sort((a, b) => a.name.localeCompare(b.name))
        setSubjects(mapped)
    }

    async function loadMarks() {
        const { data } = await supabase
            .from('student_marks')
            .select('*')
            .eq('exam_id', selectedExamId)
            .in('student_id', students.map(s => s.user_id))

        // Detect max_marks per subject from existing data or default to 100
        const detectedMax: Record<string, number> = {}
        subjects.forEach(sub => {
            const existingMark = data?.find(m => m.subject_id === sub.subject_id && m.max_marks > 0)
            detectedMax[sub.subject_id] = maxMarksConfig[sub.subject_id] || existingMark?.max_marks || 100
        })
        setMaxMarksConfig(prev => ({ ...detectedMax, ...prev }))

        const marksMap: Record<string, Record<string, Mark>> = {}
        students.forEach(s => {
            marksMap[s.user_id] = {}
            subjects.forEach(sub => {
                const mark = data?.find(m => m.student_id === s.user_id && m.subject_id === sub.subject_id)
                const maxM = detectedMax[sub.subject_id] || 100
                marksMap[s.user_id][sub.subject_id] = mark ? {
                    ...mark,
                    max_marks: maxM
                } : {
                    student_id: s.user_id,
                    subject_id: sub.subject_id,
                    marks_obtained: 0,
                    max_marks: maxM,
                    grade: ''
                }
            })
        })
        setMarks(marksMap)
    }

    async function saveMaxMarks() {
        if (!selectedExamId) return
        setSavingMaxMarks(true)
        try {
            // Update max_marks for all existing student_marks entries for each subject
            for (const sub of subjects) {
                const newMax = maxMarksConfig[sub.subject_id] || 100
                await supabase
                    .from('student_marks')
                    .update({ max_marks: newMax })
                    .eq('exam_id', selectedExamId)
                    .eq('subject_id', sub.subject_id)
            }

            // Also update local marks state
            setMarks(prev => {
                const updated = { ...prev }
                Object.keys(updated).forEach(studentId => {
                    Object.keys(updated[studentId]).forEach(subId => {
                        const newMax = maxMarksConfig[subId] || 100
                        updated[studentId][subId] = {
                            ...updated[studentId][subId],
                            max_marks: newMax,
                            grade: calculateGrade(updated[studentId][subId].marks_obtained, newMax)
                        }
                    })
                })
                return updated
            })

            alert('✅ Max marks updated for all subjects!')
        } catch (err: any) {
            alert('Error: ' + err.message)
        } finally {
            setSavingMaxMarks(false)
        }
    }

    // ─── Create Exam Type ────────────────────────────────

    async function handleCreateExamType() {
        if (!newTypeName.trim()) return
        setSaving(true)
        try {
            const { error } = await supabase.from('exam_types').insert({
                school_id: schoolId || null,
                name: newTypeName.trim(),
                short_code: newTypeCode.trim() || newTypeName.trim().substring(0, 4).toUpperCase(),
            })
            if (error) throw error
            await loadExamTypes(schoolId)
            setNewTypeName('')
            setNewTypeCode('')
            setShowCreateType(false)
        } catch (err: any) {
            alert('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    // ─── Create Exam ─────────────────────────────────────

    async function handleCreateExam() {
        if (!newExamName.trim() || !newExamTypeId) return
        setSaving(true)
        try {
            const { error } = await supabase.from('exams').insert({
                exam_type_id: newExamTypeId,
                name: newExamName.trim(),
                start_date: newExamStartDate || null,
                end_date: newExamEndDate || null,
                status: 'scheduled',
            })
            if (error) throw error
            await loadExams()
            setNewExamName('')
            setNewExamTypeId('')
            setNewExamStartDate('')
            setNewExamEndDate('')
            setShowCreateExam(false)
        } catch (err: any) {
            alert('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    // ─── Update Exam Status ──────────────────────────────

    async function updateExamStatus(examId: string, status: string) {
        try {
            const { error } = await supabase
                .from('exams')
                .update({ status })
                .eq('exam_id', examId)
            if (error) throw error
            await loadExams()
        } catch (err: any) {
            alert('Error: ' + err.message)
        }
    }

    async function deleteExam(examId: string) {
        if (!confirm('Delete this exam? This will also delete all marks entered for it.')) return
        try {
            const { error } = await supabase.from('exams').delete().eq('exam_id', examId)
            if (error) throw error
            await loadExams()
        } catch (err: any) {
            alert('Error: ' + err.message)
        }
    }

    // ─── Publish Results ─────────────────────────────────

    async function publishResults() {
        if (!selectedExamId) return
        if (!confirm('Publish results? Students and parents will be able to see the marks.')) return

        try {
            await updateExamStatus(selectedExamId, 'completed')
            alert('✅ Results published! Students can now view their marks.')
        } catch (err: any) {
            alert('Error: ' + err.message)
        }
    }

    // ─── Helpers ──────────────────────────────────────────

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

    function getStudentTotal(studentId: string): { obtained: number; max: number; percentage: number; grade: string } {
        const studentMarks = marks[studentId] || {}
        let obtained = 0, max = 0
        Object.values(studentMarks).forEach(m => {
            if (m.marks_obtained > 0) {
                obtained += m.marks_obtained
                max += m.max_marks || 100
            }
        })
        const percentage = max > 0 ? (obtained / max) * 100 : 0
        return { obtained, max, percentage, grade: calculateGrade(obtained, max) }
    }

    function getGradeColor(grade: string): string {
        switch (grade) {
            case 'A+': case 'A': return 'text-emerald-600 bg-emerald-50'
            case 'B+': case 'B': return 'text-blue-600 bg-blue-50'
            case 'C+': case 'C': return 'text-amber-600 bg-amber-50'
            case 'D': return 'text-orange-600 bg-orange-50'
            case 'F': return 'text-red-600 bg-red-50'
            default: return 'text-gray-600 bg-gray-50'
        }
    }

    function getStatusBadge(status: string) {
        switch (status) {
            case 'scheduled':
                return <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">📅 Scheduled</span>
            case 'ongoing':
                return <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">🟡 Ongoing</span>
            case 'completed':
                return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">✅ Published</span>
            case 'cancelled':
                return <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">❌ Cancelled</span>
            default:
                return <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">{status}</span>
        }
    }

    // ─── Completion Stats ─────────────────────────────────
    // For the results tab: which subjects have all marks entered vs pending

    function getSubjectCompletionStats() {
        if (students.length === 0 || subjects.length === 0) return []

        return subjects.map(sub => {
            let entered = 0
            let pending = 0
            students.forEach(s => {
                const mark = marks[s.user_id]?.[sub.subject_id]
                if (mark && mark.marks_obtained > 0) {
                    entered++
                } else {
                    pending++
                }
            })
            return {
                subject: sub,
                entered,
                pending,
                total: students.length,
                isComplete: pending === 0,
            }
        })
    }

    const selectedExam = exams.find(e => e.exam_id === selectedExamId)
    const subjectStats = getSubjectCompletionStats()
    const totalSubjectsComplete = subjectStats.filter(s => s.isComplete).length

    // ─── Render ──────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto" />
                    <p className="text-purple-300 mt-4">Loading Report Cards...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
            {/* Header */}
            <header className="bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0 z-20">
                <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={goBack} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                            <ArrowLeft className="w-5 h-5 text-purple-300" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                <Award className="w-7 h-7 text-amber-400" />
                                Report Cards &amp; Exam Results
                            </h1>
                            <p className="text-sm text-purple-300">Create exams, track progress, publish results</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-6">
                {/* Tab Navigation */}
                <div className="flex gap-2 mb-6">
                    {([
                        { key: 'exams' as TabView, label: 'Manage Exams', icon: Calendar, count: exams.length },
                        { key: 'results' as TabView, label: 'View Results', icon: BarChart3 },
                    ]).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${activeTab === tab.key
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
                                : 'bg-white/5 text-purple-300 hover:bg-white/10 border border-white/10'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${activeTab === tab.key ? 'bg-white/20' : 'bg-white/10'}`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ═══════════════════════════════════════════
                    TAB 1: MANAGE EXAMS
                ═══════════════════════════════════════════ */}
                {activeTab === 'exams' && (
                    <div className="space-y-6">
                        {/* Exam Types Section */}
                        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <ClipboardList className="w-5 h-5 text-indigo-400" />
                                        Exam Types
                                    </h2>
                                    <p className="text-sm text-purple-300/70">Define exam categories like FA, Mid-Sem, Annual, etc.</p>
                                </div>
                                <button
                                    onClick={() => setShowCreateType(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors"
                                >
                                    <Plus className="w-4 h-4" /> Add Type
                                </button>
                            </div>

                            {/* Exam Type Tags */}
                            <div className="flex flex-wrap gap-2">
                                {examTypes.length === 0 ? (
                                    <p className="text-purple-300/50 text-sm">No exam types created yet. Add your first one!</p>
                                ) : examTypes.map(et => (
                                    <div
                                        key={et.exam_type_id}
                                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl"
                                    >
                                        <BookOpen className="w-4 h-4 text-indigo-400" />
                                        <span className="text-white font-medium text-sm">{et.name}</span>
                                        <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded-full">{et.short_code}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Create Type Modal */}
                            {showCreateType && (
                                <div className="mt-4 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                                    <div className="flex items-center gap-3 mb-3">
                                        <input
                                            type="text"
                                            value={newTypeName}
                                            onChange={e => setNewTypeName(e.target.value)}
                                            placeholder="Exam type name (e.g., FA-1, Mid Semester)"
                                            className="flex-1 px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                                        />
                                        <input
                                            type="text"
                                            value={newTypeCode}
                                            onChange={e => setNewTypeCode(e.target.value)}
                                            placeholder="Code (FA1)"
                                            className="w-28 px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                                        />
                                        <button
                                            onClick={handleCreateExamType}
                                            disabled={saving || !newTypeName.trim()}
                                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                                        >
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                                        </button>
                                        <button
                                            onClick={() => { setShowCreateType(false); setNewTypeName(''); setNewTypeCode('') }}
                                            className="p-2.5 hover:bg-white/10 rounded-xl transition-colors"
                                        >
                                            <X className="w-4 h-4 text-purple-300" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Exams List */}
                        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-amber-400" />
                                        Exams
                                    </h2>
                                    <p className="text-sm text-purple-300/70">Create and manage exam instances</p>
                                </div>
                                <button
                                    onClick={() => setShowCreateExam(true)}
                                    disabled={examTypes.length === 0}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    <Plus className="w-4 h-4" /> Create Exam
                                </button>
                            </div>

                            {/* Create Exam Form */}
                            {showCreateExam && (
                                <div className="mb-6 p-5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                    <h3 className="text-white font-semibold mb-3">New Exam</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                        <div>
                                            <label className="block text-xs text-purple-300 mb-1">Exam Name *</label>
                                            <input
                                                type="text"
                                                value={newExamName}
                                                onChange={e => setNewExamName(e.target.value)}
                                                placeholder="e.g., FA-1 March 2026"
                                                className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-purple-300 mb-1">Exam Type *</label>
                                            <select
                                                value={newExamTypeId}
                                                onChange={e => setNewExamTypeId(e.target.value)}
                                                className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-amber-400"
                                            >
                                                <option value="" className="text-gray-900">Select Type</option>
                                                {examTypes.map(et => (
                                                    <option key={et.exam_type_id} value={et.exam_type_id} className="text-gray-900">
                                                        {et.name} ({et.short_code})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-purple-300 mb-1">Start Date</label>
                                            <input
                                                type="date"
                                                value={newExamStartDate}
                                                onChange={e => setNewExamStartDate(e.target.value)}
                                                className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-amber-400"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-purple-300 mb-1">End Date</label>
                                            <input
                                                type="date"
                                                value={newExamEndDate}
                                                onChange={e => setNewExamEndDate(e.target.value)}
                                                className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-amber-400"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-4">
                                        <button
                                            onClick={handleCreateExam}
                                            disabled={saving || !newExamName.trim() || !newExamTypeId}
                                            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
                                        >
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                            Create Exam
                                        </button>
                                        <button
                                            onClick={() => setShowCreateExam(false)}
                                            className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-purple-300 rounded-xl text-sm transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Exams Table */}
                            {exams.length === 0 ? (
                                <div className="text-center py-12">
                                    <Calendar className="w-16 h-16 text-purple-500/30 mx-auto mb-3" />
                                    <p className="text-purple-300/60">No exams created yet</p>
                                    <p className="text-sm text-purple-400/40 mt-1">Create an exam type first, then create an exam</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {exams.map(exam => (
                                        <div
                                            key={exam.exam_id}
                                            className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/[0.07] transition-colors"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl flex items-center justify-center">
                                                    <FileText className="w-6 h-6 text-amber-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-white font-semibold">{exam.name}</h3>
                                                    <div className="flex items-center gap-3 mt-0.5">
                                                        <span className="text-xs text-purple-300/60">
                                                            {exam.exam_types?.name || 'Unknown Type'}
                                                        </span>
                                                        {exam.start_date && (
                                                            <span className="text-xs text-purple-300/40">
                                                                {new Date(exam.start_date).toLocaleDateString()}
                                                                {exam.end_date && ` - ${new Date(exam.end_date).toLocaleDateString()}`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {getStatusBadge(exam.status)}
                                                {exam.status === 'scheduled' && (
                                                    <button
                                                        onClick={() => updateExamStatus(exam.exam_id, 'ongoing')}
                                                        className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-medium transition-colors"
                                                    >
                                                        Start
                                                    </button>
                                                )}
                                                {exam.status === 'ongoing' && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedExamId(exam.exam_id)
                                                            setActiveTab('results')
                                                        }}
                                                        className="px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-xs font-medium transition-colors"
                                                    >
                                                        View Progress →
                                                    </button>
                                                )}
                                                {exam.status !== 'completed' && (
                                                    <button
                                                        onClick={() => deleteExam(exam.exam_id)}
                                                        className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors group"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-purple-400/50 group-hover:text-red-400" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════════
                    TAB 2: VIEW RESULTS (combined all subjects + completion tracking)
                ═══════════════════════════════════════════ */}
                {activeTab === 'results' && (
                    <div className="space-y-6">
                        {/* Filters */}
                        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs text-purple-300 mb-1 font-medium">Class</label>
                                    <select
                                        value={selectedClassId}
                                        onChange={e => setSelectedClassId(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-purple-400"
                                    >
                                        <option value="" className="text-gray-900">Select Class</option>
                                        {classes.map(c => (
                                            <option key={c.class_id} value={c.class_id} className="text-gray-900">
                                                {c.name} (Grade {c.grade_level})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-purple-300 mb-1 font-medium">Section</label>
                                    <select
                                        value={selectedSectionId}
                                        onChange={e => setSelectedSectionId(e.target.value)}
                                        disabled={!selectedClassId}
                                        className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50"
                                    >
                                        <option value="" className="text-gray-900">Select Section</option>
                                        {sections.map(s => (
                                            <option key={s.section_id} value={s.section_id} className="text-gray-900">
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-purple-300 mb-1 font-medium">Exam</label>
                                    <select
                                        value={selectedExamId}
                                        onChange={e => setSelectedExamId(e.target.value)}
                                        disabled={!selectedSectionId}
                                        className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50"
                                    >
                                        <option value="" className="text-gray-900">Select Exam</option>
                                        {exams.filter(e => e.status !== 'cancelled').map(e => (
                                            <option key={e.exam_id} value={e.exam_id} className="text-gray-900">
                                                {e.name} ({e.exam_types?.short_code || e.exam_types?.name}) — {e.status}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Publish Button */}
                            {selectedExam && selectedExam.status !== 'completed' && selectedClassId && selectedSectionId && (
                                <div className="mt-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(selectedExam.status)}
                                        <span className="text-xs text-purple-300/50">
                                            {students.length} students · {subjects.length} subjects
                                        </span>
                                    </div>
                                    <button
                                        onClick={publishResults}
                                        className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
                                    >
                                        <Send className="w-4 h-4" /> Publish Results
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        {!selectedClassId || !selectedSectionId || !selectedExamId ? (
                            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-16 text-center">
                                <BarChart3 className="w-16 h-16 text-purple-500/30 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-white mb-2">View Exam Results</h3>
                                <p className="text-purple-300/60">Select a class, section, and exam to view results and track marks entry progress</p>
                            </div>
                        ) : students.length === 0 ? (
                            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-16 text-center">
                                <Users className="w-16 h-16 text-purple-500/30 mx-auto mb-4" />
                                <p className="text-purple-300/60">No students found in this section</p>
                            </div>
                        ) : subjects.length === 0 ? (
                            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-16 text-center">
                                <BookOpen className="w-16 h-16 text-purple-500/30 mx-auto mb-4" />
                                <p className="text-purple-300/60">No subjects assigned to this section</p>
                            </div>
                        ) : (
                            <>
                                {/* ── Set Max Marks per Subject ── */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-white font-bold text-sm flex items-center gap-2">
                                            <Edit3 className="w-4 h-4 text-amber-400" />
                                            Max Marks per Subject
                                        </h3>
                                        <button
                                            onClick={saveMaxMarks}
                                            disabled={savingMaxMarks}
                                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-all shadow-lg shadow-amber-500/20"
                                        >
                                            {savingMaxMarks ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                            Save Max Marks
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                                        {subjects.map(sub => (
                                            <div key={sub.subject_id} className="p-3 bg-white/5 border border-white/10 rounded-xl">
                                                <label className="block text-xs text-purple-300 mb-1.5 font-medium truncate">{sub.name}</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={maxMarksConfig[sub.subject_id] || 100}
                                                    onChange={e => setMaxMarksConfig(prev => ({
                                                        ...prev,
                                                        [sub.subject_id]: parseInt(e.target.value) || 100
                                                    }))}
                                                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm text-center outline-none focus:ring-2 focus:ring-amber-400"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* ── Subject Completion Overview ── */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                                    <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                                        <ClipboardList className="w-4 h-4 text-indigo-400" />
                                        Marks Entry Progress — {totalSubjectsComplete}/{subjects.length} subjects complete
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                                        {subjectStats.map(stat => (
                                            <div
                                                key={stat.subject.subject_id}
                                                className={`p-3 rounded-xl border transition-colors ${stat.isComplete
                                                    ? 'bg-emerald-500/10 border-emerald-500/20'
                                                    : stat.entered > 0
                                                        ? 'bg-amber-500/10 border-amber-500/20'
                                                        : 'bg-red-500/10 border-red-500/20'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    {stat.isComplete ? (
                                                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                                    ) : stat.entered > 0 ? (
                                                        <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                                    )}
                                                    <span className="text-white font-semibold text-xs truncate">{stat.subject.name}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-xs font-medium ${stat.isComplete ? 'text-emerald-300' : stat.entered > 0 ? 'text-amber-300' : 'text-red-300'}`}>
                                                        {stat.entered}/{stat.total} entered
                                                    </span>
                                                    {stat.pending > 0 && (
                                                        <span className="text-xs text-red-300/70">{stat.pending} pending</span>
                                                    )}
                                                </div>
                                                {/* Progress bar */}
                                                <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${stat.isComplete ? 'bg-emerald-400' : stat.entered > 0 ? 'bg-amber-400' : 'bg-red-400'}`}
                                                        style={{ width: `${stat.total > 0 ? (stat.entered / stat.total) * 100 : 0}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* ── Class-Level Stats ── */}
                                {(() => {
                                    const allTotals = students.map(s => getStudentTotal(s.user_id))
                                    const classAvg = allTotals.length > 0
                                        ? allTotals.reduce((sum, t) => sum + t.percentage, 0) / allTotals.length
                                        : 0
                                    const passCount = allTotals.filter(t => t.percentage >= 33).length
                                    const topperIdx = allTotals.length > 0 ? allTotals.reduce((best, t, i) => t.percentage > allTotals[best].percentage ? i : best, 0) : 0

                                    return (
                                        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
                                            <div className="grid grid-cols-4 gap-4">
                                                <div className="text-center">
                                                    <p className="text-2xl font-bold text-white">{classAvg.toFixed(1)}%</p>
                                                    <p className="text-xs text-purple-300/60">Class Average</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-2xl font-bold text-emerald-400">{passCount}/{students.length}</p>
                                                    <p className="text-xs text-purple-300/60">Pass Rate</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-2xl font-bold text-amber-400">{students[topperIdx]?.full_name?.split(' ')[0] || '-'}</p>
                                                    <p className="text-xs text-purple-300/60">Class Topper</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-2xl font-bold text-white">{allTotals[topperIdx]?.percentage.toFixed(1) || 0}%</p>
                                                    <p className="text-xs text-purple-300/60">Highest Score</p>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })()}

                                {/* ── Combined Results Table ── */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-gradient-to-r from-purple-600/30 to-indigo-600/30 border-b border-white/10">
                                                    <th className="p-3 text-left text-xs font-semibold text-purple-200 uppercase tracking-wider sticky left-0 bg-purple-900/80 backdrop-blur-sm z-10 w-10">Rank</th>
                                                    <th className="p-3 text-left text-xs font-semibold text-purple-200 uppercase tracking-wider sticky left-10 bg-purple-900/80 backdrop-blur-sm z-10 min-w-[180px]">Student</th>
                                                    {subjects.map(sub => (
                                                        <th key={sub.subject_id} className="p-3 text-center text-xs font-semibold text-purple-200 uppercase tracking-wider min-w-[100px]">
                                                            <div>{sub.name}</div>
                                                            <div className="text-[10px] text-purple-400 font-normal normal-case mt-0.5">out of {maxMarksConfig[sub.subject_id] || 100}</div>
                                                        </th>
                                                    ))}
                                                    <th className="p-3 text-center text-xs font-semibold text-amber-300 uppercase tracking-wider min-w-[90px]">Total</th>
                                                    <th className="p-3 text-center text-xs font-semibold text-amber-300 uppercase tracking-wider min-w-[70px]">%</th>
                                                    <th className="p-3 text-center text-xs font-semibold text-amber-300 uppercase tracking-wider min-w-[60px]">Grade</th>
                                                    <th className="p-3 text-center text-xs font-semibold text-purple-200 uppercase tracking-wider min-w-[70px]">Result</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {students
                                                    .map(s => ({ ...s, totals: getStudentTotal(s.user_id) }))
                                                    .sort((a, b) => b.totals.percentage - a.totals.percentage)
                                                    .map((student, idx) => {
                                                        // Count how many of this student's subjects have marks entered
                                                        const marksEntered = subjects.filter(sub => {
                                                            const m = marks[student.user_id]?.[sub.subject_id]
                                                            return m && m.marks_obtained > 0
                                                        }).length
                                                        const allEntered = marksEntered === subjects.length

                                                        return (
                                                            <tr key={student.user_id} className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors ${!allEntered ? 'bg-amber-500/[0.03]' : ''}`}>
                                                                <td className="p-3 sticky left-0 bg-slate-900/90 backdrop-blur-sm">
                                                                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${idx === 0 ? 'bg-amber-500/20 text-amber-400' :
                                                                        idx === 1 ? 'bg-gray-400/20 text-gray-300' :
                                                                            idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                                                                                'bg-white/5 text-purple-300/60'
                                                                        }`}>
                                                                        {idx + 1}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 sticky left-10 bg-slate-900/90 backdrop-blur-sm">
                                                                    <div>
                                                                        <span className="text-white font-medium text-sm">{student.full_name}</span>
                                                                        {!allEntered && (
                                                                            <p className="text-xs text-amber-400 flex items-center gap-1 mt-0.5">
                                                                                <Clock className="w-3 h-3" />
                                                                                {marksEntered}/{subjects.length} subjects entered
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                {subjects.map(sub => {
                                                                    const mark = marks[student.user_id]?.[sub.subject_id]
                                                                    const hasMarks = mark && mark.marks_obtained > 0
                                                                    const pct = mark && mark.max_marks > 0 ? (mark.marks_obtained / mark.max_marks) * 100 : 0
                                                                    return (
                                                                        <td key={sub.subject_id} className="p-3 text-center">
                                                                            {hasMarks ? (
                                                                                <span className={`text-sm font-medium ${pct >= 80 ? 'text-emerald-400' :
                                                                                    pct >= 33 ? 'text-white' : 'text-red-400'
                                                                                    }`}>
                                                                                    {mark.marks_obtained}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-xs text-red-400/60 italic">—</span>
                                                                            )}
                                                                        </td>
                                                                    )
                                                                })}
                                                                <td className="p-3 text-center">
                                                                    <span className="text-white font-semibold text-sm">{student.totals.obtained}/{student.totals.max}</span>
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    <span className="text-white font-semibold text-sm">{student.totals.percentage.toFixed(1)}%</span>
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${getGradeColor(student.totals.grade)}`}>
                                                                        {student.totals.grade}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    {!allEntered ? (
                                                                        <span className="text-xs font-semibold text-amber-400">PENDING</span>
                                                                    ) : student.totals.percentage >= 33 ? (
                                                                        <span className="text-xs font-semibold text-emerald-400">PASS ✓</span>
                                                                    ) : (
                                                                        <span className="text-xs font-semibold text-red-400">FAIL</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}

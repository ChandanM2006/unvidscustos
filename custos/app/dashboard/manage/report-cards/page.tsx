'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, FileText, Users, Plus, Download,
    Award, TrendingUp, Loader2, Eye, Printer, Sparkles
} from 'lucide-react'

interface Student {
    user_id: string
    full_name: string
    email: string
}

interface ClassItem {
    class_id: string
    name: string
}

interface Subject {
    subject_id: string
    name: string
}

interface Exam {
    exam_id: string
    name: string
    exam_types: { name: string }
}

interface Mark {
    student_id: string
    subject_id: string
    marks_obtained: number
    max_marks: number
    grade: string
}

export default function ReportCardsPage() {
    const router = useRouter()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Data
    const [classes, setClasses] = useState<ClassItem[]>([])
    const [students, setStudents] = useState<Student[]>([])
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [exams, setExams] = useState<Exam[]>([])
    const [marks, setMarks] = useState<Record<string, Record<string, Mark>>>({})

    // Selection
    const [selectedClassId, setSelectedClassId] = useState('')
    const [selectedExamId, setSelectedExamId] = useState('')

    // View mode
    const [viewMode, setViewMode] = useState<'entry' | 'report'>('entry')
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

    useEffect(() => {
        loadClasses()
        loadExams()
    }, [])

    useEffect(() => {
        if (selectedClassId) {
            loadStudents()
            loadSubjects()
        }
    }, [selectedClassId])

    useEffect(() => {
        if (selectedClassId && selectedExamId) {
            loadMarks()
        }
    }, [selectedClassId, selectedExamId])

    async function loadClasses() {
        try {
            // Check role - only admins and teachers can access
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

            if (!userData || !['super_admin', 'sub_admin', 'teacher'].includes(userData.role)) {
                alert('You do not have permission to access this page.')
                router.push('/dashboard')
                return
            }

            const { data } = await supabase
                .from('classes')
                .select('*')
                .order('grade_level', { ascending: true })
            setClasses(data || [])
        } catch (error) {
            console.error('Error loading classes:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadExams() {
        try {
            const { data } = await supabase
                .from('exams')
                .select('*, exam_types(name)')
                .eq('status', 'completed')
                .order('end_date', { ascending: false })
            setExams(data || [])
        } catch (error) {
            console.error('Error loading exams:', error)
        }
    }

    async function loadStudents() {
        const { data } = await supabase
            .from('users')
            .select('user_id, full_name, email')
            .eq('role', 'student')
            .eq('class_id', selectedClassId)
            .order('full_name', { ascending: true })
        setStudents(data || [])
    }

    async function loadSubjects() {
        const { data } = await supabase
            .from('subjects')
            .select('*')
            .eq('class_id', selectedClassId)
            .order('name', { ascending: true })
        setSubjects(data || [])
    }

    async function loadMarks() {
        try {
            const { data } = await supabase
                .from('student_marks')
                .select('*')
                .eq('exam_id', selectedExamId)
                .in('student_id', students.map(s => s.user_id))

            // Organize marks by student -> subject
            const marksMap: Record<string, Record<string, Mark>> = {}
            students.forEach(s => {
                marksMap[s.user_id] = {}
                subjects.forEach(sub => {
                    const mark = data?.find(m => m.student_id === s.user_id && m.subject_id === sub.subject_id)
                    marksMap[s.user_id][sub.subject_id] = mark || {
                        student_id: s.user_id,
                        subject_id: sub.subject_id,
                        marks_obtained: 0,
                        max_marks: 100,
                        grade: ''
                    }
                })
            })
            setMarks(marksMap)
        } catch (error) {
            console.error('Error loading marks:', error)
        }
    }

    function updateMark(studentId: string, subjectId: string, value: number) {
        setMarks(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [subjectId]: {
                    ...prev[studentId]?.[subjectId],
                    marks_obtained: value,
                    grade: calculateGrade(value)
                }
            }
        }))
    }

    function calculateGrade(marks: number): string {
        if (marks >= 90) return 'A+'
        if (marks >= 80) return 'A'
        if (marks >= 70) return 'B+'
        if (marks >= 60) return 'B'
        if (marks >= 50) return 'C+'
        if (marks >= 40) return 'C'
        if (marks >= 33) return 'D'
        return 'F'
    }

    async function saveMarks() {
        if (!selectedExamId) {
            alert('Please select an exam')
            return
        }

        setSaving(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()

            const allMarks: any[] = []
            Object.entries(marks).forEach(([studentId, subjectMarks]) => {
                Object.entries(subjectMarks).forEach(([subjectId, mark]) => {
                    if (mark.marks_obtained > 0) {
                        allMarks.push({
                            student_id: studentId,
                            exam_id: selectedExamId,
                            subject_id: subjectId,
                            marks_obtained: mark.marks_obtained,
                            max_marks: mark.max_marks || 100,
                            grade: mark.grade || calculateGrade(mark.marks_obtained),
                            entered_by: user?.id
                        })
                    }
                })
            })

            const { error } = await supabase
                .from('student_marks')
                .upsert(allMarks, {
                    onConflict: 'student_id,exam_id,subject_id',
                    ignoreDuplicates: false
                })

            if (error) throw error

            alert('Marks saved successfully!')
        } catch (error: any) {
            console.error('Error saving marks:', error)
            alert('Error saving: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    function getStudentTotal(studentId: string): { obtained: number; max: number; percentage: number } {
        const studentMarks = marks[studentId] || {}
        let obtained = 0, max = 0
        Object.values(studentMarks).forEach(m => {
            obtained += m.marks_obtained || 0
            max += m.max_marks || 100
        })
        const percentage = max > 0 ? (obtained / max) * 100 : 0
        return { obtained, max, percentage }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50 p-8">
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
                            <h1 className="text-3xl font-bold text-gray-900">Report Cards</h1>
                            <p className="text-gray-600">Manage exam marks and generate report cards</p>
                        </div>
                    </div>
                    <Award className="w-12 h-12 text-rose-600" />
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setViewMode('entry')}
                        className={`px-6 py-2 rounded-lg font-medium transition-all ${viewMode === 'entry'
                            ? 'bg-rose-600 text-white shadow-md'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        Marks Entry
                    </button>
                    <button
                        onClick={() => setViewMode('report')}
                        className={`px-6 py-2 rounded-lg font-medium transition-all ${viewMode === 'report'
                            ? 'bg-rose-600 text-white shadow-md'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        View Reports
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                            <select
                                value={selectedClassId}
                                onChange={(e) => setSelectedClassId(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white"
                            >
                                <option value="">Select Class</option>
                                {classes.map(c => (
                                    <option key={c.class_id} value={c.class_id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Exam</label>
                            <select
                                value={selectedExamId}
                                onChange={(e) => setSelectedExamId(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white"
                            >
                                <option value="">Select Exam</option>
                                {exams.map(e => (
                                    <option key={e.exam_id} value={e.exam_id}>
                                        {e.name} ({e.exam_types?.name})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end gap-2">
                            <button
                                onClick={saveMarks}
                                disabled={saving || !selectedExamId}
                                className="flex-1 py-3 bg-rose-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-rose-700 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                                Save Marks
                            </button>
                        </div>
                    </div>
                </div>

                {/* Marks Entry View */}
                {viewMode === 'entry' && (
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                        {!selectedClassId || !selectedExamId ? (
                            <div className="p-12 text-center">
                                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Select Class & Exam</h3>
                                <p className="text-gray-500">Choose a class and exam to enter or view marks</p>
                            </div>
                        ) : students.length === 0 ? (
                            <div className="p-12 text-center">
                                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">No students found in this class</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-rose-500 to-pink-500 text-white">
                                            <th className="p-4 text-left font-semibold sticky left-0 bg-rose-500">#</th>
                                            <th className="p-4 text-left font-semibold sticky left-10 bg-rose-500 min-w-[180px]">Student</th>
                                            {subjects.map(sub => (
                                                <th key={sub.subject_id} className="p-4 text-center font-semibold min-w-[100px]">
                                                    {sub.name}
                                                </th>
                                            ))}
                                            <th className="p-4 text-center font-semibold min-w-[80px]">Total</th>
                                            <th className="p-4 text-center font-semibold min-w-[80px]">%</th>
                                            <th className="p-4 text-center font-semibold min-w-[60px]">Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map((student, idx) => {
                                            const totals = getStudentTotal(student.user_id)
                                            const grade = calculateGrade(totals.percentage)
                                            return (
                                                <tr key={student.user_id} className="border-b hover:bg-gray-50">
                                                    <td className="p-3 sticky left-0 bg-white">{idx + 1}</td>
                                                    <td className="p-3 sticky left-10 bg-white">
                                                        <div className="font-medium text-gray-900">{student.full_name}</div>
                                                    </td>
                                                    {subjects.map(sub => {
                                                        const mark = marks[student.user_id]?.[sub.subject_id]
                                                        return (
                                                            <td key={sub.subject_id} className="p-2 text-center">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="100"
                                                                    value={mark?.marks_obtained || ''}
                                                                    onChange={(e) => updateMark(
                                                                        student.user_id,
                                                                        sub.subject_id,
                                                                        parseFloat(e.target.value) || 0
                                                                    )}
                                                                    className="w-16 p-2 border rounded text-center text-gray-900"
                                                                />
                                                            </td>
                                                        )
                                                    })}
                                                    <td className="p-3 text-center font-semibold">{totals.obtained}/{totals.max}</td>
                                                    <td className="p-3 text-center font-semibold">{totals.percentage.toFixed(1)}%</td>
                                                    <td className={`p-3 text-center font-bold ${grade === 'A+' || grade === 'A' ? 'text-green-600' :
                                                        grade === 'F' ? 'text-red-600' : 'text-gray-900'
                                                        }`}>
                                                        {grade}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Report View */}
                {viewMode === 'report' && (
                    <div className="bg-white rounded-2xl shadow-xl p-6">
                        <div className="text-center py-12">
                            <Sparkles className="w-16 h-16 text-rose-300 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Report Card Generation</h3>
                            <p className="text-gray-500 mb-4">AI-powered report cards with personalized remarks</p>
                            <p className="text-sm text-gray-400">Coming soon - Generate PDF report cards with student progress analysis</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

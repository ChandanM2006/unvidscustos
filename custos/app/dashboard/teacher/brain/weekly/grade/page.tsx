'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Loader2, CheckCircle, Save, Camera, Upload,
    ClipboardList, User, AlertTriangle, Check, X, ChevronDown,
    ChevronRight, BarChart3, Brain, FileImage
} from 'lucide-react'

interface StudentRow {
    user_id: string; full_name: string;
    response?: any; isEditing?: boolean;
}

export default function WeeklyGradePage() {
    const { goBack, router } = useSmartBack('/dashboard/teacher/brain/weekly')
    const searchParams = useSearchParams()
    const workId = searchParams.get('work_id') || ''

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [completing, setCompleting] = useState(false)
    const [ocrProcessing, setOcrProcessing] = useState(false)

    const [work, setWork] = useState<any>(null)
    const [students, setStudents] = useState<StudentRow[]>([])
    const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
    const [questionMarks, setQuestionMarks] = useState<any[]>([])
    const [teacherNotes, setTeacherNotes] = useState('')
    const [teacherId, setTeacherId] = useState('')

    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (workId) loadData()
    }, [workId])

    async function loadData() {
        setLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                const { data: u } = await supabase.from('users').select('user_id').eq('email', session.user.email).single()
                if (u) setTeacherId(u.user_id)
            }

            const res = await fetch(`/api/brain/work/weekly?work_id=${workId}`)
            const data = await res.json()
            setWork(data.work)

            // Build student list with response status
            const allStudents = (data.students || []) as any[]
            const responses = (data.responses || []) as any[]

            const rows: StudentRow[] = allStudents.map((s: any) => {
                const resp = responses.find((r: any) => r.student_id === s.user_id)
                return { user_id: s.user_id, full_name: s.full_name, response: resp }
            })

            // Sort: pending first, then graded
            rows.sort((a, b) => {
                const aGraded = a.response?.status === 'graded' ? 1 : 0
                const bGraded = b.response?.status === 'graded' ? 1 : 0
                return aGraded - bGraded
            })

            setStudents(rows)

            // Auto-start grading if still published
            if (data.work?.status === 'published') {
                await fetch('/api/brain/work/weekly', {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ work_id: workId, action: 'start_grading' }),
                })
            }
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    function selectStudent(studentId: string) {
        setSelectedStudent(studentId)
        const student = students.find(s => s.user_id === studentId)
        const existingMarks = student?.response?.question_marks || []
        setTeacherNotes(student?.response?.teacher_notes || '')

        if (existingMarks.length > 0) {
            setQuestionMarks(existingMarks)
        } else {
            // Initialize marks from work questions
            setQuestionMarks((work?.questions || []).map((q: any, i: number) => ({
                question_id: q.question_id,
                q_no: i + 1,
                marks_obtained: 0,
                marks_possible: q.marks || 1,
                is_correct: null,
                topic_id: q.topic_id || '',
                difficulty: q.difficulty || 'medium',
                bloom_type: q.bloom_type || 'knowledge',
                notes: '',
            })))
        }
    }

    function updateMark(qIdx: number, field: string, value: any) {
        const updated = [...questionMarks]
        updated[qIdx] = { ...updated[qIdx], [field]: value }

        // Auto-set is_correct based on marks
        if (field === 'marks_obtained') {
            const mp = updated[qIdx].marks_possible || 1
            if (value >= mp) updated[qIdx].is_correct = 'correct'
            else if (value > 0) updated[qIdx].is_correct = 'partial'
            else updated[qIdx].is_correct = 'wrong'
        }
        if (field === 'is_correct') {
            const mp = updated[qIdx].marks_possible || 1
            if (value === 'correct') updated[qIdx].marks_obtained = mp
            else if (value === 'wrong') updated[qIdx].marks_obtained = 0
        }

        setQuestionMarks(updated)
    }

    async function saveStudentGrade() {
        if (!selectedStudent || !workId) return
        setSaving(true)
        try {
            const res = await fetch('/api/brain/work/weekly', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    work_id: workId, action: 'grade_student', teacher_id: teacherId,
                    grading_data: {
                        student_id: selectedStudent,
                        question_marks: questionMarks,
                        teacher_notes: teacherNotes,
                        grading_method: 'manual',
                    },
                }),
            })
            const data = await res.json()
            if (data.success) {
                // Update local state
                setStudents(prev => prev.map(s =>
                    s.user_id === selectedStudent
                        ? { ...s, response: { ...s.response, status: 'graded', total_marks_obtained: data.total_obtained, total_marks_possible: data.total_possible, percentage: data.percentage, question_marks: questionMarks } }
                        : s
                ))
                // Move to next ungraded student
                const nextUngraded = students.find(s => s.user_id !== selectedStudent && s.response?.status !== 'graded')
                if (nextUngraded) selectStudent(nextUngraded.user_id)
                else setSelectedStudent(null)
            }
        } catch (e) { console.error(e) }
        finally { setSaving(false) }
    }

    async function handleComplete() {
        const ungradedCount = students.filter(s => s.response?.status !== 'graded').length
        if (ungradedCount > 0 && !confirm(`${ungradedCount} students not graded. Complete anyway?`)) return
        setCompleting(true)
        try {
            const res = await fetch('/api/brain/work/weekly', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ work_id: workId, action: 'complete' }),
            })
            const data = await res.json()
            if (data.success) router.push('/dashboard/teacher/brain/weekly')
        } catch (e) { console.error(e) }
        finally { setCompleting(false) }
    }

    async function handleOCRUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !selectedStudent) return
        setOcrProcessing(true)
        try {
            const base64 = await fileToBase64(file)

            // Call server-side OCR route (API key stays secure on the server)
            const res = await fetch('/api/brain/ocr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_base64: base64,
                    question_count: questionMarks.length,
                    questions: questionMarks.map(q => ({
                        marks_possible: q.marks_possible,
                    })),
                }),
            })

            const data = await res.json()

            if (res.ok && data.success) {
                const ocrResults = data.results

                if (Array.isArray(ocrResults)) {
                    const updated = [...questionMarks]
                    for (const ocr of ocrResults) {
                        const idx = (ocr.q_no || 0) - 1
                        if (idx >= 0 && idx < updated.length && ocr.marks_obtained >= 0) {
                            updated[idx].marks_obtained = ocr.marks_obtained
                            updated[idx].is_correct = ocr.is_correct || (ocr.marks_obtained >= updated[idx].marks_possible ? 'correct' : ocr.marks_obtained > 0 ? 'partial' : 'wrong')
                        }
                    }
                    setQuestionMarks(updated)
                    alert('OCR completed! Review the marks below and adjust any errors.')
                }
            } else {
                alert(`OCR failed: ${data.error || 'Unknown error'}. Please enter marks manually.`)
            }
        } catch (err) {
            console.error('OCR error:', err)
            alert('OCR processing failed. Enter marks manually.')
        } finally {
            setOcrProcessing(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    function fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.readAsDataURL(file)
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
        })
    }

    const gradedCount = students.filter(s => s.response?.status === 'graded').length
    const totalObtained = questionMarks.reduce((s, q) => s + (q.marks_obtained || 0), 0)
    const totalPossible = questionMarks.reduce((s, q) => s + (q.marks_possible || 0), 0)

    if (loading) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
        </div>
    )

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
            {/* Header */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={goBack} className="p-2 hover:bg-white/10 rounded-lg"><ArrowLeft className="w-5 h-5 text-purple-300" /></button>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-emerald-400" /> Grade Weekly Test</h1>
                            <p className="text-xs text-gray-400">{work?.week_label} • {gradedCount}/{students.length} graded</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs font-bold text-purple-300">
                            {gradedCount}/{students.length} Complete
                        </div>
                        <button onClick={handleComplete} disabled={completing || gradedCount === 0} className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg font-bold text-white disabled:opacity-50 flex items-center gap-2 text-sm">
                            {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Finalize All Grades
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
                {/* Student List (left sidebar) */}
                <div className="w-72 bg-white/5 rounded-xl border border-white/10 overflow-hidden flex-shrink-0 self-start sticky top-6">
                    <div className="px-4 py-3 border-b border-white/10">
                        <h3 className="text-sm font-bold text-gray-300">Students</h3>
                    </div>
                    <div className="max-h-[70vh] overflow-y-auto">
                        {students.map(s => (
                            <button key={s.user_id} onClick={() => selectStudent(s.user_id)}
                                className={`w-full px-4 py-3 flex items-center gap-3 text-left border-b border-white/5 transition-colors ${selectedStudent === s.user_id ? 'bg-purple-500/15 border-l-2 border-l-purple-500' : 'hover:bg-white/5'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${s.response?.status === 'graded' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-gray-400'}`}>
                                    {s.response?.status === 'graded' ? <Check className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate text-white">{s.full_name}</p>
                                    <p className="text-xs text-gray-500">
                                        {s.response?.status === 'graded'
                                            ? `${s.response.total_marks_obtained}/${s.response.total_marks_possible} (${s.response.percentage}%)`
                                            : 'Pending'}
                                    </p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-600" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grading Area */}
                <div className="flex-1">
                    {!selectedStudent ? (
                        <div className="bg-white/5 rounded-xl border border-white/10 p-16 text-center">
                            <ClipboardList className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-gray-400 mb-2">Select a Student to Grade</h3>
                            <p className="text-sm text-gray-500">Click on a student name from the list to start entering marks</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Student header */}
                            <div className="bg-white/5 rounded-xl border border-white/10 p-4 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-lg text-white">{students.find(s => s.user_id === selectedStudent)?.full_name}</h3>
                                    <p className="text-sm text-gray-400">Total: {totalObtained}/{totalPossible} ({totalPossible > 0 ? Math.round((totalObtained / totalPossible) * 100) : 0}%)</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="file" ref={fileInputRef} onChange={handleOCRUpload} accept="image/*" className="hidden" />
                                    <button onClick={() => fileInputRef.current?.click()} disabled={ocrProcessing} className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-gray-300 hover:bg-white/15 flex items-center gap-2">
                                        {ocrProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                                        {ocrProcessing ? 'Processing...' : 'Upload Index Photo'}
                                    </button>
                                    <button onClick={saveStudentGrade} disabled={saving} className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg font-bold text-white flex items-center gap-2 text-sm disabled:opacity-60">
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Grade
                                    </button>
                                </div>
                            </div>

                            {/* Spreadsheet */}
                            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-white/5 border-b border-white/10">
                                            <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-400 w-12">Q#</th>
                                            <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-400">Question</th>
                                            <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-400 w-20">Diff</th>
                                            <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-400 w-24">Bloom</th>
                                            <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-400 w-20">Max</th>
                                            <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-400 w-28">Mark</th>
                                            <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-400 w-24">Obtained</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {questionMarks.map((qm, idx) => {
                                            const question = work?.questions?.[idx]
                                            return (
                                                <tr key={idx} className={`border-b border-white/5 ${qm.is_correct === 'correct' ? 'bg-emerald-500/5' : qm.is_correct === 'wrong' ? 'bg-red-500/5' : qm.is_correct === 'partial' ? 'bg-amber-500/5' : ''}`}>
                                                    <td className="px-3 py-2.5 text-center font-bold text-purple-400">{qm.q_no}</td>
                                                    <td className="px-3 py-2.5 text-gray-300 text-xs max-w-xs truncate" title={question?.question_text}>{question?.question_text?.substring(0, 60)}...</td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${qm.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' : qm.difficulty === 'hard' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{qm.difficulty}</span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center text-xs text-gray-400">{qm.bloom_type}</td>
                                                    <td className="px-3 py-2.5 text-center font-mono text-gray-300">{qm.marks_possible}</td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {['correct', 'partial', 'wrong'].map(val => (
                                                                <button key={val} onClick={() => updateMark(idx, 'is_correct', val)}
                                                                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${qm.is_correct === val
                                                                        ? val === 'correct' ? 'bg-emerald-500 text-white' : val === 'partial' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
                                                                        : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}>
                                                                    {val === 'correct' ? '✓' : val === 'partial' ? '½' : '✗'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <input type="number" min={0} max={qm.marks_possible} value={qm.marks_obtained}
                                                            onChange={e => updateMark(idx, 'marks_obtained', parseFloat(e.target.value) || 0)}
                                                            className="w-14 px-2 py-1 bg-white/10 border border-white/20 rounded text-center text-white text-sm font-mono focus:ring-1 focus:ring-purple-500 outline-none" />
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-white/5">
                                            <td colSpan={4} className="px-3 py-2.5 text-right text-sm font-bold text-gray-300">Total</td>
                                            <td className="px-3 py-2.5 text-center font-bold text-white font-mono">{totalPossible}</td>
                                            <td></td>
                                            <td className="px-3 py-2.5 text-center font-bold text-white font-mono text-lg">{totalObtained}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Notes */}
                            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                                <label className="text-xs font-bold text-gray-400 block mb-1.5">Teacher Notes (optional)</label>
                                <textarea value={teacherNotes} onChange={e => setTeacherNotes(e.target.value)} placeholder="Any notes about this student's performance..."
                                    className="w-full p-2.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white resize-none outline-none focus:ring-1 focus:ring-purple-500" rows={2} />
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}

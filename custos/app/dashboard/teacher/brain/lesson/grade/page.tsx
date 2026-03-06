'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Loader2, CheckCircle, Save, Camera, ClipboardList,
    User, Check, ChevronRight, BarChart3, GraduationCap
} from 'lucide-react'

interface StudentRow {
    user_id: string; full_name: string; response?: any;
}

export default function LessonGradePage() {
    const { goBack, router } = useSmartBack('/dashboard/teacher/brain/lesson')
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

    useEffect(() => { if (workId) loadData() }, [workId])

    async function loadData() {
        setLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                const { data: u } = await supabase.from('users').select('user_id').eq('email', session.user.email).single()
                if (u) setTeacherId(u.user_id)
            }
            const res = await fetch(`/api/brain/work/lesson?work_id=${workId}`)
            const data = await res.json()
            setWork(data.work)
            const rows: StudentRow[] = (data.students || []).map((s: any) => {
                const resp = (data.responses || []).find((r: any) => r.student_id === s.user_id)
                return { user_id: s.user_id, full_name: s.full_name, response: resp }
            })
            rows.sort((a, b) => (a.response?.status === 'graded' ? 1 : 0) - (b.response?.status === 'graded' ? 1 : 0))
            setStudents(rows)
            if (data.work?.status === 'published') {
                await fetch('/api/brain/work/lesson', {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ work_id: workId, action: 'start_grading' }),
                })
            }
        } catch (e) { console.error(e) } finally { setLoading(false) }
    }

    function selectStudent(studentId: string) {
        setSelectedStudent(studentId)
        const student = students.find(s => s.user_id === studentId)
        const existingMarks = student?.response?.question_marks || []
        setTeacherNotes(student?.response?.teacher_notes || '')
        if (existingMarks.length > 0) { setQuestionMarks(existingMarks) }
        else {
            setQuestionMarks((work?.questions || []).map((q: any, i: number) => ({
                question_id: q.question_id, q_no: i + 1, marks_obtained: 0,
                marks_possible: q.marks || 1, is_correct: null,
                topic_id: q.topic_id || '', difficulty: q.difficulty || 'medium',
                bloom_type: q.bloom_type || 'knowledge', notes: '',
            })))
        }
    }

    function updateMark(qIdx: number, field: string, value: any) {
        const updated = [...questionMarks]
        updated[qIdx] = { ...updated[qIdx], [field]: value }
        if (field === 'marks_obtained') {
            const mp = updated[qIdx].marks_possible || 1
            updated[qIdx].is_correct = value >= mp ? 'correct' : value > 0 ? 'partial' : 'wrong'
        }
        if (field === 'is_correct') {
            const mp = updated[qIdx].marks_possible || 1
            if (value === 'correct') updated[qIdx].marks_obtained = mp
            else if (value === 'wrong') updated[qIdx].marks_obtained = 0
        }
        setQuestionMarks(updated)
    }

    async function saveStudentGrade() {
        if (!selectedStudent || !workId) return; setSaving(true)
        try {
            const res = await fetch('/api/brain/work/lesson', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    work_id: workId, action: 'grade_student', teacher_id: teacherId,
                    grading_data: { student_id: selectedStudent, question_marks: questionMarks, teacher_notes: teacherNotes, grading_method: 'manual' },
                }),
            })
            const data = await res.json()
            if (data.success) {
                setStudents(prev => prev.map(s => s.user_id === selectedStudent
                    ? { ...s, response: { ...s.response, status: 'graded', total_marks_obtained: data.total_obtained, total_marks_possible: data.total_possible, percentage: data.percentage, question_marks: questionMarks } } : s))
                const next = students.find(s => s.user_id !== selectedStudent && s.response?.status !== 'graded')
                if (next) selectStudent(next.user_id); else setSelectedStudent(null)
            }
        } catch (e) { console.error(e) } finally { setSaving(false) }
    }

    async function handleComplete() {
        const ug = students.filter(s => s.response?.status !== 'graded').length
        if (ug > 0 && !confirm(`${ug} students not graded. Complete anyway?`)) return
        setCompleting(true)
        try {
            const res = await fetch('/api/brain/work/lesson', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ work_id: workId, action: 'complete' }),
            })
            const data = await res.json()
            if (data.success) router.push('/dashboard/teacher/brain/lesson')
        } catch (e) { console.error(e) } finally { setCompleting(false) }
    }

    async function handleOCRUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]; if (!file || !selectedStudent) return
        setOcrProcessing(true)
        try {
            const base64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.readAsDataURL(file); r.onload = () => res(r.result as string); r.onerror = rej })
            const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || ''
            const resp = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: 'gpt-4o-mini', messages: [{
                        role: 'user', content: [
                            { type: 'text', text: 'Read marks from this grading index. Return JSON: {"marks": [{"q_no": 1, "marks_obtained": 2, "is_correct": "correct|partial|wrong"}, ...]}. Set marks_obtained to -1 if unreadable.' },
                            { type: 'image_url', image_url: { url: base64 } }
                        ]
                    }], response_format: { type: 'json_object' }, max_tokens: 1000,
                }),
            })
            if (resp.ok) {
                const d = await resp.json(); const parsed = JSON.parse(d.choices?.[0]?.message?.content || '{}')
                const ocrResults = parsed.marks || parsed.results || parsed
                if (Array.isArray(ocrResults)) {
                    const upd = [...questionMarks]
                    for (const ocr of ocrResults) {
                        const idx = (ocr.q_no || 0) - 1
                        if (idx >= 0 && idx < upd.length && ocr.marks_obtained >= 0) {
                            upd[idx].marks_obtained = ocr.marks_obtained
                            upd[idx].is_correct = ocr.is_correct || (ocr.marks_obtained >= upd[idx].marks_possible ? 'correct' : ocr.marks_obtained > 0 ? 'partial' : 'wrong')
                        }
                    }
                    setQuestionMarks(upd); alert('OCR completed! Review the marks.')
                }
            } else alert('OCR failed. Enter marks manually.')
        } catch { alert('OCR processing failed.') }
        finally { setOcrProcessing(false); if (fileInputRef.current) fileInputRef.current.value = '' }
    }

    const gradedCount = students.filter(s => s.response?.status === 'graded').length
    const totalObtained = questionMarks.reduce((s, q) => s + (q.marks_obtained || 0), 0)
    const totalPossible = questionMarks.reduce((s, q) => s + (q.marks_possible || 0), 0)

    if (loading) return <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center"><Loader2 className="w-10 h-10 text-indigo-400 animate-spin" /></div>

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={goBack} className="p-2 hover:bg-white/10 rounded-lg"><ArrowLeft className="w-5 h-5 text-indigo-300" /></button>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2"><GraduationCap className="w-6 h-6 text-indigo-400" /> Grade Chapter Test</h1>
                            <p className="text-xs text-gray-400">{work?.chapter_title} • {gradedCount}/{students.length} graded</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="px-3 py-1.5 bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-xs font-bold text-indigo-300">{gradedCount}/{students.length} Complete</div>
                        <button onClick={handleComplete} disabled={completing || gradedCount === 0} className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg font-bold text-white disabled:opacity-50 flex items-center gap-2 text-sm">
                            {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Finalize All Grades
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
                {/* Student sidebar */}
                <div className="w-72 bg-white/5 rounded-xl border border-white/10 overflow-hidden flex-shrink-0 self-start sticky top-6">
                    <div className="px-4 py-3 border-b border-white/10"><h3 className="text-sm font-bold text-gray-300">Students</h3></div>
                    <div className="max-h-[70vh] overflow-y-auto">
                        {students.map(s => (
                            <button key={s.user_id} onClick={() => selectStudent(s.user_id)}
                                className={`w-full px-4 py-3 flex items-center gap-3 text-left border-b border-white/5 transition-colors ${selectedStudent === s.user_id ? 'bg-indigo-500/15 border-l-2 border-l-indigo-500' : 'hover:bg-white/5'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${s.response?.status === 'graded' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-gray-400'}`}>
                                    {s.response?.status === 'graded' ? <Check className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate text-white">{s.full_name}</p>
                                    <p className="text-xs text-gray-500">{s.response?.status === 'graded' ? `${s.response.total_marks_obtained}/${s.response.total_marks_possible} (${s.response.percentage}%)` : 'Pending'}</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-600" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grading area */}
                <div className="flex-1">
                    {!selectedStudent ? (
                        <div className="bg-white/5 rounded-xl border border-white/10 p-16 text-center">
                            <ClipboardList className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-gray-400 mb-2">Select a Student to Grade</h3>
                            <p className="text-sm text-gray-500">Click on a student name to start entering marks</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
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

                            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead><tr className="bg-white/5 border-b border-white/10">
                                        <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-400 w-12">Q#</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-400">Question</th>
                                        <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-400 w-20">Type</th>
                                        <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-400 w-20">Max</th>
                                        <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-400 w-28">Mark</th>
                                        <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-400 w-24">Obtained</th>
                                    </tr></thead>
                                    <tbody>
                                        {questionMarks.map((qm, idx) => {
                                            const question = work?.questions?.[idx]
                                            return (
                                                <tr key={idx} className={`border-b border-white/5 ${qm.is_correct === 'correct' ? 'bg-emerald-500/5' : qm.is_correct === 'wrong' ? 'bg-red-500/5' : qm.is_correct === 'partial' ? 'bg-amber-500/5' : ''}`}>
                                                    <td className="px-3 py-2.5 text-center font-bold text-indigo-400">{qm.q_no}</td>
                                                    <td className="px-3 py-2.5 text-gray-300 text-xs max-w-xs truncate" title={question?.question_text}>{question?.question_text?.substring(0, 55)}...</td>
                                                    <td className="px-3 py-2.5 text-center text-[10px] text-gray-400">{question?.question_type?.replace(/_/g, ' ')}</td>
                                                    <td className="px-3 py-2.5 text-center font-mono text-gray-300">{qm.marks_possible}</td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {['correct', 'partial', 'wrong'].map(val => (
                                                                <button key={val} onClick={() => updateMark(idx, 'is_correct', val)}
                                                                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${qm.is_correct === val ? val === 'correct' ? 'bg-emerald-500 text-white' : val === 'partial' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}>
                                                                    {val === 'correct' ? '✓' : val === 'partial' ? '½' : '✗'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <input type="number" min={0} max={qm.marks_possible} value={qm.marks_obtained}
                                                            onChange={e => updateMark(idx, 'marks_obtained', parseFloat(e.target.value) || 0)}
                                                            className="w-14 px-2 py-1 bg-white/10 border border-white/20 rounded text-center text-white text-sm font-mono focus:ring-1 focus:ring-indigo-500 outline-none" />
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                    <tfoot><tr className="bg-white/5">
                                        <td colSpan={3} className="px-3 py-2.5 text-right text-sm font-bold text-gray-300">Total</td>
                                        <td className="px-3 py-2.5 text-center font-bold text-white font-mono">{totalPossible}</td>
                                        <td></td>
                                        <td className="px-3 py-2.5 text-center font-bold text-white font-mono text-lg">{totalObtained}</td>
                                    </tr></tfoot>
                                </table>
                            </div>

                            <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                                <label className="text-xs font-bold text-gray-400 block mb-1.5">Teacher Notes (optional)</label>
                                <textarea value={teacherNotes} onChange={e => setTeacherNotes(e.target.value)} placeholder="Notes about this student's chapter performance..."
                                    className="w-full p-2.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white resize-none outline-none focus:ring-1 focus:ring-indigo-500" rows={2} />
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}

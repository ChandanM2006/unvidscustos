'use client'

import { useState, useEffect } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Brain, Loader2, CheckCircle, Clock, Zap, FileText, Send,
    RefreshCw, Edit3, Check, X, Pencil, Trash2, ChevronDown, ChevronUp,
    Save, Printer, ClipboardList, BarChart3, AlertTriangle, BookOpen,
    GraduationCap, Layers, Info
} from 'lucide-react'

interface ClassOption { class_id: string; name: string; grade_level: number }
interface SubjectOption { subject_id: string; name: string }
interface ChapterOption { document_id: string; chapter_title: string; chapter_number: number }

interface LessonQuestion {
    question_id: string; topic_id: string; question_text: string;
    question_type: string; marks: number; difficulty: string;
    bloom_type: string; expected_answer: string; marking_rubric: string;
    is_from_weak_topic?: boolean;
}

interface LessonWork {
    work_id: string; class_id: string; subject_id: string; document_id: string;
    chapter_title: string; chapter_number: number;
    topics_included: any[]; combined_analysis: any;
    daily_work_count: number; weekly_work_count: number;
    all_daily_complete: boolean; all_weekly_complete: boolean;
    questions: LessonQuestion[]; question_count: number; total_marks: number;
    grading_index: any[]; status: string;
    generated_at: string; published_at: string | null;
}

export default function TeacherLessonWorkPage() {
    const { goBack, router } = useSmartBack('/dashboard/teacher/brain')
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [publishing, setPublishing] = useState(false)
    const [saving, setSaving] = useState(false)

    const [teacherId, setTeacherId] = useState('')
    const [classes, setClasses] = useState<ClassOption[]>([])
    const [subjects, setSubjects] = useState<SubjectOption[]>([])
    const [chapters, setChapters] = useState<ChapterOption[]>([])
    const [selectedClassId, setSelectedClassId] = useState('')
    const [selectedSubjectId, setSelectedSubjectId] = useState('')
    const [selectedDocId, setSelectedDocId] = useState('')

    const [lessonWork, setLessonWork] = useState<LessonWork | null>(null)
    const [editingQId, setEditingQId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<any>(null)
    const [hasEdits, setHasEdits] = useState(false)
    const [expandedQ, setExpandedQ] = useState<string | null>(null)

    useEffect(() => { loadTeacherData() }, [])
    useEffect(() => { if (selectedClassId && teacherId) loadSubjects() }, [selectedClassId, teacherId])
    useEffect(() => { if (selectedSubjectId && selectedClassId) loadChapters() }, [selectedSubjectId, selectedClassId])
    useEffect(() => { if (selectedDocId && selectedClassId && selectedSubjectId) loadExistingWork() }, [selectedDocId])

    async function loadTeacherData() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return }
            const { data: user } = await supabase.from('users').select('user_id, role').eq('email', session.user.email).single()
            if (!user || user.role !== 'teacher') { router.replace('/dashboard/redirect'); return }
            setTeacherId(user.user_id)
            const { data: entries } = await supabase.from('timetable_entries').select('class_id').eq('teacher_id', user.user_id)
            const uniqueIds = [...new Set((entries || []).map(e => e.class_id))]
            if (uniqueIds.length > 0) {
                const { data: cd } = await supabase.from('classes').select('class_id, name, grade_level').in('class_id', uniqueIds)
                setClasses(cd || [])
                if (cd?.length) setSelectedClassId(cd[0].class_id)
            }
        } catch (e) { console.error(e) } finally { setLoading(false) }
    }

    async function loadSubjects() {
        const { data: entries } = await supabase.from('timetable_entries').select('subject_id').eq('teacher_id', teacherId).eq('class_id', selectedClassId)
        const ids = [...new Set((entries || []).map(e => e.subject_id).filter(Boolean))]
        if (ids.length > 0) {
            const { data } = await supabase.from('subjects').select('subject_id, name').in('subject_id', ids).order('name')
            setSubjects(data || [])
            if (data?.length) setSelectedSubjectId(data[0].subject_id)
        } else { setSubjects([]); setSelectedSubjectId('') }
    }

    async function loadChapters() {
        const classInfo = classes.find(c => c.class_id === selectedClassId)
        const { data } = await supabase
            .from('syllabus_documents')
            .select('document_id, chapter_title, chapter_number')
            .eq('subject_id', selectedSubjectId)
            .eq('grade_level', classInfo?.grade_level || 9)
            .order('chapter_number')
        setChapters(data || [])
        if (data?.length) setSelectedDocId(data[0].document_id)
        else setSelectedDocId('')
    }

    async function loadExistingWork() {
        if (!selectedClassId || !selectedSubjectId || !selectedDocId) return
        try {
            const params = new URLSearchParams({ class_id: selectedClassId, subject_id: selectedSubjectId })
            const res = await fetch(`/api/brain/work/lesson?${params}`)
            const data = await res.json()
            const match = (data.works || []).find((w: any) => w.document_id === selectedDocId)
            setLessonWork(match || null)
            setHasEdits(false)
        } catch (e) { console.error(e) }
    }

    async function handleGenerate() {
        if (!selectedClassId || !selectedSubjectId || !selectedDocId) return
        setGenerating(true)
        try {
            const res = await fetch('/api/brain/work/lesson', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ class_id: selectedClassId, subject_id: selectedSubjectId, document_id: selectedDocId, teacher_id: teacherId }),
            })
            const data = await res.json()
            if (data.success) { setLessonWork(data.work); setHasEdits(false) }
            else alert(data.error || 'Generation failed')
        } catch (e) { console.error(e); alert('Failed to generate') }
        finally { setGenerating(false) }
    }

    async function handleSaveEdits() {
        if (!lessonWork) return; setSaving(true)
        try {
            const res = await fetch('/api/brain/work/lesson', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ work_id: lessonWork.work_id, questions: lessonWork.questions }),
            })
            const data = await res.json()
            if (data.success) { setHasEdits(false); setEditingQId(null) }
        } catch (e) { console.error(e) } finally { setSaving(false) }
    }

    async function handlePublish() {
        if (!lessonWork) return
        if (hasEdits) await handleSaveEdits()
        setPublishing(true)
        try {
            const res = await fetch('/api/brain/work/lesson', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ work_id: lessonWork.work_id, action: 'publish' }),
            })
            const data = await res.json()
            if (data.success) setLessonWork({ ...lessonWork, status: 'published', published_at: new Date().toISOString() })
        } catch (e) { console.error(e) } finally { setPublishing(false) }
    }

    function startEditing(q: LessonQuestion) { setEditingQId(q.question_id); setEditForm({ ...q }) }
    function cancelEditing() { setEditingQId(null); setEditForm(null) }
    function saveQuestionEdit() {
        if (!lessonWork || !editForm) return
        const updated = lessonWork.questions.map(q => q.question_id === editForm.question_id ? { ...editForm } : q)
        setLessonWork({ ...lessonWork, questions: updated })
        setEditingQId(null); setEditForm(null); setHasEdits(true)
    }
    function deleteQuestion(qId: string) {
        if (!lessonWork || !confirm('Delete this question?')) return
        const updated = lessonWork.questions.filter(q => q.question_id !== qId)
        const nm = updated.reduce((s, q) => s + (q.marks || 0), 0)
        setLessonWork({ ...lessonWork, questions: updated, question_count: updated.length, total_marks: nm })
        setHasEdits(true)
    }

    function handlePrint() {
        if (!lessonWork) return
        const w = window.open('', '_blank'); if (!w) return
        const subj = subjects.find(s => s.subject_id === selectedSubjectId)?.name || ''
        const cls = classes.find(c => c.class_id === selectedClassId)
        w.document.write(`<html><head><title>Lesson Test - ${subj}</title><style>
body{font-family:Georgia,serif;padding:40px;color:#000}h1{text-align:center;font-size:20px;margin-bottom:4px}
.meta{text-align:center;font-size:13px;color:#444;margin-bottom:20px}
.q{margin-bottom:18px;page-break-inside:avoid}.q-head{display:flex;justify-content:space-between;font-weight:bold;font-size:13px;margin-bottom:4px}
.q-text{font-size:14px;line-height:1.6}.lines{border-bottom:1px solid #ccc;height:24px;margin:2px 0}
@media print{body{padding:20px}}</style></head><body>
<h1>${subj} — Chapter Test: ${lessonWork.chapter_title}</h1>
<div class="meta">${cls?.name || ''} | Total Marks: ${lessonWork.total_marks} | Time: 60 min</div>
<div class="meta">Name: __________________________ Roll No: __________ Date: __________</div><hr>`)
        lessonWork.questions.forEach((q, i) => {
            const lines = ['fill_blank', 'true_false'].includes(q.question_type) ? 2 : ['short_answer'].includes(q.question_type) ? 4 : q.question_type === 'diagram' ? 8 : 6
            w.document.write(`<div class="q"><div class="q-head"><span>Q${i + 1}. [${q.question_type.replace(/_/g, ' ')}]</span><span>[${q.marks} marks]</span></div><div class="q-text">${q.question_text}</div>${Array(lines).fill('<div class="lines"></div>').join('')}</div>`)
        })
        w.document.write('</body></html>'); w.document.close(); w.print()
    }

    function handlePrintGradingIndex() {
        if (!lessonWork) return
        const w = window.open('', '_blank'); if (!w) return
        const subj = subjects.find(s => s.subject_id === selectedSubjectId)?.name || ''
        w.document.write(`<html><head><title>Grading Index</title><style>
body{font-family:Arial,sans-serif;padding:30px;font-size:12px}h2{text-align:center;font-size:16px}
.meta{text-align:center;margin-bottom:15px;font-size:13px}
table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #333;padding:6px 8px;text-align:center}
th{background:#f0f0f0;font-weight:bold}.mark-cell{width:120px}
@media print{body{padding:15px}}</style></head><body>
<h2>Grading Index — ${subj} Chapter Test: ${lessonWork.chapter_title}</h2>
<div class="meta">Total: ${lessonWork.total_marks} marks</div>
<div class="meta">Student Name: _________________________________ ID: _______________</div>
<table><tr><th>Q#</th><th>Type</th><th>Topic</th><th>Difficulty</th><th>Bloom's</th><th>Max</th><th class="mark-cell">Mark</th><th>Obtained</th></tr>`)
        lessonWork.grading_index.forEach((g: any) => {
            w.document.write(`<tr><td>${g.q_no}</td><td style="font-size:10px">${g.q_type || ''}</td><td style="text-align:left">${g.topic_title}</td><td>${g.difficulty}</td><td>${g.bloom_type}</td><td>${g.marks}</td><td></td><td></td></tr>`)
        })
        w.document.write(`<tr><td colspan="5" style="text-align:right;font-weight:bold">Total</td><td><b>${lessonWork.total_marks}</b></td><td></td><td></td></tr></table></body></html>`)
        w.document.close(); w.print()
    }

    const diffColors: Record<string, string> = { easy: 'bg-green-500/20 text-green-400 border-green-500/30', medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', hard: 'bg-red-500/20 text-red-400 border-red-500/30' }
    const typeLabels: Record<string, string> = { fill_blank: 'Fill in Blank', true_false: 'True/False', short_answer: 'Short Answer', long_answer: 'Long Answer', application: 'Application', critical_thinking: 'Critical Thinking', diagram: 'Diagram', numerical: 'Numerical' }
    const qTypes = ['fill_blank', 'true_false', 'short_answer', 'long_answer', 'application', 'critical_thinking', 'diagram', 'numerical']

    if (loading) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
            <Brain className="w-14 h-14 text-indigo-400 mx-auto mb-3 animate-pulse" />
        </div>
    )

    const analysis = lessonWork?.combined_analysis

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={goBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-indigo-300" /></button>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2"><GraduationCap className="w-7 h-7 text-indigo-400" />Lesson Test</h1>
                            <p className="text-sm text-gray-400">Chapter summative test from all daily + weekly data</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasEdits && lessonWork?.status === 'generated' && (
                            <button onClick={handleSaveEdits} disabled={saving} className="px-4 py-2 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-300 hover:bg-amber-500/30 transition-all flex items-center gap-2 text-sm font-medium">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
                {/* Filters */}
                <div className="bg-white/5 rounded-xl border border-white/10 p-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Class</label>
                            <select value={selectedClassId} onChange={e => { setSelectedClassId(e.target.value); setLessonWork(null) }}
                                className="w-full p-2.5 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
                                {classes.map(c => <option key={c.class_id} value={c.class_id} className="bg-gray-800">{c.name} (Grade {c.grade_level})</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Subject</label>
                            <select value={selectedSubjectId} onChange={e => { setSelectedSubjectId(e.target.value); setLessonWork(null) }}
                                className="w-full p-2.5 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
                                {subjects.map(s => <option key={s.subject_id} value={s.subject_id} className="bg-gray-800">{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Chapter / Lesson</label>
                            <select value={selectedDocId} onChange={e => { setSelectedDocId(e.target.value); setLessonWork(null) }}
                                className="w-full p-2.5 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
                                {chapters.map(c => <option key={c.document_id} value={c.document_id} className="bg-gray-800">Ch {c.chapter_number}: {c.chapter_title}</option>)}
                                {chapters.length === 0 && <option className="bg-gray-800">No chapters found</option>}
                            </select>
                        </div>
                    </div>
                </div>

                {/* No work */}
                {!lessonWork ? (
                    <div className="bg-white/5 rounded-xl border border-white/10 p-10 text-center">
                        <GraduationCap className="w-16 h-16 text-indigo-400/40 mx-auto mb-4" />
                        <h3 className="text-xl font-bold mb-2">No Lesson Test for This Chapter</h3>
                        <p className="text-gray-400 mb-4 max-w-md mx-auto">AI will perform its deepest analysis, combining all daily MCQ + weekly test data for every topic in this chapter. 60/40 weak/strong focus.</p>
                        <div className="flex items-center justify-center gap-4 mb-6">
                            <div className="bg-white/5 rounded-lg px-4 py-2 text-center"><p className="text-xs text-gray-500">Pre-conditions</p><p className="text-sm text-gray-300">Auto-checked</p></div>
                        </div>
                        <button onClick={handleGenerate} disabled={generating || !selectedDocId}
                            className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl font-bold text-white hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50 flex items-center gap-2 mx-auto">
                            {generating ? <><Loader2 className="w-5 h-5 animate-spin" />Analyzing all data...</> : <><Zap className="w-5 h-5" />Generate Chapter Test</>}
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Status + Actions */}
                        <div className={`rounded-xl p-5 border ${lessonWork.status === 'generated' ? 'bg-amber-600/10 border-amber-500/30' : lessonWork.status === 'published' ? 'bg-indigo-600/10 border-indigo-500/30' : 'bg-emerald-600/10 border-emerald-500/30'}`}>
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div className="flex items-center gap-3">
                                    {lessonWork.status === 'generated' ? <Clock className="w-6 h-6 text-amber-400" /> : <CheckCircle className="w-6 h-6 text-indigo-400" />}
                                    <div>
                                        <h3 className="font-bold">{lessonWork.status === 'generated' ? 'Review & Edit Before Publishing' : lessonWork.status === 'published' ? 'Published — Print & Give Test' : 'Test Completed'}</h3>
                                        <p className="text-sm text-gray-400">
                                            Ch {lessonWork.chapter_number}: {lessonWork.chapter_title} • {lessonWork.question_count} questions • {lessonWork.total_marks} marks
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {lessonWork.status === 'generated' && (
                                        <button onClick={handlePublish} disabled={publishing} className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg font-bold text-white hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2">
                                            {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Publish
                                        </button>
                                    )}
                                    {['published', 'in_progress', 'corrected'].includes(lessonWork.status) && (
                                        <>
                                            <button onClick={handlePrint} className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/15 flex items-center gap-2 text-sm"><Printer className="w-4 h-4" /> Print Test</button>
                                            <button onClick={handlePrintGradingIndex} className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/15 flex items-center gap-2 text-sm"><ClipboardList className="w-4 h-4" /> Print Index</button>
                                            <button onClick={() => router.push(`/dashboard/teacher/brain/lesson/grade?work_id=${lessonWork.work_id}`)} className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg font-bold text-white flex items-center gap-2 text-sm"><BarChart3 className="w-4 h-4" /> Grade Students</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Data Coverage */}
                        {analysis && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-indigo-500/10 rounded-xl border border-indigo-500/20 p-4 text-center">
                                    <p className="text-2xl font-bold text-indigo-300">{analysis.daily_count}</p>
                                    <p className="text-xs text-gray-400">Daily Tests</p>
                                    <p className="text-[10px] text-gray-500">avg: {analysis.avg_daily_score}%</p>
                                </div>
                                <div className="bg-blue-500/10 rounded-xl border border-blue-500/20 p-4 text-center">
                                    <p className="text-2xl font-bold text-blue-300">{analysis.weekly_count}</p>
                                    <p className="text-xs text-gray-400">Weekly Tests</p>
                                    <p className="text-[10px] text-gray-500">avg: {analysis.avg_weekly_score}%</p>
                                </div>
                                <div className="bg-purple-500/10 rounded-xl border border-purple-500/20 p-4 text-center">
                                    <p className="text-2xl font-bold text-purple-300">{analysis.coverage_percent}%</p>
                                    <p className="text-xs text-gray-400">Topic Coverage</p>
                                    <p className="text-[10px] text-gray-500">from prior data</p>
                                </div>
                                <div className="bg-emerald-500/10 rounded-xl border border-emerald-500/20 p-4 text-center">
                                    <p className="text-2xl font-bold text-emerald-300">{lessonWork.topics_included?.length || 0}</p>
                                    <p className="text-xs text-gray-400">Topics</p>
                                    <p className="text-[10px] text-gray-500">in chapter</p>
                                </div>
                            </div>
                        )}

                        {/* Weak/Strong split */}
                        {analysis && (analysis.weak_topics?.length > 0 || analysis.strong_topics?.length > 0) && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-red-500/5 rounded-xl border border-red-500/20 p-4">
                                    <h4 className="text-sm font-bold text-red-400 mb-2 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Weak Topics (60%)</h4>
                                    {(analysis.weak_topics || []).map((t: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                                            <span className="text-gray-300">{t.title}</span>
                                            <span className="text-red-400 font-mono text-xs">
                                                {t.daily_avg >= 0 ? `D:${t.daily_avg}%` : ''} {t.weekly_avg >= 0 ? `W:${t.weekly_avg}%` : ''} → {t.combined_avg}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-emerald-500/5 rounded-xl border border-emerald-500/20 p-4">
                                    <h4 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Strong Topics (40%)</h4>
                                    {(analysis.strong_topics || []).map((t: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                                            <span className="text-gray-300">{t.title}</span>
                                            <span className="text-emerald-400 font-mono text-xs">{t.combined_avg}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Questions */}
                        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
                                <h3 className="font-bold text-indigo-300 flex items-center gap-2"><FileText className="w-4 h-4" /> Chapter Test ({lessonWork.question_count} questions, {lessonWork.total_marks} marks)</h3>
                            </div>
                            <div className="divide-y divide-white/5">
                                {lessonWork.questions.map((q, idx) => editingQId === q.question_id ? (
                                    /* Edit mode */
                                    <div key={q.question_id} className="p-5 bg-indigo-600/5 border-l-2 border-indigo-500">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-sm font-bold text-indigo-400 flex items-center gap-2"><Edit3 className="w-4 h-4" /> Editing Q{idx + 1}</h4>
                                            <div className="flex gap-2">
                                                <button onClick={saveQuestionEdit} className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Save</button>
                                                <button onClick={cancelEditing} className="px-3 py-1 bg-white/5 text-gray-400 rounded text-xs flex items-center gap-1"><X className="w-3.5 h-3.5" /> Cancel</button>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <textarea value={editForm.question_text} onChange={e => setEditForm({ ...editForm, question_text: e.target.value })} className="w-full p-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm resize-none" rows={3} />
                                            <div className="grid grid-cols-4 gap-2">
                                                <div><label className="text-[10px] text-gray-500">Marks</label><input type="number" value={editForm.marks} onChange={e => setEditForm({ ...editForm, marks: parseInt(e.target.value) || 1 })} className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-xs" /></div>
                                                <div><label className="text-[10px] text-gray-500">Difficulty</label><select value={editForm.difficulty} onChange={e => setEditForm({ ...editForm, difficulty: e.target.value })} className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-xs"><option value="easy" className="bg-gray-800">Easy</option><option value="medium" className="bg-gray-800">Medium</option><option value="hard" className="bg-gray-800">Hard</option></select></div>
                                                <div><label className="text-[10px] text-gray-500">Type</label><select value={editForm.question_type} onChange={e => setEditForm({ ...editForm, question_type: e.target.value })} className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-xs">{qTypes.map(t => <option key={t} value={t} className="bg-gray-800">{typeLabels[t]}</option>)}</select></div>
                                                <div><label className="text-[10px] text-gray-500">Bloom&apos;s</label><select value={editForm.bloom_type} onChange={e => setEditForm({ ...editForm, bloom_type: e.target.value })} className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-xs">{['knowledge', 'comprehension', 'application', 'analysis', 'synthesis', 'evaluation'].map(b => <option key={b} value={b} className="bg-gray-800">{b}</option>)}</select></div>
                                            </div>
                                            <div><label className="text-[10px] text-gray-500">Expected Answer</label><textarea value={editForm.expected_answer || ''} onChange={e => setEditForm({ ...editForm, expected_answer: e.target.value })} className="w-full p-2 bg-white/10 border border-white/20 rounded text-white text-xs resize-none" rows={2} /></div>
                                            <div><label className="text-[10px] text-gray-500">Marking Rubric</label><input value={editForm.marking_rubric || ''} onChange={e => setEditForm({ ...editForm, marking_rubric: e.target.value })} className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-xs" /></div>
                                        </div>
                                    </div>
                                ) : (
                                    /* View mode */
                                    <div key={q.question_id} className="p-5 hover:bg-white/[0.02] group">
                                        <div className="flex items-start gap-3">
                                            <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-indigo-500/20 text-indigo-400 rounded-lg text-xs font-bold">{idx + 1}</span>
                                            <div className="flex-1">
                                                <div className="flex items-start justify-between gap-3">
                                                    <p className="text-white font-medium leading-relaxed">{q.question_text}</p>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <span className="text-indigo-400 font-bold text-xs">[{q.marks}m]</span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${diffColors[q.difficulty] || diffColors.medium}`}>{q.difficulty?.toUpperCase()}</span>
                                                        <span className="text-[10px] px-1.5 py-0.5 bg-white/5 rounded text-gray-400">{typeLabels[q.question_type] || q.question_type}</span>
                                                        {lessonWork.status === 'generated' && (
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => startEditing(q)} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-blue-400"><Pencil className="w-3.5 h-3.5" /></button>
                                                                <button onClick={() => deleteQuestion(q.question_id)} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {q.expected_answer && (
                                                    <>
                                                        <button onClick={() => setExpandedQ(expandedQ === q.question_id ? null : q.question_id)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 mt-2">
                                                            {expandedQ === q.question_id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} Answer & Rubric
                                                        </button>
                                                        {expandedQ === q.question_id && (
                                                            <div className="mt-2 space-y-2">
                                                                <div className="px-3 py-2 bg-white/5 rounded-lg text-sm text-gray-300 border-l-2 border-indigo-500/50">{q.expected_answer}</div>
                                                                {q.marking_rubric && <div className="px-3 py-2 bg-white/5 rounded-lg text-xs text-gray-400 border-l-2 border-amber-500/50">{q.marking_rubric}</div>}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {lessonWork.status === 'generated' && (
                            <div className="flex justify-center">
                                <button onClick={handleGenerate} disabled={generating} className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:bg-white/10 flex items-center gap-2">
                                    <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} /> Regenerate
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/* Workflow info */}
                <div className="bg-white/[0.03] rounded-xl border border-white/5 p-5">
                    <h3 className="text-sm font-bold text-indigo-400 mb-3 flex items-center gap-2"><Brain className="w-4 h-4" /> Lesson Test Workflow</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm text-gray-400">
                        {[['Deepest Analysis', 'All daily MCQs + weekly tests combined'], ['Comprehensive Test', 'Fill blank, T/F, short, long, HOTS questions'], ['Print & Administer', 'Print test + grading index for class'], ['Grade & Finalize', 'Enter marks → completes data cycle']].map(([t, d], i) => (
                            <div key={i} className="flex items-start gap-2">
                                <span className="w-6 h-6 bg-indigo-500/20 text-indigo-400 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                                <p><span className="text-white font-medium">{t}</span> — {d}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    )
}

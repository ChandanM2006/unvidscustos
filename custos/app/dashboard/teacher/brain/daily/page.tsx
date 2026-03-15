'use client'

import { useState, useEffect, useRef } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Brain, Calendar, BookOpen, Users, Loader2,
    CheckCircle, Clock, ChevronRight, Zap, FileText,
    Edit3, Eye, Send, RefreshCw, AlertTriangle, Check,
    X, Pencil, Trash2, Plus, ChevronDown, ChevronUp, Save
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────

interface ClassOption {
    class_id: string
    name: string
    grade_level: number
}

interface SubjectOption {
    subject_id: string
    name: string
}

interface TopicOption {
    topic_id: string
    topic_title: string
    document_id: string
}

interface DailyWork {
    work_id: string
    class_id: string
    subject_id: string
    topic_id: string | null
    work_date: string
    mcq_questions: MCQQuestion[]
    mcq_count: number
    homework_questions: HomeworkQuestion[]
    homework_count: number
    status: 'generated' | 'published' | 'completed'
    generated_at: string
    published_at: string | null
}

interface MCQQuestion {
    question_id: string
    topic_id: string
    question_text: string
    options: string[]
    correct_answer: string
    difficulty: string
    type: string
    explanation: string
    format: string
}

interface HomeworkQuestion {
    question_id: string
    topic_id: string
    question_text: string
    difficulty: string
    type: string
    format: string
    expected_answer_guide: string
}

interface ResponseStats {
    completed: number
    total: number
    avg_score: number
}

// ─── Component ───────────────────────────────────────────

export default function TeacherDailyWorkPage() {
    const { goBack, router } = useSmartBack('/dashboard/teacher/brain')
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [publishing, setPublishing] = useState(false)
    const [saving, setSaving] = useState(false)

    // Teacher data
    const [teacherId, setTeacherId] = useState('')
    const [classes, setClasses] = useState<ClassOption[]>([])
    const [subjects, setSubjects] = useState<SubjectOption[]>([])
    const [chapters, setChapters] = useState<any[]>([])
    const [topics, setTopics] = useState<TopicOption[]>([])

    // Selected filters
    const [selectedClassId, setSelectedClassId] = useState('')
    const [selectedSubjectId, setSelectedSubjectId] = useState('')
    const [selectedDocId, setSelectedDocId] = useState('')
    const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([])
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [topicDropdownOpen, setTopicDropdownOpen] = useState(false)
    const topicDropdownRef = useRef<HTMLDivElement>(null)

    // Generated work
    const [dailyWork, setDailyWork] = useState<DailyWork | null>(null)
    const [responseStats, setResponseStats] = useState<ResponseStats | null>(null)
    const [previewMode, setPreviewMode] = useState<'mcq' | 'homework'>('mcq')
    const [expandedQ, setExpandedQ] = useState<string | null>(null)

    // Editing state
    const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<any>(null)
    const [hasEdits, setHasEdits] = useState(false)

    useEffect(() => {
        loadTeacherData()
    }, [])

    useEffect(() => {
        if (selectedClassId && teacherId) {
            loadSubjects()
        }
    }, [selectedClassId, teacherId])

    useEffect(() => {
        if (selectedSubjectId && selectedClassId) {
            loadChapters()
        } else {
            setChapters([])
            setSelectedDocId('')
        }
    }, [selectedSubjectId, selectedClassId])

    useEffect(() => {
        if (selectedDocId) {
            loadTopics()
        } else {
            setTopics([])
        }
    }, [selectedDocId])

    useEffect(() => {
        if (selectedClassId && selectedDate) {
            loadExistingWork()
        }
    }, [selectedClassId, selectedSubjectId, selectedDate])

    // Close topic dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (topicDropdownRef.current && !topicDropdownRef.current.contains(e.target as Node)) {
                setTopicDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // ─── Data Loading ────────────────────────────────────

    async function loadTeacherData() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return }

            const { data: user } = await supabase
                .from('users')
                .select('user_id, role, school_id')
                .eq('email', session.user.email)
                .single()

            if (!user || user.role !== 'teacher') {
                router.replace('/dashboard/redirect')
                return
            }

            setTeacherId(user.user_id)

            // Get teacher's classes via timetable
            const { data: entries } = await supabase
                .from('timetable_entries')
                .select('class_id')
                .eq('teacher_id', user.user_id)

            const uniqueClassIds = [...new Set((entries || []).map(e => e.class_id))]

            if (uniqueClassIds.length > 0) {
                const { data: classData } = await supabase
                    .from('classes')
                    .select('class_id, name, grade_level')
                    .in('class_id', uniqueClassIds)

                setClasses(classData || [])
                if (classData && classData.length > 0) {
                    setSelectedClassId(classData[0].class_id)
                }
            }
        } catch (error) {
            console.error('Error loading teacher data:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadSubjects() {
        // Subjects are linked via timetable_entries
        const { data: entries } = await supabase
            .from('timetable_entries')
            .select('subject_id')
            .eq('teacher_id', teacherId)
            .eq('class_id', selectedClassId)

        const uniqueSubjectIds = [...new Set((entries || []).map(e => e.subject_id).filter(Boolean))]

        if (uniqueSubjectIds.length > 0) {
            const { data } = await supabase
                .from('subjects')
                .select('subject_id, name')
                .in('subject_id', uniqueSubjectIds)
                .order('name')

            setSubjects(data || [])
            if (data && data.length > 0) {
                setSelectedSubjectId(data[0].subject_id)
            } else {
                setSubjects([])
                setSelectedSubjectId('')
            }
        } else {
            setSubjects([])
            setSelectedSubjectId('')
        }
    }

    async function loadChapters() {
        const classInfo = classes.find(c => c.class_id === selectedClassId)
        const gradeLevel = classInfo?.grade_level || 9

        const { data } = await supabase
            .from('syllabus_documents')
            .select('document_id, chapter_title, chapter_number')
            .eq('subject_id', selectedSubjectId)
            .eq('grade_level', gradeLevel)
            .order('chapter_number')

        setChapters(data || [])
        if (data && data.length > 0) {
            setSelectedDocId(data[0].document_id)
        } else {
            setSelectedDocId('')
        }
    }

    async function loadTopics() {
        if (!selectedDocId) return

        const { data } = await supabase
            .from('lesson_topics')
            .select('topic_id, topic_title, document_id')
            .eq('document_id', selectedDocId)
            .order('topic_number')

        setTopics(data || [])
        setSelectedTopicIds([])
    }

    async function loadExistingWork() {
        if (!selectedClassId || !selectedDate) return

        try {
            const params = new URLSearchParams({
                class_id: selectedClassId,
                date: selectedDate,
                ...(selectedSubjectId && { subject_id: selectedSubjectId }),
            })

            const res = await fetch(`/api/brain/work/daily?${params}`)
            const data = await res.json()

            if (data.works && data.works.length > 0) {
                const work = selectedSubjectId
                    ? data.works.find((w: DailyWork) => w.subject_id === selectedSubjectId) || data.works[0]
                    : data.works[0]

                setDailyWork(work)
                setResponseStats(data.responseStats?.[work.work_id] || null)
                setHasEdits(false)
            } else {
                setDailyWork(null)
                setResponseStats(null)
            }
        } catch (error) {
            console.error('Error loading existing work:', error)
        }
    }

    // ─── Actions ─────────────────────────────────────────

    async function handleGenerate() {
        if (!selectedClassId || !selectedSubjectId) return

        setGenerating(true)
        try {
            const res = await fetch('/api/brain/work/daily', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    class_id: selectedClassId,
                    subject_id: selectedSubjectId,
                    topic_ids: selectedTopicIds.length > 0 ? selectedTopicIds : undefined,
                    work_date: selectedDate,
                    teacher_id: teacherId,
                }),
            })

            const data = await res.json()
            if (data.success) {
                setDailyWork(data.work)
                setHasEdits(false)
                setEditingQuestionId(null)
            } else {
                alert(data.error || 'Failed to generate daily work')
            }
        } catch (error) {
            console.error('Error generating:', error)
            alert('Failed to generate daily work')
        } finally {
            setGenerating(false)
        }
    }

    async function handleSaveEdits() {
        if (!dailyWork) return

        setSaving(true)
        try {
            const res = await fetch('/api/brain/work/daily', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    work_id: dailyWork.work_id,
                    mcq_questions: dailyWork.mcq_questions,
                    homework_questions: dailyWork.homework_questions,
                }),
            })

            const data = await res.json()
            if (data.success) {
                setHasEdits(false)
                setEditingQuestionId(null)
            } else {
                alert(data.error || 'Failed to save changes')
            }
        } catch (error) {
            console.error('Error saving:', error)
        } finally {
            setSaving(false)
        }
    }

    async function handlePublish() {
        if (!dailyWork) return

        // Save any pending edits first
        if (hasEdits) {
            await handleSaveEdits()
        }

        setPublishing(true)
        try {
            const res = await fetch('/api/brain/work/daily', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    work_id: dailyWork.work_id,
                    action: 'publish',
                }),
            })

            const data = await res.json()
            if (data.success) {
                setDailyWork({ ...dailyWork, status: 'published', published_at: new Date().toISOString() })
            } else {
                alert(data.error || 'Failed to publish')
            }
        } catch (error) {
            console.error('Error publishing:', error)
        } finally {
            setPublishing(false)
        }
    }

    // ─── Question Editing ────────────────────────────────

    function startEditing(question: MCQQuestion | HomeworkQuestion, type: 'mcq' | 'homework') {
        setEditingQuestionId(question.question_id)
        setEditForm({ ...question, _type: type })
    }

    function cancelEditing() {
        setEditingQuestionId(null)
        setEditForm(null)
    }

    function saveQuestionEdit() {
        if (!dailyWork || !editForm) return

        if (editForm._type === 'mcq') {
            const updatedMcqs = dailyWork.mcq_questions.map(q =>
                q.question_id === editForm.question_id
                    ? { ...editForm, _type: undefined }
                    : q
            )
            setDailyWork({ ...dailyWork, mcq_questions: updatedMcqs })
        } else {
            const updatedHw = dailyWork.homework_questions.map(q =>
                q.question_id === editForm.question_id
                    ? { ...editForm, _type: undefined }
                    : q
            )
            setDailyWork({ ...dailyWork, homework_questions: updatedHw })
        }

        setEditingQuestionId(null)
        setEditForm(null)
        setHasEdits(true)
    }

    function deleteQuestion(questionId: string, type: 'mcq' | 'homework') {
        if (!dailyWork) return
        if (!confirm('Delete this question?')) return

        if (type === 'mcq') {
            const updated = dailyWork.mcq_questions.filter(q => q.question_id !== questionId)
            setDailyWork({ ...dailyWork, mcq_questions: updated, mcq_count: updated.length })
        } else {
            const updated = dailyWork.homework_questions.filter(q => q.question_id !== questionId)
            setDailyWork({ ...dailyWork, homework_questions: updated, homework_count: updated.length })
        }
        setHasEdits(true)
    }

    // ─── Topic Multi-Select ──────────────────────────────

    function toggleTopic(topicId: string) {
        setSelectedTopicIds(prev =>
            prev.includes(topicId)
                ? prev.filter(id => id !== topicId)
                : [...prev, topicId]
        )
    }

    function selectAllTopics() {
        setSelectedTopicIds(topics.map(t => t.topic_id))
    }

    function clearTopics() {
        setSelectedTopicIds([])
    }

    // ─── Helpers ─────────────────────────────────────────

    const difficultyColors: Record<string, string> = {
        easy: 'bg-green-500/20 text-green-400 border-green-500/30',
        medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        hard: 'bg-red-500/20 text-red-400 border-red-500/30',
    }

    const typeColors: Record<string, string> = {
        knowledge: 'text-blue-400',
        comprehension: 'text-emerald-400',
        application: 'text-amber-400',
        analysis: 'text-purple-400',
        synthesis: 'text-rose-400',
    }

    const selectedTopicLabels = selectedTopicIds.length > 0
        ? topics.filter(t => selectedTopicIds.includes(t.topic_id)).map(t => t.topic_title)
        : []

    // ─── Render ──────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <Brain className="w-14 h-14 text-emerald-400 mx-auto mb-3 animate-pulse" />
                    <Loader2 className="w-8 h-8 text-emerald-400 mx-auto animate-spin" />
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">

            {/* ─── Header ─── */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={goBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                            <ArrowLeft className="w-5 h-5 text-emerald-300" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Calendar className="w-7 h-7 text-emerald-400" />
                                Daily Work
                            </h1>
                            <p className="text-sm text-gray-400">
                                Generate & manage daily MCQs + homework
                            </p>
                        </div>
                    </div>

                    {/* Save edits indicator */}
                    {hasEdits && dailyWork?.status === 'generated' && (
                        <button
                            onClick={handleSaveEdits}
                            disabled={saving}
                            className="px-4 py-2 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-300 hover:bg-amber-500/30 transition-all flex items-center gap-2 text-sm font-medium"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Changes
                        </button>
                    )}
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">

                {/* ─── Filters ─── */}
                <div className="bg-white/5 rounded-xl border border-white/10 p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Class */}
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Class</label>
                            <select
                                value={selectedClassId}
                                onChange={(e) => { setSelectedClassId(e.target.value); setDailyWork(null) }}
                                className="w-full p-2.5 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                            >
                                {classes.map(c => (
                                    <option key={c.class_id} value={c.class_id} className="bg-gray-800">
                                        {c.name} (Grade {c.grade_level})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Subject */}
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Subject</label>
                            <select
                                value={selectedSubjectId}
                                onChange={(e) => { setSelectedSubjectId(e.target.value); setDailyWork(null) }}
                                className="w-full p-2.5 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                            >
                                <option value="" className="bg-gray-800">All Subjects</option>
                                {subjects.map(s => (
                                    <option key={s.subject_id} value={s.subject_id} className="bg-gray-800">
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Lesson / Chapter */}
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Lesson</label>
                            <select
                                value={selectedDocId}
                                onChange={(e) => { setSelectedDocId(e.target.value); setDailyWork(null) }}
                                className="w-full p-2.5 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                            >
                                {chapters.map(c => (
                                    <option key={c.document_id} value={c.document_id} className="bg-gray-800">
                                        Ch {c.chapter_number}: {c.chapter_title}
                                    </option>
                                ))}
                                {chapters.length === 0 && (
                                    <option className="bg-gray-800">No lessons found</option>
                                )}
                            </select>
                        </div>

                        {/* Topics (Multi-Select) */}
                        <div className="relative" ref={topicDropdownRef}>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                                Topics ({selectedTopicIds.length} selected)
                            </label>
                            <button
                                type="button"
                                onClick={() => setTopicDropdownOpen(!topicDropdownOpen)}
                                className="w-full p-2.5 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-left flex items-center justify-between"
                            >
                                <span className="truncate">
                                    {selectedTopicIds.length === 0
                                        ? 'Auto (from lesson plan)'
                                        : selectedTopicIds.length === 1
                                            ? selectedTopicLabels[0]
                                            : `${selectedTopicIds.length} topics selected`}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${topicDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {topicDropdownOpen && (
                                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-800 border border-white/20 rounded-lg shadow-2xl max-h-72 overflow-y-auto">
                                    {/* Quick actions */}
                                    <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                                        <button
                                            onClick={selectAllTopics}
                                            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                                        >
                                            Select All
                                        </button>
                                        <button
                                            onClick={clearTopics}
                                            className="text-xs text-gray-400 hover:text-gray-300 font-medium"
                                        >
                                            Clear
                                        </button>
                                    </div>

                                    {/* Auto option */}
                                    <button
                                        onClick={() => { clearTopics(); setTopicDropdownOpen(false) }}
                                        className={`w-full px-3 py-2 text-sm text-left hover:bg-white/5 flex items-center gap-2 ${selectedTopicIds.length === 0 ? 'text-emerald-400' : 'text-gray-300'}`}
                                    >
                                        {selectedTopicIds.length === 0 && <Check className="w-3.5 h-3.5" />}
                                        <span className={selectedTopicIds.length === 0 ? '' : 'ml-5'}>Auto (from lesson plan)</span>
                                    </button>

                                    <div className="border-t border-white/5" />

                                    {/* Topic checkboxes */}
                                    {topics.map(t => (
                                        <button
                                            key={t.topic_id}
                                            onClick={() => toggleTopic(t.topic_id)}
                                            className={`w-full px-3 py-2 text-sm text-left hover:bg-white/5 flex items-center gap-2 ${selectedTopicIds.includes(t.topic_id) ? 'text-emerald-300 bg-emerald-500/5' : 'text-gray-300'}`}
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selectedTopicIds.includes(t.topic_id) ? 'bg-emerald-500 border-emerald-500' : 'border-gray-500'}`}>
                                                {selectedTopicIds.includes(t.topic_id) && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className="truncate">{t.topic_title}</span>
                                        </button>
                                    ))}

                                    {topics.length === 0 && (
                                        <p className="px-3 py-3 text-xs text-gray-500 text-center">No topics found for this lesson</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Date */}
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Date</label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => { setSelectedDate(e.target.value); setDailyWork(null) }}
                                className="w-full p-2.5 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                            />
                        </div>
                    </div>

                    {/* Selected topics pills */}
                    {selectedTopicIds.length > 1 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {selectedTopicLabels.map((label, i) => (
                                <span
                                    key={i}
                                    className="px-2.5 py-1 bg-emerald-500/10 text-emerald-300 rounded-full text-xs border border-emerald-500/20 flex items-center gap-1.5"
                                >
                                    {label}
                                    <button
                                        onClick={() => toggleTopic(selectedTopicIds[i])}
                                        className="hover:text-red-400 transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* ─── Generate or View Existing ─── */}
                {!dailyWork ? (
                    <div className="bg-white/5 rounded-xl border border-white/10 p-10 text-center">
                        <Brain className="w-16 h-16 text-emerald-400/40 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">No Daily Work for This Date</h3>
                        <p className="text-gray-400 mb-6 max-w-md mx-auto">
                            Generate AI-powered MCQs and homework questions based on the selected topic and lesson plan.
                        </p>
                        <button
                            onClick={handleGenerate}
                            disabled={generating || !selectedSubjectId}
                            className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl font-bold text-white hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                        >
                            {generating ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Generating with AI...
                                </>
                            ) : (
                                <>
                                    <Zap className="w-5 h-5" />
                                    Generate Daily Work
                                </>
                            )}
                        </button>
                        {!selectedSubjectId && (
                            <p className="text-amber-400 text-sm mt-3">Select a subject first</p>
                        )}
                    </div>
                ) : (
                    <>
                        {/* ─── Status Bar ─── */}
                        <div className={`rounded-xl p-5 border ${dailyWork.status === 'published'
                            ? 'bg-emerald-600/10 border-emerald-500/30'
                            : dailyWork.status === 'completed'
                                ? 'bg-blue-600/10 border-blue-500/30'
                                : 'bg-amber-600/10 border-amber-500/30'
                            }`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {dailyWork.status === 'published' ? (
                                        <CheckCircle className="w-6 h-6 text-emerald-400" />
                                    ) : dailyWork.status === 'completed' ? (
                                        <CheckCircle className="w-6 h-6 text-blue-400" />
                                    ) : (
                                        <Clock className="w-6 h-6 text-amber-400" />
                                    )}
                                    <div>
                                        <h3 className="font-bold text-white">
                                            {dailyWork.status === 'generated' ? 'Ready to Review & Publish' :
                                                dailyWork.status === 'published' ? 'Published — Students Can Practice' :
                                                    'All Students Completed'}
                                        </h3>
                                        <p className="text-sm text-gray-400">
                                            {dailyWork.mcq_questions.length} MCQs + {dailyWork.homework_questions.length} Homework Questions
                                            {responseStats && ` • ${responseStats.completed}/${responseStats.total} students completed`}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {dailyWork.status === 'generated' && (
                                        <button
                                            onClick={handlePublish}
                                            disabled={publishing}
                                            className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg font-bold text-white hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {publishing ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Send className="w-4 h-4" />
                                            )}
                                            Publish to Students
                                        </button>
                                    )}
                                </div>
                            </div>

                            {responseStats && responseStats.total > 0 && (
                                <div className="mt-4 grid grid-cols-3 gap-3">
                                    <div className="bg-white/5 rounded-lg p-3 text-center">
                                        <p className="text-2xl font-bold text-emerald-400">{responseStats.completed}</p>
                                        <p className="text-xs text-gray-400">Completed</p>
                                    </div>
                                    <div className="bg-white/5 rounded-lg p-3 text-center">
                                        <p className="text-2xl font-bold text-amber-400">{responseStats.total - responseStats.completed}</p>
                                        <p className="text-xs text-gray-400">Pending</p>
                                    </div>
                                    <div className="bg-white/5 rounded-lg p-3 text-center">
                                        <p className="text-2xl font-bold text-blue-400">{responseStats.avg_score}%</p>
                                        <p className="text-xs text-gray-400">Avg Score</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ─── Question Preview Tabs ─── */}
                        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                            <div className="flex border-b border-white/10">
                                <button
                                    onClick={() => setPreviewMode('mcq')}
                                    className={`flex-1 px-5 py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${previewMode === 'mcq'
                                        ? 'bg-emerald-600/20 text-emerald-300 border-b-2 border-emerald-400'
                                        : 'text-gray-400 hover:bg-white/5'
                                        }`}
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    MCQs ({dailyWork.mcq_questions.length})
                                    <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 rounded-full">Online • Auto-graded</span>
                                </button>
                                <button
                                    onClick={() => setPreviewMode('homework')}
                                    className={`flex-1 px-5 py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${previewMode === 'homework'
                                        ? 'bg-blue-600/20 text-blue-300 border-b-2 border-blue-400'
                                        : 'text-gray-400 hover:bg-white/5'
                                        }`}
                                >
                                    <FileText className="w-4 h-4" />
                                    Homework ({dailyWork.homework_questions.length})
                                    <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 rounded-full">Offline • Notebook</span>
                                </button>
                            </div>

                            {/* ─── Question List ─── */}
                            <div className="divide-y divide-white/5">
                                {previewMode === 'mcq' ? (
                                    dailyWork.mcq_questions.map((q, idx) => (
                                        editingQuestionId === q.question_id ? (
                                            renderMCQEditForm(idx)
                                        ) : (
                                            <div key={q.question_id} className="p-5 hover:bg-white/[0.02] transition-colors group">
                                                <div className="flex items-start gap-3">
                                                    <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold">
                                                        {idx + 1}
                                                    </span>
                                                    <div className="flex-1">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <p className="text-white font-medium leading-relaxed">{q.question_text}</p>
                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${difficultyColors[q.difficulty] || difficultyColors.medium}`}>
                                                                    {q.difficulty?.toUpperCase()}
                                                                </span>
                                                                <span className={`text-[10px] font-medium ${typeColors[q.type] || 'text-gray-400'}`}>
                                                                    {q.type}
                                                                </span>

                                                                {/* Edit/Delete buttons (only before publishing) */}
                                                                {dailyWork.status === 'generated' && (
                                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button
                                                                            onClick={() => startEditing(q, 'mcq')}
                                                                            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-blue-400"
                                                                            title="Edit question"
                                                                        >
                                                                            <Pencil className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => deleteQuestion(q.question_id, 'mcq')}
                                                                            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-red-400"
                                                                            title="Delete question"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Options */}
                                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                                            {(q.options || []).map((opt, oi) => (
                                                                <div
                                                                    key={oi}
                                                                    className={`px-3 py-2 rounded-lg text-sm ${opt === q.correct_answer
                                                                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                                                                        : 'bg-white/5 border border-white/10 text-gray-300'
                                                                        }`}
                                                                >
                                                                    {opt === q.correct_answer && (
                                                                        <Check className="w-3.5 h-3.5 inline mr-1.5 text-emerald-400" />
                                                                    )}
                                                                    {opt}
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Expandable explanation */}
                                                        {q.explanation && (
                                                            <button
                                                                onClick={() => setExpandedQ(expandedQ === q.question_id ? null : q.question_id)}
                                                                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-300 mt-3 transition-colors"
                                                            >
                                                                {expandedQ === q.question_id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                                Explanation
                                                            </button>
                                                        )}
                                                        {expandedQ === q.question_id && q.explanation && (
                                                            <div className="mt-2 px-3 py-2 bg-white/5 rounded-lg text-sm text-gray-300 border-l-2 border-emerald-500/50">
                                                                {q.explanation}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    ))
                                ) : (
                                    dailyWork.homework_questions.map((q, idx) => (
                                        editingQuestionId === q.question_id ? (
                                            renderHomeworkEditForm(idx)
                                        ) : (
                                            <div key={q.question_id} className="p-5 hover:bg-white/[0.02] transition-colors group">
                                                <div className="flex items-start gap-3">
                                                    <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-blue-500/20 text-blue-400 rounded-lg text-xs font-bold">
                                                        {idx + 1}
                                                    </span>
                                                    <div className="flex-1">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <p className="text-white font-medium leading-relaxed">{q.question_text}</p>
                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${difficultyColors[q.difficulty] || difficultyColors.medium}`}>
                                                                    {q.difficulty?.toUpperCase()}
                                                                </span>
                                                                <span className="text-[10px] font-medium text-blue-400">
                                                                    {q.format?.replace('_', ' ')}
                                                                </span>

                                                                {dailyWork.status === 'generated' && (
                                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button
                                                                            onClick={() => startEditing(q, 'homework')}
                                                                            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-blue-400"
                                                                            title="Edit question"
                                                                        >
                                                                            <Pencil className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => deleteQuestion(q.question_id, 'homework')}
                                                                            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-red-400"
                                                                            title="Delete question"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {q.expected_answer_guide && (
                                                            <>
                                                                <button
                                                                    onClick={() => setExpandedQ(expandedQ === q.question_id ? null : q.question_id)}
                                                                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-300 mt-3 transition-colors"
                                                                >
                                                                    {expandedQ === q.question_id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                                    Expected Answer Guide
                                                                </button>
                                                                {expandedQ === q.question_id && (
                                                                    <div className="mt-2 px-3 py-2 bg-white/5 rounded-lg text-sm text-gray-300 border-l-2 border-blue-500/50">
                                                                        {q.expected_answer_guide}
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    ))
                                )}

                                {((previewMode === 'mcq' && dailyWork.mcq_questions.length === 0) ||
                                    (previewMode === 'homework' && dailyWork.homework_questions.length === 0)) && (
                                        <div className="p-10 text-center">
                                            <FileText className="w-12 h-12 text-gray-500/30 mx-auto mb-3" />
                                            <p className="text-gray-400">No {previewMode === 'mcq' ? 'MCQ' : 'homework'} questions generated</p>
                                        </div>
                                    )}
                            </div>
                        </div>

                        {/* ─── Regenerate Button ─── */}
                        {dailyWork.status === 'generated' && (
                            <div className="flex justify-center">
                                <button
                                    onClick={handleGenerate}
                                    disabled={generating}
                                    className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2"
                                >
                                    <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                                    Regenerate Questions
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/* ─── Info Card ─── */}
                <div className="bg-white/[0.03] rounded-xl border border-white/5 p-5">
                    <h3 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
                        <Brain className="w-4 h-4" />
                        How Daily Work Works
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-400">
                        <div className="flex items-start gap-2">
                            <span className="w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                            <p><span className="text-white font-medium">Generate</span> — AI creates 10 MCQs + 3 homework questions from selected topics</p>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                            <p><span className="text-white font-medium">Review & Edit</span> — Edit, delete, or modify any question before publishing</p>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                            <p><span className="text-white font-medium">Students Practice</span> — MCQs auto-graded, homework viewed on phone & written in notebook</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )

    // ─── Edit Form Renderers ─────────────────────────────

    function renderMCQEditForm(idx: number) {
        if (!editForm) return null

        return (
            <div key={editForm.question_id} className="p-5 bg-blue-600/5 border-l-2 border-blue-500">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                        <Edit3 className="w-4 h-4" />
                        Editing MCQ #{idx + 1}
                    </h4>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={saveQuestionEdit}
                            className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/30 flex items-center gap-1"
                        >
                            <Check className="w-3.5 h-3.5" /> Save
                        </button>
                        <button
                            onClick={cancelEditing}
                            className="px-3 py-1.5 bg-white/5 text-gray-400 rounded-lg text-xs font-medium hover:bg-white/10 flex items-center gap-1"
                        >
                            <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                    </div>
                </div>

                <div className="space-y-3">
                    {/* Question text */}
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">Question</label>
                        <textarea
                            value={editForm.question_text}
                            onChange={(e) => setEditForm({ ...editForm, question_text: e.target.value })}
                            className="w-full p-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm resize-none"
                            rows={2}
                        />
                    </div>

                    {/* Options */}
                    <div className="grid grid-cols-2 gap-2">
                        {(editForm.options || []).map((opt: string, oi: number) => (
                            <div key={oi} className="relative">
                                <label className="text-[10px] text-gray-500 mb-0.5 block">Option {String.fromCharCode(65 + oi)}</label>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="radio"
                                        name="correct_answer"
                                        checked={editForm.correct_answer === opt}
                                        onChange={() => setEditForm({ ...editForm, correct_answer: opt })}
                                        className="w-3.5 h-3.5 accent-emerald-500"
                                    />
                                    <input
                                        value={opt}
                                        onChange={(e) => {
                                            const newOpts = [...editForm.options]
                                            const wasCorrect = editForm.correct_answer === newOpts[oi]
                                            newOpts[oi] = e.target.value
                                            setEditForm({
                                                ...editForm,
                                                options: newOpts,
                                                ...(wasCorrect && { correct_answer: e.target.value }),
                                            })
                                        }}
                                        className="flex-1 px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">Difficulty</label>
                            <select
                                value={editForm.difficulty}
                                onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value })}
                                className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-xs"
                            >
                                <option value="easy" className="bg-gray-800">Easy</option>
                                <option value="medium" className="bg-gray-800">Medium</option>
                                <option value="hard" className="bg-gray-800">Hard</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">Type</label>
                            <select
                                value={editForm.type}
                                onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                                className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-xs"
                            >
                                <option value="knowledge" className="bg-gray-800">Knowledge</option>
                                <option value="comprehension" className="bg-gray-800">Comprehension</option>
                                <option value="application" className="bg-gray-800">Application</option>
                                <option value="analysis" className="bg-gray-800">Analysis</option>
                                <option value="synthesis" className="bg-gray-800">Synthesis</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">Explanation</label>
                            <input
                                value={editForm.explanation || ''}
                                onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })}
                                className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-xs"
                                placeholder="Why is this correct?"
                            />
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    function renderHomeworkEditForm(idx: number) {
        if (!editForm) return null

        return (
            <div key={editForm.question_id} className="p-5 bg-blue-600/5 border-l-2 border-blue-500">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                        <Edit3 className="w-4 h-4" />
                        Editing Homework #{idx + 1}
                    </h4>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={saveQuestionEdit}
                            className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/30 flex items-center gap-1"
                        >
                            <Check className="w-3.5 h-3.5" /> Save
                        </button>
                        <button
                            onClick={cancelEditing}
                            className="px-3 py-1.5 bg-white/5 text-gray-400 rounded-lg text-xs font-medium hover:bg-white/10 flex items-center gap-1"
                        >
                            <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                    </div>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">Question</label>
                        <textarea
                            value={editForm.question_text}
                            onChange={(e) => setEditForm({ ...editForm, question_text: e.target.value })}
                            className="w-full p-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm resize-none"
                            rows={3}
                        />
                    </div>

                    <div>
                        <label className="text-xs text-gray-400 mb-1 block">Expected Answer Guide</label>
                        <textarea
                            value={editForm.expected_answer_guide || ''}
                            onChange={(e) => setEditForm({ ...editForm, expected_answer_guide: e.target.value })}
                            className="w-full p-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm resize-none"
                            rows={2}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">Difficulty</label>
                            <select
                                value={editForm.difficulty}
                                onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value })}
                                className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-xs"
                            >
                                <option value="easy" className="bg-gray-800">Easy</option>
                                <option value="medium" className="bg-gray-800">Medium</option>
                                <option value="hard" className="bg-gray-800">Hard</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">Format</label>
                            <select
                                value={editForm.format}
                                onChange={(e) => setEditForm({ ...editForm, format: e.target.value })}
                                className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-xs"
                            >
                                <option value="short_answer" className="bg-gray-800">Short Answer</option>
                                <option value="long_answer" className="bg-gray-800">Long Answer</option>
                                <option value="critical_thinking" className="bg-gray-800">Critical Thinking</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}

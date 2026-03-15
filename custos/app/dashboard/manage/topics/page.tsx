'use client'

import { useState, useEffect } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, BookOpen, Layers, Clock, Brain, FileText,
    ChevronRight, Search, Sparkles, Loader2, Check, Eye,
    EyeOff, Edit3, Save, Send, ChevronDown, ChevronUp
} from 'lucide-react'

interface SyllabusDocument {
    document_id: string
    chapter_title: string
    grade_level: number
    subject_id: string
    subjects: { name: string; code: string }
}

interface LessonPlan {
    plan_id: string
    document_id: string
    status: string
    class_id: string
}

interface LessonResource {
    resource_id: string
    document_id: string
    status: string
    lesson_notes: any
    study_guide: any
    worksheet: any
    revision_notes: any
    formulas_list: any
    published_at: string | null
}

const RESOURCE_TYPES = [
    { id: 'lesson_notes', label: 'Lesson Notes', icon: FileText, color: 'from-purple-500 to-indigo-600' },
    { id: 'study_guide', label: 'Study Guide', icon: BookOpen, color: 'from-blue-500 to-cyan-600' },
    { id: 'worksheet', label: 'Worksheet', icon: Layers, color: 'from-green-500 to-emerald-600' },
    { id: 'revision_notes', label: 'Revision Notes', icon: Brain, color: 'from-orange-500 to-amber-600' },
    { id: 'formulas_list', label: 'Formulas', icon: Sparkles, color: 'from-red-500 to-rose-600' },
]

export default function TopicsListPage() {
    const { goBack, router } = useSmartBack('/dashboard/manage')

    const [documents, setDocuments] = useState<SyllabusDocument[]>([])
    const [selectedDocId, setSelectedDocId] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [lessonPlans, setLessonPlans] = useState<Record<string, LessonPlan>>({})
    const [resources, setResources] = useState<Record<string, LessonResource>>({})
    const [generating, setGenerating] = useState<string | null>(null)
    const [publishing, setPublishing] = useState<string | null>(null)
    const [expandedDoc, setExpandedDoc] = useState<string | null>(null)
    const [viewingResource, setViewingResource] = useState<{ docId: string; type: string } | null>(null)
    const [userData, setUserData] = useState<any>(null)

    useEffect(() => {
        loadDocuments()
    }, [])

    async function loadDocuments() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }

            const { data: user } = await supabase
                .from('users')
                .select('user_id, role, school_id, class_id')
                .eq('email', session.user.email)
                .single()

            if (!user || !['super_admin', 'sub_admin', 'teacher'].includes(user.role)) {
                router.replace('/dashboard/redirect')
                return
            }

            setUserData(user)

            // Get subject IDs for this teacher
            let subjectIds: string[] = []
            const isAdmin = ['super_admin', 'sub_admin'].includes(user.role)

            if (isAdmin) {
                const { data: schoolSubjects } = await supabase
                    .from('subjects')
                    .select('subject_id')
                    .eq('school_id', user.school_id)
                subjectIds = schoolSubjects?.map(s => s.subject_id) || []
            } else {
                const { data: entries } = await supabase
                    .from('timetable_entries')
                    .select('subject_id')
                    .eq('teacher_id', user.user_id)
                subjectIds = [...new Set((entries || []).map(e => e.subject_id).filter(Boolean))]
                
                if (subjectIds.length === 0) {
                    const { data: schoolSubjects } = await supabase
                        .from('subjects')
                        .select('subject_id')
                        .eq('school_id', user.school_id)
                    subjectIds = schoolSubjects?.map(s => s.subject_id) || []
                }
            }

            if (subjectIds.length === 0) {
                setDocuments([])
                setLoading(false)
                return
            }

            // Fetch docs
            const { data: docs } = await supabase
                .from('syllabus_documents')
                .select('document_id, chapter_title, grade_level, subject_id')
                .in('subject_id', subjectIds)
                .order('grade_level', { ascending: true })

            // Get subject names
            const uniqueSubjectIds = [...new Set((docs || []).map(d => d.subject_id))]
            const { data: subjectsData } = uniqueSubjectIds.length > 0
                ? await supabase.from('subjects').select('subject_id, name, code').in('subject_id', uniqueSubjectIds)
                : { data: [] }

            const subjectLookup = new Map((subjectsData || []).map((s: any) => [s.subject_id, { name: s.name, code: s.code }]))

            const formatted = (docs || []).map((item: any) => ({
                ...item,
                subjects: subjectLookup.get(item.subject_id) || { name: 'Unknown', code: '?' }
            }))

            setDocuments(formatted)

            // Load lesson plan statuses for all docs
            const docIds = formatted.map(d => d.document_id)
            if (docIds.length > 0) {
                const { data: plans } = await supabase
                    .from('lesson_plans')
                    .select('plan_id, document_id, status, class_id')
                    .in('document_id', docIds)

                const planMap: Record<string, LessonPlan> = {}
                for (const plan of (plans || [])) {
                    if (!planMap[plan.document_id] || plan.status === 'completed') {
                        planMap[plan.document_id] = plan
                    }
                }
                setLessonPlans(planMap)

                // Load existing lesson_resources
                const { data: res } = await supabase
                    .from('lesson_resources')
                    .select('*')
                    .in('document_id', docIds)

                const resMap: Record<string, LessonResource> = {}
                for (const r of (res || [])) {
                    resMap[r.document_id] = r
                }
                setResources(resMap)
            }

        } catch (error) {
            console.error('Error loading documents:', error)
        } finally {
            setLoading(false)
        }
    }

    function isLessonCompleted(docId: string): boolean {
        const plan = lessonPlans[docId]
        return plan?.status === 'completed'
    }

    function hasResources(docId: string): boolean {
        return !!resources[docId]
    }

    function isPublished(docId: string): boolean {
        return resources[docId]?.status === 'published'
    }

    async function generateResources(docId: string) {
        const doc = documents.find(d => d.document_id === docId)
        if (!doc) return

        setGenerating(docId)
        try {
            const res = await fetch('/api/resources/lesson', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    document_id: docId,
                    class_id: userData?.class_id || lessonPlans[docId]?.class_id || null,
                    subject_id: doc.subject_id,
                    action: 'generate'
                })
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Generation failed')
            }

            const result = await res.json()
            if (result.resource) {
                setResources(prev => ({
                    ...prev,
                    [docId]: result.resource
                }))
            }
        } catch (error: any) {
            console.error('Generation error:', error)
            alert('Failed to generate: ' + error.message)
        } finally {
            setGenerating(null)
        }
    }

    async function togglePublish(docId: string) {
        const current = resources[docId]
        if (!current) return

        const action = current.status === 'published' ? 'unpublish' : 'publish'
        setPublishing(docId)

        try {
            const res = await fetch('/api/resources/lesson', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    document_id: docId,
                    action
                })
            })

            if (!res.ok) throw new Error('Failed')

            const result = await res.json()
            if (result.resource) {
                setResources(prev => ({
                    ...prev,
                    [docId]: result.resource
                }))
            }
        } catch (error: any) {
            alert('Failed: ' + error.message)
        } finally {
            setPublishing(null)
        }
    }

    const getStatusBadge = (docId: string) => {
        const plan = lessonPlans[docId]
        const res = resources[docId]

        if (res?.status === 'published') {
            return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Published</span>
        }
        if (res) {
            return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">Draft</span>
        }
        if (plan?.status === 'completed') {
            return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">Ready to Generate</span>
        }
        if (plan) {
            return <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-semibold">In Progress</span>
        }
        return <span className="px-3 py-1 bg-gray-100 text-gray-400 rounded-full text-xs font-semibold">Not Started</span>
    }

    // Simple content viewer
    const renderResourceContent = (content: any) => {
        if (!content) return <p className="text-gray-400 italic">Not generated yet</p>

        if (typeof content === 'string') {
            return <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">{content}</div>
        }

        if (Array.isArray(content)) {
            return (
                <div className="space-y-3">
                    {content.map((item: any, i: number) => (
                        <div key={i} className="p-4 bg-gray-50 rounded-xl border">
                            {typeof item === 'string' ? (
                                <p className="text-gray-700">{item}</p>
                            ) : (
                                <pre className="text-sm text-gray-600 whitespace-pre-wrap">{JSON.stringify(item, null, 2)}</pre>
                            )}
                        </div>
                    ))}
                </div>
            )
        }

        if (typeof content === 'object') {
            return (
                <div className="space-y-4">
                    {Object.entries(content).map(([key, value]: [string, any]) => (
                        <div key={key}>
                            <h4 className="font-semibold text-gray-900 mb-2 capitalize">{key.replace(/_/g, ' ')}</h4>
                            {typeof value === 'string' ? (
                                <p className="text-gray-700 whitespace-pre-wrap">{value}</p>
                            ) : Array.isArray(value) ? (
                                <ul className="space-y-2 ml-4">
                                    {value.map((item: any, i: number) => (
                                        <li key={i} className="text-gray-600">
                                            {typeof item === 'string' ? `• ${item}` : (
                                                <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(item, null, 2)}</pre>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <pre className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">{JSON.stringify(value, null, 2)}</pre>
                            )}
                        </div>
                    ))}
                </div>
            )
        }

        return <p className="text-gray-500">{String(content)}</p>
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={goBack} className="p-2 hover:bg-white rounded-lg transition-colors">
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Lesson Resources</h1>
                            <p className="text-gray-600">Generate study materials after completing lessons</p>
                        </div>
                    </div>
                    <BookOpen className="w-10 h-10 text-purple-600" />
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
                    </div>
                ) : documents.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
                        <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No Lessons Found</h3>
                        <p className="text-gray-500">Upload syllabus documents to get started</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {documents.map(doc => {
                            const completed = isLessonCompleted(doc.document_id)
                            const hasRes = hasResources(doc.document_id)
                            const published = isPublished(doc.document_id)
                            const isExpanded = expandedDoc === doc.document_id
                            const isGenerating = generating === doc.document_id
                            const isPublishing = publishing === doc.document_id
                            const resource = resources[doc.document_id]

                            return (
                                <div key={doc.document_id} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
                                    {/* Lesson Header */}
                                    <div
                                        className="p-6 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                                        onClick={() => setExpandedDoc(isExpanded ? null : doc.document_id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                                published ? 'bg-green-100' :
                                                hasRes ? 'bg-yellow-100' :
                                                completed ? 'bg-blue-100' : 'bg-gray-100'
                                            }`}>
                                                <BookOpen className={`w-6 h-6 ${
                                                    published ? 'text-green-600' :
                                                    hasRes ? 'text-yellow-600' :
                                                    completed ? 'text-blue-600' : 'text-gray-400'
                                                }`} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900">{doc.chapter_title}</h3>
                                                <p className="text-sm text-gray-500">
                                                    {doc.subjects?.name} • Grade {doc.grade_level}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {getStatusBadge(doc.document_id)}
                                            {isExpanded ? (
                                                <ChevronUp className="w-5 h-5 text-gray-400" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div className="border-t border-gray-100 p-6 space-y-4">
                                            {/* Action Buttons */}
                                            <div className="flex flex-wrap gap-3">
                                                {!hasRes && completed && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); generateResources(doc.document_id) }}
                                                        disabled={isGenerating}
                                                        className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium flex items-center gap-2 hover:shadow-lg transition-all disabled:opacity-50"
                                                    >
                                                        {isGenerating ? (
                                                            <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                                                        ) : (
                                                            <><Sparkles className="w-4 h-4" /> Generate Resources</>
                                                        )}
                                                    </button>
                                                )}

                                                {!hasRes && !completed && (
                                                    <p className="text-sm text-gray-500 italic py-2">
                                                        Complete the lesson plan first to generate resources.
                                                    </p>
                                                )}

                                                {hasRes && !published && (
                                                    <>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); generateResources(doc.document_id) }}
                                                            disabled={isGenerating}
                                                            className="px-4 py-2 bg-purple-100 text-purple-700 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-purple-200 transition-colors disabled:opacity-50"
                                                        >
                                                            {isGenerating ? (
                                                                <><Loader2 className="w-4 h-4 animate-spin" /> Regenerating...</>
                                                            ) : (
                                                                <><Sparkles className="w-4 h-4" /> Regenerate</>
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); togglePublish(doc.document_id) }}
                                                            disabled={isPublishing}
                                                            className="px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 hover:shadow-lg transition-all disabled:opacity-50"
                                                        >
                                                            {isPublishing ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <><Send className="w-4 h-4" /> Publish for Students</>
                                                            )}
                                                        </button>
                                                    </>
                                                )}

                                                {published && (
                                                    <>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); togglePublish(doc.document_id) }}
                                                            disabled={isPublishing}
                                                            className="px-4 py-2 bg-red-100 text-red-600 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-red-200 transition-colors disabled:opacity-50"
                                                        >
                                                            {isPublishing ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <><EyeOff className="w-4 h-4" /> Unpublish</>
                                                            )}
                                                        </button>
                                                        <span className="flex items-center gap-1 text-sm text-green-600 font-medium py-2">
                                                            <Check className="w-4 h-4" /> Visible to students
                                                        </span>
                                                    </>
                                                )}
                                            </div>

                                            {/* Resource Types Grid */}
                                            {hasRes && (
                                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                                    {RESOURCE_TYPES.map(rt => {
                                                        const hasThis = !!resource?.[rt.id as keyof LessonResource]
                                                        const isViewing = viewingResource?.docId === doc.document_id && viewingResource?.type === rt.id
                                                        const Icon = rt.icon

                                                        return (
                                                            <button
                                                                key={rt.id}
                                                                onClick={() => setViewingResource(isViewing ? null : { docId: doc.document_id, type: rt.id })}
                                                                className={`p-4 rounded-xl border-2 text-center transition-all ${
                                                                    isViewing
                                                                        ? 'border-purple-500 bg-purple-50 shadow-md'
                                                                        : hasThis
                                                                            ? 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm'
                                                                            : 'border-gray-100 bg-gray-50 opacity-50'
                                                                }`}
                                                            >
                                                                <Icon className={`w-6 h-6 mx-auto mb-2 ${
                                                                    isViewing ? 'text-purple-600' :
                                                                    hasThis ? 'text-gray-700' : 'text-gray-300'
                                                                }`} />
                                                                <p className={`text-xs font-medium ${
                                                                    isViewing ? 'text-purple-700' :
                                                                    hasThis ? 'text-gray-700' : 'text-gray-400'
                                                                }`}>{rt.label}</p>
                                                                {hasThis && (
                                                                    <Check className="w-3 h-3 text-green-500 mx-auto mt-1" />
                                                                )}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            )}

                                            {/* Content Viewer */}
                                            {viewingResource?.docId === doc.document_id && resource && (
                                                <div className="mt-4 p-6 bg-gray-50 rounded-2xl border border-gray-200 max-h-[500px] overflow-y-auto">
                                                    <h4 className="text-lg font-bold text-gray-900 mb-4">
                                                        {RESOURCE_TYPES.find(r => r.id === viewingResource.type)?.label}
                                                    </h4>
                                                    {renderResourceContent(
                                                        resource[viewingResource.type as keyof LessonResource]
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

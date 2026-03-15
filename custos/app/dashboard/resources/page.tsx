'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, BookOpen, FileText, Brain, Layers,
    Sparkles, Loader2, ChevronRight, Search, ChevronDown, ChevronUp
} from 'lucide-react'

interface LessonResource {
    resource_id: string
    document_id: string
    subject_id: string
    subject_name: string
    chapter_title: string
    grade_level: number
    status: string
    published_at: string
    lesson_notes: any
    study_guide: any
    worksheet: any
    revision_notes: any
    formulas_list: any
}

const RESOURCE_TYPES = [
    { id: 'lesson_notes', label: 'Lesson Notes', icon: FileText, color: 'bg-purple-100 text-purple-600' },
    { id: 'study_guide', label: 'Study Guide', icon: BookOpen, color: 'bg-blue-100 text-blue-600' },
    { id: 'worksheet', label: 'Worksheet', icon: Layers, color: 'bg-green-100 text-green-600' },
    { id: 'revision_notes', label: 'Revision Notes', icon: Brain, color: 'bg-orange-100 text-orange-600' },
    { id: 'formulas_list', label: 'Formulas', icon: Sparkles, color: 'bg-red-100 text-red-600' },
]

export default function StudentResourcesPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [resources, setResources] = useState<LessonResource[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
    const [expandedLesson, setExpandedLesson] = useState<string | null>(null)
    const [viewingContent, setViewingContent] = useState<{ resId: string; type: string } | null>(null)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }

            const { data: userData } = await supabase
                .from('users')
                .select('user_id, role, class_id')
                .eq('email', session.user.email)
                .single()

            if (!userData) {
                router.push('/login')
                return
            }

            // Fetch published lesson resources for student's class
            const { data: lessonRes, error } = await supabase
                .from('lesson_resources')
                .select('*')
                .eq('status', 'published')
                .eq('class_id', userData.class_id)

            if (error) {
                console.error('Error fetching resources:', error)
            }

            if (lessonRes && lessonRes.length > 0) {
                // Get document info
                const docIds = [...new Set(lessonRes.map(r => r.document_id))]
                const { data: docs } = await supabase
                    .from('syllabus_documents')
                    .select('document_id, chapter_title, grade_level, subject_id')
                    .in('document_id', docIds)

                // Get subject names
                const subjectIds = [...new Set((docs || []).map(d => d.subject_id).filter(Boolean))]
                const subjectMap: Record<string, string> = {}
                if (subjectIds.length > 0) {
                    const { data: subjects } = await supabase
                        .from('subjects')
                        .select('subject_id, name')
                        .in('subject_id', subjectIds)
                    subjects?.forEach(s => { subjectMap[s.subject_id] = s.name })
                }

                const docMap = new Map((docs || []).map(d => [d.document_id, d]))

                const formatted: LessonResource[] = lessonRes.map(r => {
                    const doc = docMap.get(r.document_id) as any || {}
                    return {
                        ...r,
                        chapter_title: doc.chapter_title || 'Lesson',
                        grade_level: doc.grade_level || 0,
                        subject_name: subjectMap[doc.subject_id] || 'Unknown',
                        subject_id: doc.subject_id || '',
                    }
                })

                setResources(formatted)
            } else {
                setResources([])
            }

        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    // Get unique subjects
    const subjects = [...new Set(resources.map(r => r.subject_name))].sort()

    const filteredResources = resources.filter(r => {
        const matchesSearch = searchQuery === '' ||
            r.chapter_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.subject_name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesSubject = !selectedSubject || r.subject_name === selectedSubject
        return matchesSearch && matchesSubject
    })

    const renderContent = (content: any) => {
        if (!content) return <p className="text-gray-400 italic">Not available</p>

        if (typeof content === 'string') {
            return <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">{content}</div>
        }

        if (Array.isArray(content)) {
            return (
                <div className="space-y-3">
                    {content.map((item: any, i: number) => (
                        <div key={i} className="p-4 bg-white rounded-xl border border-gray-100">
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
                                <ul className="space-y-1 ml-4">
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

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-teal-100">
                <Loader2 className="w-12 h-12 text-teal-600 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100">
            {/* Header */}
            <header className="bg-white border-b shadow-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4 mb-4">
                        <button onClick={() => router.push('/dashboard/student')} className="p-2 hover:bg-gray-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Study Materials</h1>
                            <p className="text-sm text-gray-500">Access your lesson resources</p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search lessons..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                        />
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6 space-y-6">
                {/* Subject Filter */}
                {subjects.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        <button
                            onClick={() => setSelectedSubject(null)}
                            className={`px-4 py-2 rounded-full whitespace-nowrap transition-all ${!selectedSubject
                                    ? 'bg-teal-600 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            All Subjects
                        </button>
                        {subjects.map(sub => (
                            <button
                                key={sub}
                                onClick={() => setSelectedSubject(sub)}
                                className={`px-4 py-2 rounded-full whitespace-nowrap transition-all ${selectedSubject === sub
                                        ? 'bg-teal-600 text-white'
                                        : 'bg-white text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                {sub}
                            </button>
                        ))}
                    </div>
                )}

                {/* Lessons List */}
                {filteredResources.length > 0 ? (
                    <div className="space-y-4">
                        {filteredResources.map(res => {
                            const isExpanded = expandedLesson === res.resource_id
                            const availableTypes = RESOURCE_TYPES.filter(rt => !!res[rt.id as keyof LessonResource])

                            return (
                                <div key={res.resource_id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                                    {/* Lesson Header */}
                                    <button
                                        onClick={() => setExpandedLesson(isExpanded ? null : res.resource_id)}
                                        className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                                                <BookOpen className="w-6 h-6 text-teal-600" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{res.chapter_title}</p>
                                                <p className="text-sm text-gray-500">
                                                    {res.subject_name} • {availableTypes.length} resources
                                                </p>
                                            </div>
                                        </div>
                                        {isExpanded ? (
                                            <ChevronUp className="w-5 h-5 text-gray-400" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-gray-400" />
                                        )}
                                    </button>

                                    {/* Expanded */}
                                    {isExpanded && (
                                        <div className="border-t border-gray-100 p-5 space-y-4">
                                            {/* Resource Type Buttons */}
                                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                                {RESOURCE_TYPES.map(rt => {
                                                    const hasThis = !!res[rt.id as keyof LessonResource]
                                                    const isViewing = viewingContent?.resId === res.resource_id && viewingContent?.type === rt.id
                                                    const Icon = rt.icon

                                                    if (!hasThis) return null

                                                    return (
                                                        <button
                                                            key={rt.id}
                                                            onClick={() => setViewingContent(isViewing ? null : { resId: res.resource_id, type: rt.id })}
                                                            className={`p-3 rounded-xl text-center transition-all ${
                                                                isViewing
                                                                    ? 'bg-teal-100 border-2 border-teal-500 shadow-md'
                                                                    : 'bg-gray-50 border-2 border-transparent hover:border-teal-200 hover:bg-teal-50'
                                                            }`}
                                                        >
                                                            <Icon className={`w-5 h-5 mx-auto mb-1 ${
                                                                isViewing ? 'text-teal-600' : 'text-gray-600'
                                                            }`} />
                                                            <p className={`text-xs font-medium ${
                                                                isViewing ? 'text-teal-700' : 'text-gray-600'
                                                            }`}>{rt.label}</p>
                                                        </button>
                                                    )
                                                })}
                                            </div>

                                            {/* Content Viewer */}
                                            {viewingContent?.resId === res.resource_id && (
                                                <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200 max-h-[500px] overflow-y-auto">
                                                    <h4 className="text-lg font-bold text-gray-900 mb-4">
                                                        {RESOURCE_TYPES.find(r => r.id === viewingContent.type)?.label}
                                                    </h4>
                                                    {renderContent(
                                                        res[viewingContent.type as keyof LessonResource]
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                        <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No Study Materials Yet</h3>
                        <p className="text-gray-500">Your teacher will publish resources after completing lessons.</p>
                    </div>
                )}
            </main>
        </div>
    )
}

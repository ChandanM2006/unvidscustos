'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, BookOpen, FileText, Brain, ClipboardList,
    Calculator, Loader2, Download, Check
} from 'lucide-react'

interface TopicResource {
    resource_id: string
    lesson_notes: any
    study_guide: any
    worksheet: any
    revision_notes: any
    formulas_list: any
}

const RESOURCE_TYPES = [
    { id: 'lesson_notes', label: 'Lesson Notes', icon: FileText, color: 'purple' },
    { id: 'study_guide', label: 'Study Guide', icon: BookOpen, color: 'blue' },
    { id: 'worksheet', label: 'Worksheet', icon: ClipboardList, color: 'green' },
    { id: 'revision_notes', label: 'Revision Notes', icon: Brain, color: 'orange' },
    { id: 'formulas_list', label: 'Formulas', icon: Calculator, color: 'red' },
]

export default function ResourceViewPage() {
    const { goBack } = useSmartBack('/dashboard')
    const params = useParams()
    const topicId = params.topicId as string

    const [loading, setLoading] = useState(true)
    const [topic, setTopic] = useState<any>(null)
    const [resources, setResources] = useState<TopicResource | null>(null)
    const [activeType, setActiveType] = useState<string | null>(null)
    const [viewContent, setViewContent] = useState<any>(null)

    useEffect(() => {
        if (topicId) loadData()
    }, [topicId])

    async function loadData() {
        try {
            // Load topic details
            const { data: topicData } = await supabase
                .from('lesson_topics')
                .select(`
                    *,
                    syllabus_documents (
                        chapter_title,
                        subjects (name)
                    )
                `)
                .eq('topic_id', topicId)
                .single()

            if (topicData) {
                setTopic({
                    ...topicData,
                    chapter_title: topicData.syllabus_documents?.chapter_title,
                    subject_name: topicData.syllabus_documents?.subjects?.name
                })
            }

            // Load resources
            const { data: resourceData } = await supabase
                .from('topic_resources')
                .select('*')
                .eq('topic_id', topicId)
                .single()

            if (resourceData) {
                setResources(resourceData)
                // Auto-select first available resource
                for (const type of RESOURCE_TYPES) {
                    if (resourceData[type.id as keyof TopicResource]) {
                        setActiveType(type.id)
                        setViewContent(resourceData[type.id as keyof TopicResource])
                        break
                    }
                }
            }

        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    function selectResource(typeId: string) {
        if (!resources) return
        const content = resources[typeId as keyof TopicResource]
        if (content) {
            setActiveType(typeId)
            setViewContent(content)
        }
    }

    function hasResource(typeId: string): boolean {
        if (!resources) return false
        return !!resources[typeId as keyof TopicResource]
    }

    const getColorClasses = (color: string, active: boolean) => {
        if (!active) return 'bg-gray-100 text-gray-400'
        const colors: Record<string, string> = {
            purple: 'bg-purple-100 text-purple-700',
            blue: 'bg-blue-100 text-blue-700',
            green: 'bg-green-100 text-green-700',
            orange: 'bg-orange-100 text-orange-700',
            red: 'bg-red-100 text-red-700',
        }
        return colors[color] || colors.purple
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
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-lg">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{topic?.topic_title || 'Topic'}</h1>
                        <p className="text-sm text-gray-500">
                            {topic?.subject_name} • {topic?.chapter_title}
                        </p>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto p-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Resource Type Selector */}
                    <div className="lg:col-span-1 space-y-2">
                        <h3 className="font-semibold text-gray-900 mb-3">Resources</h3>
                        {RESOURCE_TYPES.map(type => {
                            const Icon = type.icon
                            const available = hasResource(type.id)
                            const isActive = activeType === type.id

                            return (
                                <button
                                    key={type.id}
                                    onClick={() => available && selectResource(type.id)}
                                    disabled={!available}
                                    className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${isActive
                                        ? 'bg-teal-600 text-white shadow-lg'
                                        : available
                                            ? 'bg-white text-gray-700 hover:bg-gray-50'
                                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isActive ? 'bg-white/20' : getColorClasses(type.color, available)
                                        }`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <span className="font-medium text-left flex-1">{type.label}</span>
                                    {available && !isActive && <Check className="w-4 h-4 text-green-500" />}
                                </button>
                            )
                        })}
                    </div>

                    {/* Content Viewer */}
                    <div className="lg:col-span-3">
                        {viewContent ? (
                            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                                <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                                    <h2 className="font-bold text-gray-900">
                                        {viewContent.title || RESOURCE_TYPES.find(r => r.id === activeType)?.label}
                                    </h2>
                                    <button className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 flex items-center gap-2 text-sm">
                                        <Download className="w-4 h-4" />
                                        Download
                                    </button>
                                </div>

                                <div className="p-6 max-h-[600px] overflow-y-auto prose prose-sm max-w-none">
                                    {/* Sections */}
                                    {viewContent.sections && (
                                        <div className="space-y-6">
                                            {viewContent.sections.map((section: any, idx: number) => (
                                                <div key={idx}>
                                                    <h3 className="text-lg font-bold text-gray-900 mb-2">{section.heading}</h3>
                                                    <p className="text-gray-700 whitespace-pre-wrap">{section.content}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Key Concepts */}
                                    {viewContent.key_concepts && (
                                        <div className="mt-6">
                                            <h3 className="text-lg font-bold text-gray-900 mb-3">Key Concepts</h3>
                                            <ul className="list-disc list-inside space-y-1">
                                                {viewContent.key_concepts.map((c: string, i: number) => (
                                                    <li key={i} className="text-gray-700">{c}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Problems/Questions */}
                                    {viewContent.problems && (
                                        <div className="mt-6 space-y-4">
                                            <h3 className="text-lg font-bold text-gray-900">Practice Problems</h3>
                                            {viewContent.problems.map((p: any) => (
                                                <div key={p.number} className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="font-medium text-gray-900">Q{p.number}. {p.question}</p>
                                                    {p.options && (
                                                        <div className="mt-2 space-y-1">
                                                            {p.options.map((opt: string, i: number) => (
                                                                <p key={i} className="text-gray-600 ml-4">
                                                                    ({String.fromCharCode(65 + i)}) {opt}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Must Remember */}
                                    {viewContent.must_remember && (
                                        <div className="mt-6">
                                            <h3 className="text-lg font-bold text-gray-900 mb-3">Must Remember ⭐</h3>
                                            <ul className="space-y-2">
                                                {viewContent.must_remember.map((m: string, i: number) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <span className="text-yellow-500">★</span>
                                                        <span className="font-medium text-gray-800">{m}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Formulas */}
                                    {viewContent.formulas && (
                                        <div className="mt-6 space-y-3">
                                            <h3 className="text-lg font-bold text-gray-900">Formulas</h3>
                                            {viewContent.formulas.map((f: any, i: number) => (
                                                <div key={i} className="p-4 bg-blue-50 rounded-lg">
                                                    <p className="font-mono text-lg text-blue-800">{f.formula}</p>
                                                    <p className="text-sm text-blue-600 mt-1">{f.name}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Fallback */}
                                    {!viewContent.sections && !viewContent.key_concepts && !viewContent.problems && !viewContent.must_remember && !viewContent.formulas && (
                                        <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-x-auto">
                                            {JSON.stringify(viewContent, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-gray-900 mb-2">No Resources Available</h3>
                                <p className="text-gray-500">
                                    Resources for this topic haven't been generated yet.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}

'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, BookOpen, FileText, ClipboardList, Brain,
    Calculator, Sparkles, Loader2, Download, Check, RefreshCw, Edit3
} from 'lucide-react'

interface Topic {
    topic_id: string
    topic_number: number
    topic_title: string
    content: any
    estimated_duration_minutes: number
    difficulty_level: string
    document_id: string
    syllabus_documents: {
        grade_level: number
        subjects: {
            name: string
        }
    }
}

interface TopicResource {
    resource_id: string
    topic_id: string
    lesson_notes: any
    study_guide: any
    worksheet: any
    revision_notes: any
    formulas_list: any
}

const RESOURCE_TYPES = [
    { id: 'lesson_notes', label: 'Lesson Notes', icon: FileText, color: 'purple', description: 'Detailed teaching notes' },
    { id: 'study_guide', label: 'Study Guide', icon: BookOpen, color: 'blue', description: 'Student study material' },
    { id: 'worksheet', label: 'Worksheet', icon: ClipboardList, color: 'green', description: 'Practice problems' },
    { id: 'revision_notes', label: 'Revision Notes', icon: Brain, color: 'orange', description: 'Quick review cheat sheet' },
    { id: 'formulas_list', label: 'Formulas', icon: Calculator, color: 'red', description: 'All formulas & definitions' },
]

export default function TopicResourcesPage() {
    const { goBack } = useSmartBack('/dashboard/manage/topics')
    const params = useParams()
    const topicId = params.id as string

    const [topic, setTopic] = useState<Topic | null>(null)
    const [resources, setResources] = useState<TopicResource | null>(null)
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState<string | null>(null) // Which resource is being generated
    const [activeResource, setActiveResource] = useState<string | null>(null)
    const [viewContent, setViewContent] = useState<any>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [editContent, setEditContent] = useState<any>(null)


    useEffect(() => {
        if (topicId) {
            loadTopic()
            loadResources()
        }
    }, [topicId])

    async function loadTopic() {
        try {
            const { data, error } = await supabase
                .from('lesson_topics')
                .select(`
                    *,
                    syllabus_documents (
                        grade_level,
                        subjects (name)
                    )
                `)
                .eq('topic_id', topicId)
                .single()

            if (error) throw error

            // Format nested array
            const formatted = {
                ...data,
                syllabus_documents: {
                    ...data.syllabus_documents,
                    subjects: Array.isArray(data.syllabus_documents?.subjects)
                        ? data.syllabus_documents.subjects[0]
                        : data.syllabus_documents?.subjects
                }
            }
            setTopic(formatted)
        } catch (error: any) {
            console.error('Error loading topic:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadResources() {
        try {
            const { data, error } = await supabase
                .from('topic_resources')
                .select('*')
                .eq('topic_id', topicId)
                .single()

            if (!error && data) {
                setResources(data)
            }
        } catch (error: any) {
            // Resources may not exist yet - that's OK
            console.log('No existing resources')
        }
    }

    async function generateResource(resourceType: string) {
        if (!topic) return
        setGenerating(resourceType)

        try {
            const payload = {
                topic_id: topicId,
                topic_title: topic.topic_title,
                topic_content: topic.content || {},
                resource_type: resourceType,
                grade_level: topic.syllabus_documents?.grade_level || 10,
                subject_name: topic.syllabus_documents?.subjects?.name || 'General'
            }

            // Call AI Service
            const response = await fetch('http://localhost:8000/api/resources/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!response.ok) throw new Error('Generation failed')

            const result = await response.json()

            // Save to database
            const updateData = { [resourceType]: result.content }

            if (resources?.resource_id) {
                // Update existing
                await supabase
                    .from('topic_resources')
                    .update(updateData)
                    .eq('resource_id', resources.resource_id)
            } else {
                // Create new
                await supabase
                    .from('topic_resources')
                    .insert({
                        topic_id: topicId,
                        ...updateData
                    })
            }

            // Reload
            loadResources()
            setActiveResource(resourceType)
            setViewContent(result.content)

        } catch (error: any) {
            console.error('Error generating resource:', error)
            alert('Failed to generate: ' + error.message)
        } finally {
            setGenerating(null)
        }
    }

    function viewResource(resourceType: string) {
        if (!resources) return
        const content = resources[resourceType as keyof TopicResource]
        if (content) {
            setActiveResource(resourceType)
            setViewContent(content)
            setIsEditing(false)
        }
    }

    function hasResource(resourceType: string): boolean {
        if (!resources) return false
        return !!resources[resourceType as keyof TopicResource]
    }

    const getColorClasses = (color: string) => {
        const colors: Record<string, string> = {
            purple: 'bg-purple-100 text-purple-700 border-purple-200',
            blue: 'bg-blue-100 text-blue-700 border-blue-200',
            green: 'bg-green-100 text-green-700 border-green-200',
            orange: 'bg-orange-100 text-orange-700 border-orange-200',
            red: 'bg-red-100 text-red-700 border-red-200',
        }
        return colors[color] || colors.purple
    }

    const handleEditChange = (path: any[], value: any) => {
        setEditContent((prev: any) => {
            const newObj = JSON.parse(JSON.stringify(prev))
            let curr = newObj
            for (let i = 0; i < path.length - 1; i++) {
                curr = curr[path[i]]
            }
            curr[path[path.length - 1]] = value
            return newObj
        })
    }

    const formatLabel = (key: string) => {
        return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }

    // A universal recursive renderer for both Edit and View modes
    const renderContent = (data: any, path: any[] = [], isEditing: boolean = false): any => {
        if (data === null || data === undefined) return null

        if (Array.isArray(data)) {
            // Check if array of strings or simple values
            if (data.length > 0 && typeof data[0] !== 'object') {
                return (
                    <ul className={`space-y-3 ${path.length === 1 ? 'mb-8 bg-purple-50/50 p-6 rounded-2xl border border-purple-100' : ''}`}>
                        {data.map((item, idx) => (
                            <li key={idx} className="flex gap-3">
                                <span className="text-purple-500 mt-1">•</span>
                                {isEditing ? (
                                    <textarea
                                        className="flex-1 rounded-xl border border-gray-200 p-3 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none resize-y min-h-[60px]"
                                        value={item}
                                        onChange={(e) => handleEditChange([...path, idx], e.target.value)}
                                    />
                                ) : (
                                    <span className="text-gray-700 leading-relaxed font-medium">{item}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                )
            } else {
                // Array of objects (like questions, sections, formulas)
                return (
                    <div className="space-y-6">
                        {data.map((item, idx) => (
                            <div key={idx} className={`${path.length === 1 ? 'p-6 bg-white border border-gray-200 rounded-2xl shadow-sm' : 'border-l-2 border-purple-200 pl-4 mb-4'}`}>
                                {renderContent(item, [...path, idx], isEditing)}
                            </div>
                        ))}
                    </div>
                )
            }
        } else if (typeof data === 'object') {
            return (
                <div className="space-y-4">
                    {Object.keys(data).map(key => {
                        // Omit time metadata completely
                        if (key === 'duration_minutes' || key === 'time_taken' || key === 'duration') return null
                        if (key === 'title' && path.length === 0) return null // Handled in header

                        const isTopLevel = path.length === 0

                        return (
                            <div key={key} className={isTopLevel ? 'mb-8' : 'mb-4'}>
                                {isTopLevel && (
                                    <h3 className="text-xl font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">
                                        {formatLabel(key)}
                                    </h3>
                                )}
                                {!isTopLevel && typeof data[key] !== 'object' && (
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                                        {formatLabel(key)}
                                    </label>
                                )}
                                {renderContent(data[key], [...path, key], isEditing)}
                            </div>
                        )
                    })}
                </div>
            )
        } else if (typeof data === 'string' || typeof data === 'number') {
            if (isEditing) {
                if (typeof data === 'number') {
                    return (
                        <input
                            type="number"
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            value={data}
                            onChange={(e) => handleEditChange(path, Number(e.target.value))}
                        />
                    )
                }
                return (
                    <textarea
                        className="text-gray-700 w-full rounded-xl border border-gray-200 p-4 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none leading-relaxed resize-y"
                        value={data}
                        onChange={(e) => handleEditChange(path, e.target.value)}
                        rows={String(data).length > 100 ? 4 : 1}
                    />
                )
            } else {
                return (
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {data}
                    </p>
                )
            }
        }
        return null
    }


    async function saveEdits() {
        if (!activeResource || !resources?.resource_id || !editContent) return

        try {
            const updateData = { [activeResource]: editContent }
            await supabase
                .from('topic_resources')
                .update(updateData)
                .eq('resource_id', resources.resource_id)

            setViewContent(editContent)
            setIsEditing(false)
            loadResources()
        } catch (error: any) {
            alert('Error saving edits: ' + error.message)
        }
    }



    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        )
    }

    if (!topic) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Topic Not Found</h2>
                    <button onClick={goBack} className="text-purple-600 underline">Go Back</button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={goBack}
                        className="p-2 hover:bg-white rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{topic.topic_title}</h1>
                        <p className="text-gray-600">
                            {topic.syllabus_documents?.subjects?.name} • Grade {topic.syllabus_documents?.grade_level}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Resource Cards */}
                    <div className="lg:col-span-1 space-y-4">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">AI Resources</h2>

                        {RESOURCE_TYPES.map(type => {
                            const Icon = type.icon
                            const exists = hasResource(type.id)
                            const isGenerating = generating === type.id
                            const isActive = activeResource === type.id

                            return (
                                <div
                                    key={type.id}
                                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${isActive
                                        ? 'border-purple-500 shadow-lg'
                                        : 'border-gray-200 hover:border-purple-200'
                                        } ${getColorClasses(type.color)} bg-opacity-50`}
                                    onClick={() => exists ? viewResource(type.id) : null}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Icon className="w-6 h-6" />
                                            <div>
                                                <h3 className="font-semibold">{type.label}</h3>
                                                <p className="text-xs opacity-75">{type.description}</p>
                                            </div>
                                        </div>

                                        {exists ? (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); generateResource(type.id) }}
                                                    className="p-1.5 rounded-lg bg-white/50 hover:bg-white transition-colors"
                                                    title="Regenerate"
                                                >
                                                    {isGenerating ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <RefreshCw className="w-4 h-4" />
                                                    )}
                                                </button>
                                                <Check className="w-5 h-5 text-green-600" />
                                            </div>
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); generateResource(type.id) }}
                                                disabled={isGenerating}
                                                className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-sm font-medium flex items-center gap-1 hover:shadow-md transition-all disabled:opacity-50"
                                            >
                                                {isGenerating ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Sparkles className="w-4 h-4" />
                                                )}
                                                Generate
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Content Viewer */}
                    <div className="lg:col-span-2">
                        {viewContent ? (
                            <div className="bg-white rounded-2xl shadow-xl p-6 h-full">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-gray-900">
                                        {viewContent.title || RESOURCE_TYPES.find(r => r.id === activeResource)?.label}
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        {isEditing ? (
                                            <>
                                                <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50">
                                                    Cancel
                                                </button>
                                                <button onClick={saveEdits} className="px-3 py-1.5 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-1">
                                                    <Check className="w-4 h-4" /> Save
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setEditContent(JSON.parse(JSON.stringify(viewContent)))
                                                        setIsEditing(true)
                                                    }}
                                                    className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-1"
                                                >
                                                    <Edit3 className="w-4 h-4" /> Edit
                                                </button>

                                                <button className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                                                    <Download className="w-4 h-4" /> Export
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="prose max-w-none overflow-y-auto max-h-[600px] pb-10">
                                    {isEditing ? (
                                        <div className="space-y-8">
                                            {renderContent(editContent, [], true)}
                                        </div>
                                    ) : (
                                        <div className="space-y-8">
                                            {renderContent(viewContent, [], false)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-xl p-12 h-full flex items-center justify-center text-center">
                                <div>
                                    <Sparkles className="w-16 h-16 text-purple-300 mx-auto mb-4" />
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Generate AI Resources</h3>
                                    <p className="text-gray-500 max-w-md">
                                        Click "Generate" on any resource type to create AI-powered educational content for this topic.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

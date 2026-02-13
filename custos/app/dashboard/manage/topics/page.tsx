'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, BookOpen, Layers, Clock, Brain, FileText,
    ChevronRight, Search, Filter, Sparkles
} from 'lucide-react'

interface SyllabusDocument {
    document_id: string
    chapter_title: string
    grade_level: number
    subjects: {
        name: string
        code: string
    }
}

interface Topic {
    topic_id: string
    topic_number: number
    topic_title: string
    estimated_duration_minutes: number
    difficulty_level: string
    document_id: string
}

export default function TopicsListPage() {
    const router = useRouter()

    const [documents, setDocuments] = useState<SyllabusDocument[]>([])
    const [topics, setTopics] = useState<Topic[]>([])
    const [selectedDocId, setSelectedDocId] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        loadDocuments()
    }, [])

    useEffect(() => {
        if (selectedDocId) {
            loadTopics(selectedDocId)
        } else {
            setTopics([])
        }
    }, [selectedDocId])

    async function loadDocuments() {
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

            const { data, error } = await supabase
                .from('syllabus_documents')
                .select(`
                    document_id,
                    chapter_title,
                    grade_level,
                    subjects:subject_id (name, code)
                `)
                .order('created_at', { ascending: false })

            if (error) throw error
            const formatted = (data || []).map((item: any) => ({
                ...item,
                subjects: Array.isArray(item.subjects) ? item.subjects[0] : item.subjects
            }))
            setDocuments(formatted)
            if (formatted.length > 0) setSelectedDocId(formatted[0].document_id)
        } catch (error) {
            console.error('Error loading documents:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadTopics(docId: string) {
        try {
            const { data, error } = await supabase
                .from('lesson_topics')
                .select('*')
                .eq('document_id', docId)
                .order('topic_number', { ascending: true })

            if (error) throw error
            setTopics(data || [])
        } catch (error) {
            console.error('Error loading topics:', error)
        }
    }

    const selectedDoc = documents.find(d => d.document_id === selectedDocId)

    const filteredTopics = topics.filter(t =>
        t.topic_title.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const getDifficultyColor = (level: string) => {
        switch (level) {
            case 'easy': return 'bg-green-100 text-green-700'
            case 'medium': return 'bg-yellow-100 text-yellow-700'
            case 'hard': return 'bg-red-100 text-red-700'
            default: return 'bg-gray-100 text-gray-700'
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-8">
            <div className="max-w-7xl mx-auto">
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
                            <h1 className="text-3xl font-bold text-gray-900">Topics & Resources</h1>
                            <p className="text-gray-600">Manage lesson topics and generate AI resources</p>
                        </div>
                    </div>
                    <Layers className="w-10 h-10 text-purple-600" />
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Select Chapter</label>
                            <select
                                value={selectedDocId}
                                onChange={(e) => setSelectedDocId(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                            >
                                <option value="">-- Select a Chapter --</option>
                                {documents.map(doc => (
                                    <option key={doc.document_id} value={doc.document_id}>
                                        {doc.subjects?.code} - {doc.chapter_title} (Grade {doc.grade_level})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Search Topics</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by topic name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chapter Info */}
                {selectedDoc && (
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-lg p-6 mb-6 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold">{selectedDoc.chapter_title}</h2>
                                <p className="text-purple-200">{selectedDoc.subjects?.name} • Grade {selectedDoc.grade_level}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-3xl font-bold">{topics.length}</p>
                                <p className="text-purple-200">Topics</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Topics List */}
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                    </div>
                ) : !selectedDocId ? (
                    <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
                        <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Select a Chapter</h3>
                        <p className="text-gray-500">Choose a syllabus chapter to view its topics</p>
                    </div>
                ) : filteredTopics.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
                        <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No Topics Found</h3>
                        <p className="text-gray-500">This chapter doesn't have any topics yet</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredTopics.map(topic => (
                            <div
                                key={topic.topic_id}
                                className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all border border-gray-100"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <span className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                                            {topic.topic_number}
                                        </span>
                                        <div>
                                            <h3 className="font-bold text-gray-900">{topic.topic_title}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                                    <Clock className="w-3 h-3" />
                                                    {topic.estimated_duration_minutes} min
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(topic.difficulty_level)}`}>
                                                    {topic.difficulty_level}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => router.push(`/dashboard/manage/topics/${topic.topic_id}/resources`)}
                                        className="flex-1 py-2 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:shadow-md transition-all"
                                    >
                                        <FileText className="w-4 h-4" />
                                        Resources
                                    </button>
                                    <button
                                        onClick={() => router.push(`/dashboard/manage/topics/${topic.topic_id}/mcq`)}
                                        className="flex-1 py-2 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:shadow-md transition-all"
                                    >
                                        <Brain className="w-4 h-4" />
                                        MCQs
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, BookOpen, FileText, Brain, ClipboardList,
    Calculator, Loader2, ChevronRight, Search, Star
} from 'lucide-react'

interface Subject {
    subject_id: string
    name: string
    code: string
}

interface Topic {
    topic_id: string
    topic_title: string
    chapter_title: string
    subject_name: string
    has_resources: boolean
}

export default function StudentResourcesPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [student, setStudent] = useState<any>(null)
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [topics, setTopics] = useState<Topic[]>([])
    const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

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
                .select('*, classes(grade_level)')
                .eq('email', session.user.email)
                .single()

            if (!userData) {
                router.push('/login')
                return
            }

            setStudent(userData)
            const gradeLevel = userData.classes?.grade_level

            // Load subjects for student's grade level
            const { data: subjectsData } = await supabase
                .from('subjects')
                .select('*')
                .contains('grade_levels', [gradeLevel])
                .eq('is_active', true)

            if (subjectsData) {
                setSubjects(subjectsData)
            }

            // Load topics with resources
            const { data: topicsData } = await supabase
                .from('lesson_topics')
                .select(`
                    topic_id,
                    topic_title,
                    syllabus_documents (
                        chapter_title,
                        grade_level,
                        subjects (name)
                    ),
                    topic_resources (resource_id)
                `)
                .order('topic_number')

            if (topicsData) {
                const formatted = topicsData
                    .filter((t: any) => t.syllabus_documents?.grade_level === gradeLevel)
                    .map((t: any) => ({
                        topic_id: t.topic_id,
                        topic_title: t.topic_title,
                        chapter_title: t.syllabus_documents?.chapter_title || '',
                        subject_name: t.syllabus_documents?.subjects?.name || 'Unknown',
                        has_resources: t.topic_resources && t.topic_resources.length > 0
                    }))
                setTopics(formatted)
            }

        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredTopics = topics.filter(t => {
        const matchesSearch = searchQuery === '' ||
            t.topic_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.chapter_title.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesSubject = !selectedSubject || t.subject_name === selectedSubject
        return matchesSearch && matchesSubject
    })

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
                            <p className="text-sm text-gray-500">Access your learning resources</p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search topics..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                        />
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6 space-y-6">
                {/* Subject Filter */}
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
                            key={sub.subject_id}
                            onClick={() => setSelectedSubject(sub.name)}
                            className={`px-4 py-2 rounded-full whitespace-nowrap transition-all ${selectedSubject === sub.name
                                    ? 'bg-teal-600 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            {sub.name}
                        </button>
                    ))}
                </div>

                {/* Topics List */}
                <div className="space-y-3">
                    {filteredTopics.length > 0 ? filteredTopics.map(topic => (
                        <button
                            key={topic.topic_id}
                            onClick={() => router.push(`/dashboard/resources/${topic.topic_id}`)}
                            className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex items-center justify-between text-left"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${topic.has_resources ? 'bg-teal-100' : 'bg-gray-100'
                                    }`}>
                                    <BookOpen className={`w-6 h-6 ${topic.has_resources ? 'text-teal-600' : 'text-gray-400'
                                        }`} />
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">{topic.topic_title}</p>
                                    <p className="text-sm text-gray-500">
                                        {topic.subject_name} • {topic.chapter_title}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {topic.has_resources && (
                                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                        Available
                                    </span>
                                )}
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                            </div>
                        </button>
                    )) : (
                        <div className="bg-white rounded-xl p-8 text-center">
                            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">No topics found</p>
                        </div>
                    )}
                </div>

                {/* Resource Types Legend */}
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-3">Available Resource Types</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                            <FileText className="w-4 h-4 text-purple-600" />
                            Lesson Notes
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                            <BookOpen className="w-4 h-4 text-blue-600" />
                            Study Guide
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                            <ClipboardList className="w-4 h-4 text-green-600" />
                            Worksheet
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                            <Brain className="w-4 h-4 text-orange-600" />
                            Revision Notes
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                            <Calculator className="w-4 h-4 text-red-600" />
                            Formulas
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}

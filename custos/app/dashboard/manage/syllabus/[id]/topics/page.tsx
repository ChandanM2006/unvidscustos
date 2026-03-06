'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { useSmartBack } from '@/lib/navigation'
import { ArrowLeft, Plus, Edit, Trash2, BookOpen, Clock, Target, TrendingUp } from 'lucide-react'

interface Topic {
    topic_id: string
    topic_number: number
    topic_title: string
    estimated_duration_minutes: number
    difficulty_level: string
    learning_objectives: string[]
    prerequisites: string[]
    content: any
}

export default function TopicBreakdownPage() {
    const params = useParams()
    const documentId = params?.id as string
    const { goBack, router } = useSmartBack(`/dashboard/manage/syllabus/${documentId}`)

    const [topics, setTopics] = useState<Topic[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingTopic, setEditingTopic] = useState<Topic | null>(null)
    const [documentTitle, setDocumentTitle] = useState('')

    const [formData, setFormData] = useState({
        topic_number: 1,
        topic_title: '',
        estimated_duration_minutes: 45,
        difficulty_level: 'medium',
        learning_objectives: '',
        prerequisites: '',
        content: {}
    })

    useEffect(() => {
        if (documentId) {
            loadTopics()
            loadDocument()
        }
    }, [documentId])

    async function loadDocument() {
        try {
            const { data, error } = await supabase
                .from('syllabus_documents')
                .select('chapter_title')
                .eq('document_id', documentId)
                .single()

            if (error) throw error
            setDocumentTitle(data.chapter_title)
        } catch (error) {
            console.error('Error loading document:', error)
        }
    }

    async function loadTopics() {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('lesson_topics')
                .select('*')
                .eq('document_id', documentId)
                .order('topic_number')

            if (error) throw error
            setTopics(data || [])
        } catch (error: any) {
            console.error('Error loading topics:', error)
            alert('Failed to load topics: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    function openModal(topic?: Topic) {
        if (topic) {
            setEditingTopic(topic)
            setFormData({
                topic_number: topic.topic_number,
                topic_title: topic.topic_title,
                estimated_duration_minutes: topic.estimated_duration_minutes,
                difficulty_level: topic.difficulty_level,
                learning_objectives: (topic.learning_objectives || []).join('\n'),
                prerequisites: (topic.prerequisites || []).join('\n'),
                content: topic.content || {}
            })
        } else {
            setEditingTopic(null)
            const nextNumber = topics.length > 0 ? Math.max(...topics.map(t => t.topic_number)) + 1 : 1
            setFormData({
                topic_number: nextNumber,
                topic_title: '',
                estimated_duration_minutes: 45,
                difficulty_level: 'medium',
                learning_objectives: '',
                prerequisites: '',
                content: {}
            })
        }
        setShowModal(true)
    }

    function closeModal() {
        setShowModal(false)
        setEditingTopic(null)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)

        try {
            const topicData = {
                document_id: documentId,
                topic_number: formData.topic_number,
                topic_title: formData.topic_title,
                estimated_duration_minutes: formData.estimated_duration_minutes,
                difficulty_level: formData.difficulty_level,
                learning_objectives: formData.learning_objectives.split('\n').filter(o => o.trim()),
                prerequisites: formData.prerequisites.split('\n').filter(p => p.trim()),
                content: formData.content
            }

            if (editingTopic) {
                const { error } = await supabase
                    .from('lesson_topics')
                    .update(topicData)
                    .eq('topic_id', editingTopic.topic_id)

                if (error) throw error
                alert('Topic updated successfully!')
            } else {
                const { error } = await supabase
                    .from('lesson_topics')
                    .insert([topicData])

                if (error) throw error
                alert('Topic created successfully!')
            }

            closeModal()
            loadTopics()
        } catch (error: any) {
            console.error('Error saving topic:', error)
            alert('Failed to save topic: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this topic?')) return

        try {
            const { error } = await supabase
                .from('lesson_topics')
                .delete()
                .eq('topic_id', id)

            if (error) throw error
            alert('Topic deleted successfully!')
            loadTopics()
        } catch (error: any) {
            console.error('Error deleting topic:', error)
            alert('Failed to delete: ' + error.message)
        }
    }

    const totalDuration = topics.reduce((sum, t) => sum + t.estimated_duration_minutes, 0)
    const difficultyCount = {
        easy: topics.filter(t => t.difficulty_level === 'easy').length,
        medium: topics.filter(t => t.difficulty_level === 'medium').length,
        hard: topics.filter(t => t.difficulty_level === 'hard').length
    }

    const getDifficultyColor = (level: string) => {
        switch (level) {
            case 'easy': return 'bg-green-100 text-green-700 border-green-300'
            case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-300'
            case 'hard': return 'bg-red-100 text-red-700 border-red-300'
            default: return 'bg-gray-100 text-gray-700 border-gray-300'
        }
    }

    if (loading && topics.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={goBack}
                            className="p-2 hover:bg-white rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                                <BookOpen className="w-10 h-10 text-purple-600" />
                                Topic Breakdown
                            </h1>
                            <p className="text-gray-600 mt-2">
                                {documentTitle}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => openModal()}
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
                    >
                        <Plus className="w-5 h-5" />
                        Add Topic
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="text-3xl font-bold text-purple-600">{topics.length}</div>
                        <div className="text-gray-600 mt-1">Total Topics</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="text-3xl font-bold text-blue-600">{Math.round(totalDuration / 60)}h {totalDuration % 60}m</div>
                        <div className="text-gray-600 mt-1">Total Duration</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex gap-2 mb-2">
                            <span className="text-green-600 font-bold">{difficultyCount.easy}E</span>
                            <span className="text-yellow-600 font-bold">{difficultyCount.medium}M</span>
                            <span className="text-red-600 font-bold">{difficultyCount.hard}H</span>
                        </div>
                        <div className="text-gray-600 mt-1">Difficulty Mix</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="text-3xl font-bold text-orange-600">
                            {topics.length > 0 ? Math.round(totalDuration / topics.length) : 0}m
                        </div>
                        <div className="text-gray-600 mt-1">Avg per Topic</div>
                    </div>
                </div>

                {/* Topics List */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    {topics.length === 0 ? (
                        <div className="p-12 text-center">
                            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Topics Yet</h3>
                            <p className="text-gray-500 mb-6">Break this chapter into teachable topics</p>
                            <button
                                onClick={() => openModal()}
                                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all inline-flex items-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Add First Topic
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {topics.map((topic) => (
                                <div
                                    key={topic.topic_id}
                                    className="p-6 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                                    <span className="text-purple-600 font-bold">{topic.topic_number}</span>
                                                </div>
                                                <h3 className="text-xl font-bold text-gray-900">{topic.topic_title}</h3>
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${getDifficultyColor(topic.difficulty_level)}`}>
                                                    {topic.difficulty_level.toUpperCase()}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mb-3">
                                                <div className="flex items-center gap-2 text-gray-600">
                                                    <Clock className="w-4 h-4" />
                                                    <span className="text-sm">{topic.estimated_duration_minutes} minutes</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-gray-600">
                                                    <Target className="w-4 h-4" />
                                                    <span className="text-sm">{topic.learning_objectives?.length || 0} objectives</span>
                                                </div>
                                            </div>

                                            {topic.learning_objectives && topic.learning_objectives.length > 0 && (
                                                <div className="mt-3">
                                                    <p className="text-sm font-semibold text-gray-700 mb-1">Learning Objectives:</p>
                                                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                                                        {topic.learning_objectives.slice(0, 3).map((obj, idx) => (
                                                            <li key={idx}>{obj}</li>
                                                        ))}
                                                        {topic.learning_objectives.length > 3 && (
                                                            <li className="text-purple-600">+{topic.learning_objectives.length - 3} more</li>
                                                        )}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => openModal(topic)}
                                                className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Edit className="w-5 h-5 text-blue-600" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(topic.topic_id)}
                                                className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-5 h-5 text-red-600" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Next Steps */}
                {topics.length > 0 && (
                    <div className="mt-8 p-6 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl shadow-xl text-white">
                        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                            <TrendingUp className="w-6 h-6" />
                            Ready for AI Lesson Planning!
                        </h3>
                        <p className="opacity-90 mb-4">
                            You have {topics.length} topics defined. Generate AI-powered lesson plans with optimal time allocation!
                        </p>
                        <button className="px-6 py-3 bg-white text-purple-600 rounded-xl hover:bg-gray-100 transition-colors font-semibold">
                            Generate Lesson Plans (Coming Soon)
                        </button>
                    </div>
                )}

                {/* Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 my-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">
                                {editingTopic ? 'Edit Topic' : 'Add Topic'}
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Topic Number *
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.topic_number}
                                            onChange={(e) => setFormData({ ...formData, topic_number: parseInt(e.target.value) })}
                                            required
                                            min="1"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Duration (minutes) *
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.estimated_duration_minutes}
                                            onChange={(e) => setFormData({ ...formData, estimated_duration_minutes: parseInt(e.target.value) })}
                                            required
                                            min="1"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Topic Title *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.topic_title}
                                        onChange={(e) => setFormData({ ...formData, topic_title: e.target.value })}
                                        required
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                                        placeholder="e.g., Introduction to Quadratic Equations"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Difficulty Level *
                                    </label>
                                    <select
                                        value={formData.difficulty_level}
                                        onChange={(e) => setFormData({ ...formData, difficulty_level: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                                    >
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Learning Objectives (one per line)
                                    </label>
                                    <textarea
                                        value={formData.learning_objectives}
                                        onChange={(e) => setFormData({ ...formData, learning_objectives: e.target.value })}
                                        rows={4}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                                        placeholder="Students will be able to&#10;Understand the standard form&#10;Solve simple equations"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Prerequisites (one per line)
                                    </label>
                                    <textarea
                                        value={formData.prerequisites}
                                        onChange={(e) => setFormData({ ...formData, prerequisites: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                                        placeholder="Basic algebra&#10;Linear equations"
                                    />
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all font-semibold disabled:opacity-50"
                                    >
                                        {loading ? 'Saving...' : editingTopic ? 'Update' : 'Create'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

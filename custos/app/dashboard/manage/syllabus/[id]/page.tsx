'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { useSmartBack } from '@/lib/navigation'
import { ArrowLeft, FileText, BookOpen, Calculator, Lightbulb, ChevronRight, Trash2, Edit, Download } from 'lucide-react'

interface SyllabusDocument {
    document_id: string
    subject_id: string
    grade_level: number
    chapter_number: number
    chapter_title: string
    original_filename: string
    original_file_type: string
    original_size_mb: number
    extracted_size_kb: number
    compression_ratio: number
    content: any
    created_at: string
    subjects?: {
        name: string
        code: string
    }
}

export default function SyllabusDetailPage() {
    const { goBack, router } = useSmartBack('/dashboard/manage/syllabus')
    const params = useParams()
    const documentId = params?.id as string

    const [syllabusDoc, setSyllabusDoc] = useState<SyllabusDocument | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'overview' | 'sections' | 'formulas' | 'examples'>('overview')

    useEffect(() => {
        if (documentId) {
            loadDocument()
        }
    }, [documentId])

    async function loadDocument() {
        try {
            const { data, error } = await supabase
                .from('syllabus_documents')
                .select(`
          *,
          subjects:subject_id (
            name,
            code
          )
        `)
                .eq('document_id', documentId)
                .single()

            if (error) throw error

            // Format the data
            const formattedData = {
                ...data,
                subjects: Array.isArray(data.subjects) ? data.subjects[0] : data.subjects
            }

            setSyllabusDoc(formattedData)
        } catch (error: any) {
            console.error('Error loading document:', error)
            alert('Failed to load syllabus document')
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete() {
        if (!confirm('Are you sure you want to delete this syllabus document?')) return

        try {
            const { error } = await supabase
                .from('syllabus_documents')
                .delete()
                .eq('document_id', documentId)

            if (error) throw error

            alert('Document deleted successfully!')
            router.push('/dashboard/manage/syllabus')
        } catch (error: any) {
            console.error('Error deleting document:', error)
            alert('Failed to delete: ' + error.message)
        }
    }

    function exportAsJSON() {
        if (!syllabusDoc) return

        const dataStr = JSON.stringify(syllabusDoc.content, null, 2)
        const dataBlob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(dataBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${syllabusDoc.chapter_title.replace(/\s+/g, '_')}_extracted.json`
        link.click()
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        )
    }

    if (!syllabusDoc) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Document Not Found</h2>
                    <button
                        onClick={() => router.push('/dashboard/manage/syllabus')}
                        className="text-purple-600 hover:text-purple-700"
                    >
                        ← Back to Syllabus Library
                    </button>
                </div>
            </div>
        )
    }

    const content = syllabusDoc.content || {}
    const sections = content.sections || []
    const formulas = content.formulas || []
    const keyPoints = content.key_points || []
    const examples = content.examples || []
    const definitions = content.definitions || []

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-8">
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
                            <h1 className="text-4xl font-bold text-gray-900">
                                Chapter {syllabusDoc.chapter_number}: {syllabusDoc.chapter_title}
                            </h1>
                            <p className="text-gray-600 mt-2">
                                {syllabusDoc.subjects?.name} ({syllabusDoc.subjects?.code}) • Grade {syllabusDoc.grade_level}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={exportAsJSON}
                            className="px-4 py-2 border-2 border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-2"
                        >
                            <Download className="w-5 h-5" />
                            Export JSON
                        </button>
                        <button
                            onClick={handleDelete}
                            className="px-4 py-2 border-2 border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2"
                        >
                            <Trash2 className="w-5 h-5" />
                            Delete
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="text-3xl font-bold text-purple-600">{sections.length}</div>
                        <div className="text-gray-600 mt-1">Sections</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="text-3xl font-bold text-blue-600">{formulas.length}</div>
                        <div className="text-gray-600 mt-1">Formulas</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="text-3xl font-bold text-green-600">{examples.length}</div>
                        <div className="text-gray-600 mt-1">Examples</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="text-3xl font-bold text-orange-600">{keyPoints.length}</div>
                        <div className="text-gray-600 mt-1">Key Points</div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-t-2xl shadow-xl">
                    <div className="flex border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`flex-1 px-6 py-4 font-semibold transition-colors ${activeTab === 'overview'
                                ? 'text-purple-600 border-b-2 border-purple-600'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <BookOpen className="w-5 h-5" />
                                Overview
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('sections')}
                            className={`flex-1 px-6 py-4 font-semibold transition-colors ${activeTab === 'sections'
                                ? 'text-purple-600 border-b-2 border-purple-600'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <FileText className="w-5 h-5" />
                                Sections ({sections.length})
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('formulas')}
                            className={`flex-1 px-6 py-4 font-semibold transition-colors ${activeTab === 'formulas'
                                ? 'text-purple-600 border-b-2 border-purple-600'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <Calculator className="w-5 h-5" />
                                Formulas ({formulas.length})
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('examples')}
                            className={`flex-1 px-6 py-4 font-semibold transition-colors ${activeTab === 'examples'
                                ? 'text-purple-600 border-b-2 border-purple-600'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <Lightbulb className="w-5 h-5" />
                                Examples ({examples.length})
                            </div>
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="p-8">
                        {activeTab === 'overview' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-4">Chapter Title</h3>
                                    <p className="text-2xl text-gray-800">{content.title || syllabusDoc.chapter_title}</p>
                                </div>

                                {keyPoints.length > 0 && (
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-4">Key Points</h3>
                                        <ul className="space-y-2">
                                            {keyPoints.map((point: string, idx: number) => (
                                                <li key={idx} className="flex items-start gap-3">
                                                    <ChevronRight className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
                                                    <span className="text-gray-700">{point}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {definitions.length > 0 && (
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-4">Definitions</h3>
                                        <div className="space-y-3">
                                            {definitions.map((def: string, idx: number) => (
                                                <div key={idx} className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                                                    <p className="text-gray-800">{def}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl">
                                    <h3 className="font-semibold text-gray-900 mb-2">📊 Storage Optimization</h3>
                                    <p className="text-gray-700">
                                        Original: {syllabusDoc.original_size_mb?.toFixed(2)} MB →
                                        Extracted: {syllabusDoc.extracted_size_kb?.toFixed(2)} KB
                                    </p>
                                    <p className="text-green-600 font-bold mt-1">
                                        Saved {syllabusDoc.compression_ratio?.toFixed(1)}% storage space!
                                    </p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'sections' && (
                            <div className="space-y-4">
                                {sections.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">No sections extracted</p>
                                ) : (
                                    sections.map((section: any, idx: number) => (
                                        <div key={idx} className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                                            <h4 className="text-lg font-bold text-gray-900 mb-3">
                                                {section.heading || `Section ${idx + 1}`}
                                            </h4>
                                            <p className="text-gray-700 whitespace-pre-wrap">{section.text}</p>
                                            {section.page && (
                                                <p className="text-sm text-gray-500 mt-3">Page {section.page}</p>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'formulas' && (
                            <div className="space-y-3">
                                {formulas.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">No formulas extracted</p>
                                ) : (
                                    formulas.map((formula: string, idx: number) => (
                                        <div key={idx} className="p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded font-mono text-lg">
                                            {formula}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'examples' && (
                            <div className="space-y-6">
                                {examples.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">No examples extracted</p>
                                ) : (
                                    examples.map((example: any, idx: number) => (
                                        <div key={idx} className="p-6 bg-gradient-to-r from-green-50 to-teal-50 rounded-xl border-2 border-green-200">
                                            <h4 className="text-lg font-bold text-gray-900 mb-3">
                                                Example {idx + 1}
                                            </h4>
                                            {example.question && (
                                                <div className="mb-3">
                                                    <p className="text-sm font-semibold text-gray-700 mb-1">Question:</p>
                                                    <p className="text-gray-800">{example.question}</p>
                                                </div>
                                            )}
                                            {example.solution && (
                                                <div className="mb-3">
                                                    <p className="text-sm font-semibold text-gray-700 mb-1">Solution:</p>
                                                    <p className="text-gray-800 whitespace-pre-wrap">{example.solution}</p>
                                                </div>
                                            )}
                                            {example.answer && (
                                                <div className="p-3 bg-white rounded border-2 border-green-400">
                                                    <p className="text-sm font-semibold text-gray-700 mb-1">Answer:</p>
                                                    <p className="text-green-700 font-bold">{example.answer}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Next Steps Card */}
                <div className="mt-8 p-6 bg-white rounded-2xl shadow-xl">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Lightbulb className="w-6 h-6 text-yellow-500" />
                        What's Next?
                    </h3>
                    <p className="text-gray-700 mb-4">
                        Now that you've reviewed the extracted content, you can:
                    </p>
                    <ul className="space-y-2 text-gray-700">
                        <li>• <strong>Break into topics</strong> for detailed lesson planning</li>
                        <li>• <strong>Generate AI lesson plans</strong> with optimal time allocation</li>
                        <li>• <strong>Create resources</strong> (notes, worksheets, MCQs) for each topic</li>
                    </ul>
                    <button
                        onClick={() => router.push(`/dashboard/manage/syllabus/${documentId}/topics`)}
                        className="mt-6 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all font-semibold"
                    >
                        Create Topics
                    </button>
                </div>
            </div>
        </div>
    )
}

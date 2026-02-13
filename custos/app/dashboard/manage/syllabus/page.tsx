'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Book, Upload, Trash2, Eye, ArrowLeft, FileText, TrendingDown } from 'lucide-react'

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
    created_at: string
    subject?: {
        name: string
        code: string
    }
}

export default function SyllabusListPage() {
    const router = useRouter()
    const [documents, setDocuments] = useState<SyllabusDocument[]>([])
    const [loading, setLoading] = useState(true)
    const [mounted, setMounted] = useState(false)
    const [userRole, setUserRole] = useState<string | null>(null)

    useEffect(() => {
        setMounted(true)
        checkAuthAndLoad()
    }, [])

    async function checkAuthAndLoad() {
        try {
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

            if (!userData) {
                router.push('/login')
                return
            }

            // Only allow admin, sub_admin, and teacher
            if (!['super_admin', 'sub_admin', 'teacher'].includes(userData.role)) {
                alert('You do not have permission to access this page.')
                router.push('/dashboard/student')
                return
            }

            setUserRole(userData.role)
            loadDocuments()
        } catch (error) {
            console.error('Auth error:', error)
            router.push('/login')
        }
    }

    async function loadDocuments() {
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
                .order('created_at', { ascending: false })

            if (error) throw error

            // Format the data
            const formattedData = data?.map(doc => ({
                ...doc,
                subject: Array.isArray(doc.subjects) ? doc.subjects[0] : doc.subjects
            })) || []

            setDocuments(formattedData)
        } catch (error: any) {
            console.error('Error loading documents:', error)
            alert('Failed to load syllabus documents')
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this syllabus document?')) return

        try {
            const { error } = await supabase
                .from('syllabus_documents')
                .delete()
                .eq('document_id', id)

            if (error) throw error
            alert('Document deleted successfully!')
            loadDocuments()
        } catch (error: any) {
            console.error('Error deleting document:', error)
            alert('Failed to delete: ' + error.message)
        }
    }

    function getFileTypeIcon(type: string) {
        if (type?.includes('pdf')) return '📄'
        if (type?.includes('word')) return '📘'
        if (type?.includes('presentation')) return '📊'
        if (type?.includes('image')) return '🖼️'
        return '📄'
    }

    const totalOriginalSize = documents.reduce((sum, doc) => sum + (doc.original_size_mb || 0), 0)
    const totalExtractedSize = documents.reduce((sum, doc) => sum + (doc.extracted_size_kb || 0), 0)
    const avgCompression = documents.length > 0
        ? documents.reduce((sum, doc) => sum + (doc.compression_ratio || 0), 0) / documents.length
        : 0

    if (!mounted || (loading && documents.length === 0)) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        )
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
                            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                                <Book className="w-10 h-10 text-purple-600" />
                                Syllabus Library
                            </h1>
                            <p className="text-gray-600 mt-2">
                                AI-extracted syllabus documents
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => router.push('/dashboard/manage/syllabus/upload')}
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
                    >
                        <Upload className="w-5 h-5" />
                        Upload New
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <div className="text-3xl font-bold text-purple-600">{documents.length}</div>
                        <div className="text-gray-600 mt-1">Documents</div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <div className="text-3xl font-bold text-blue-600">{totalOriginalSize.toFixed(1)} MB</div>
                        <div className="text-gray-600 mt-1">Original Size</div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <div className="text-3xl font-bold text-green-600">{totalExtractedSize.toFixed(1)} KB</div>
                        <div className="text-gray-600 mt-1">Compressed Size</div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-lg p-6 bg-gradient-to-br from-green-50 to-emerald-50">
                        <div className="text-3xl font-bold text-green-600 flex items-center gap-2">
                            <TrendingDown className="w-8 h-8" />
                            {avgCompression.toFixed(1)}%
                        </div>
                        <div className="text-gray-600 mt-1">Avg Savings</div>
                    </div>
                </div>

                {/* Documents List */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    {documents.length === 0 ? (
                        <div className="p-12 text-center">
                            <Book className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-700 mb-2">No syllabus documents yet</h3>
                            <p className="text-gray-500 mb-6">Upload your first syllabus to get started</p>
                            <button
                                onClick={() => router.push('/dashboard/manage/syllabus/upload')}
                                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all inline-flex items-center gap-2"
                            >
                                <Upload className="w-5 h-5" />
                                Upload Syllabus
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gradient-to-r from-purple-100 to-blue-100">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Chapter</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Subject</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Grade</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">File Info</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Savings</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Uploaded</th>
                                        <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {documents.map((doc) => (
                                        <tr key={doc.document_id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl">{getFileTypeIcon(doc.original_file_type)}</span>
                                                    <div>
                                                        <div className="font-semibold text-gray-900">
                                                            Chapter {doc.chapter_number}
                                                        </div>
                                                        <div className="text-sm text-gray-600">{doc.chapter_title}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">
                                                    {doc.subject?.name || 'N/A'}
                                                </div>
                                                <div className="text-sm text-gray-500 font-mono">
                                                    {doc.subject?.code}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                                    Grade {doc.grade_level}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm">
                                                    <div className="text-gray-600">{doc.original_filename}</div>
                                                    <div className="text-gray-400 mt-1">
                                                        {doc.original_size_mb?.toFixed(2)} MB → {doc.extracted_size_kb?.toFixed(2)} KB
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <TrendingDown className="w-4 h-4 text-green-600" />
                                                    <span className="font-bold text-green-600">
                                                        {doc.compression_ratio?.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {new Date(doc.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => router.push(`/dashboard/manage/syllabus/${doc.document_id}`)}
                                                        className="p-2 hover:bg-blue-100 rounded-lg transition-colors group"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(doc.document_id)}
                                                        className="p-2 hover:bg-red-100 rounded-lg transition-colors group"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-5 h-5 text-red-600 group-hover:scale-110 transition-transform" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Info Card */}
                {documents.length > 0 && (
                    <div className="mt-8 p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-purple-600" />
                            💡 What's Next?
                        </h3>
                        <p className="text-gray-700">
                            Now that you've uploaded syllabus chapters, you can:
                        </p>
                        <ul className="mt-3 space-y-2 text-gray-700">
                            <li>• <strong>Break chapters into topics</strong> for detailed lesson planning</li>
                            <li>• <strong>Generate AI lesson plans</strong> with optimal time allocation</li>
                            <li>• <strong>Auto-create resources</strong> (notes, worksheets, MCQs) for each topic</li>
                        </ul>
                        <p className="mt-4 text-sm text-purple-600 font-medium">
                            Coming soon: Click on any chapter to manage topics! 🎯
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

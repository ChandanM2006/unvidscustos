'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Image, Check, X, Loader2, ArrowLeft, Book } from 'lucide-react'

interface Subject {
    subject_id: string
    name: string
    code: string
}

interface Class {
    class_id: string
    name: string
    grade_level: number
}

export default function SyllabusUploadPage() {
    const router = useRouter()
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [classes, setClasses] = useState<Class[]>([])
    const [loading, setLoading] = useState(false)
    const [dragActive, setDragActive] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [extracting, setExtracting] = useState(false)
    const [extractedContent, setExtractedContent] = useState<any>(null)

    const [formData, setFormData] = useState({
        subject_id: '',
        class_id: '',
        chapter_number: '',
        chapter_title: ''
    })

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            // Load subjects
            const { data: subjectsData, error: subjectsError } = await supabase
                .from('subjects')
                .select('*')
                .eq('is_active', true)
                .order('name')

            if (subjectsError) throw subjectsError
            setSubjects(subjectsData || [])

            // Load classes
            const { data: classesData, error: classesError } = await supabase
                .from('classes')
                .select('*')
                .order('grade_level')

            if (classesError) throw classesError
            setClasses(classesData || [])
        } catch (error: any) {
            console.error('Error loading data:', error)
        }
    }

    function handleDrag(e: React.DragEvent) {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0])
        }
    }

    function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0])
        }
    }

    function handleFile(file: File) {
        // Check file type
        const validTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'image/png',
            'image/jpeg',
            'image/jpg'
        ]

        if (!validTypes.includes(file.type)) {
            alert('Invalid file type! Please upload PDF, DOCX, PPTX, or Images only.')
            return
        }

        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert('File too large! Maximum size is 10MB.')
            return
        }

        setSelectedFile(file)
    }

    async function extractContent() {
        if (!selectedFile) return

        setExtracting(true)
        try {
            const formDataToSend = new FormData()
            formDataToSend.append('file', selectedFile)

            const response = await fetch('http://localhost:8000/api/syllabus/extract', {
                method: 'POST',
                body: formDataToSend
            })

            if (!response.ok) {
                throw new Error('Failed to extract content')
            }

            const data = await response.json()
            setExtractedContent(data)
            alert('Content extracted successfully! Preview below.')
        } catch (error: any) {
            console.error('Error extracting content:', error)
            alert('Failed to extract content: ' + error.message)
        } finally {
            setExtracting(false)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        if (!extractedContent) {
            alert('Please extract content first!')
            return
        }

        setLoading(true)
        try {
            // Get grade level from selected class
            const selectedClass = classes.find(c => c.class_id === formData.class_id)
            if (!selectedClass) {
                alert('Please select a valid class')
                setLoading(false)
                return
            }

            const originalSizeMB = selectedFile ? selectedFile.size / (1024 * 1024) : 0
            const extractedSizeKB = JSON.stringify(extractedContent).length / 1024
            const compressionRatio = ((1 - extractedSizeKB / 1024 / originalSizeMB) * 100).toFixed(2)

            const { error } = await supabase
                .from('syllabus_documents')
                .insert([{
                    subject_id: formData.subject_id,
                    grade_level: selectedClass.grade_level,
                    chapter_number: parseInt(formData.chapter_number),
                    chapter_title: formData.chapter_title,
                    original_filename: selectedFile?.name,
                    original_file_type: selectedFile?.type,
                    original_size_mb: parseFloat(originalSizeMB.toFixed(2)),
                    content: extractedContent,
                    extracted_size_kb: parseFloat(extractedSizeKB.toFixed(2)),
                    compression_ratio: parseFloat(compressionRatio),
                    ai_processed: true
                }])

            if (error) throw error

            alert(`Syllabus uploaded successfully! Saved ${compressionRatio}% storage space! 🎉`)
            router.push('/dashboard/manage/syllabus')
        } catch (error: any) {
            console.error('Error saving syllabus:', error)
            alert('Failed to save: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    function getFileIcon(type: string) {
        if (type.includes('pdf')) return <FileText className="w-8 h-8 text-red-500" />
        if (type.includes('word')) return <FileText className="w-8 h-8 text-blue-500" />
        if (type.includes('presentation')) return <FileText className="w-8 h-8 text-orange-500" />
        if (type.includes('image')) return <Image className="w-8 h-8 text-green-500" />
        return <FileText className="w-8 h-8 text-gray-500" />
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => router.push('/dashboard/manage')}
                        className="p-2 hover:bg-white rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                            <Upload className="w-10 h-10 text-purple-600" />
                            Upload Syllabus
                        </h1>
                        <p className="text-gray-600 mt-2">
                            AI-powered content extraction from any document
                        </p>
                    </div>
                </div>

                {/* Main Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <Book className="w-6 h-6 text-purple-600" />
                            Document Information
                        </h2>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Subject *
                                </label>
                                <select
                                    value={formData.subject_id}
                                    onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                                >
                                    <option value="">Select Subject</option>
                                    {subjects.map(subject => (
                                        <option key={subject.subject_id} value={subject.subject_id}>
                                            {subject.name} ({subject.code})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Class *
                                </label>
                                <select
                                    value={formData.class_id}
                                    onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                                >
                                    <option value="">Select Class</option>
                                    {classes.map(cls => (
                                        <option key={cls.class_id} value={cls.class_id}>
                                            {cls.name} (Grade {cls.grade_level})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Chapter Number *
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.chapter_number}
                                    onChange={(e) => setFormData({ ...formData, chapter_number: e.target.value })}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                                    placeholder="e.g., 5"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Chapter Title *
                                </label>
                                <input
                                    type="text"
                                    value={formData.chapter_title}
                                    onChange={(e) => setFormData({ ...formData, chapter_title: e.target.value })}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                                    placeholder="e.g., Quadratic Equations"
                                />
                            </div>
                        </div>
                    </div>

                    {/* File Upload */}
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">Upload Document</h2>

                        {!selectedFile ? (
                            <div
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                className={`border-4 border-dashed rounded-2xl p-12 text-center transition-all ${dragActive
                                    ? 'border-purple-500 bg-purple-50'
                                    : 'border-gray-300 hover:border-purple-400'
                                    }`}
                            >
                                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                                    Drop your file here
                                </h3>
                                <p className="text-gray-500 mb-6">
                                    or click to browse
                                </p>
                                <input
                                    type="file"
                                    id="file-upload"
                                    onChange={handleFileInput}
                                    accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg"
                                    className="hidden"
                                />
                                <label
                                    htmlFor="file-upload"
                                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all cursor-pointer inline-block"
                                >
                                    Choose File
                                </label>
                                <p className="text-sm text-gray-400 mt-4">
                                    Supports: PDF, DOCX, PPTX, Images (Max 10MB)
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border-2 border-purple-200">
                                    <div className="flex items-center gap-4">
                                        {getFileIcon(selectedFile.type)}
                                        <div>
                                            <h4 className="font-semibold text-gray-900">{selectedFile.name}</h4>
                                            <p className="text-sm text-gray-500">
                                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedFile(null)
                                            setExtractedContent(null)
                                        }}
                                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                    >
                                        <X className="w-5 h-5 text-red-600" />
                                    </button>
                                </div>

                                {!extractedContent && (
                                    <button
                                        type="button"
                                        onClick={extractContent}
                                        disabled={extracting}
                                        className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {extracting ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Extracting with AI...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-5 h-5" />
                                                Extract Content with AI
                                            </>
                                        )}
                                    </button>
                                )}

                                {extractedContent && (
                                    <div className="p-6 bg-green-50 border-2 border-green-200 rounded-xl">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Check className="w-6 h-6 text-green-600" />
                                            <h4 className="font-semibold text-green-900">Content Extracted Successfully!</h4>
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            <p className="text-gray-700">
                                                <span className="font-medium">Title:</span> {extractedContent.title || 'N/A'}
                                            </p>
                                            <p className="text-gray-700">
                                                <span className="font-medium">Sections:</span> {extractedContent.sections?.length || 0}
                                            </p>
                                            <p className="text-gray-700">
                                                <span className="font-medium">Formulas:</span> {extractedContent.formulas?.length || 0}
                                            </p>
                                            <p className="text-gray-700">
                                                <span className="font-medium">Key Points:</span> {extractedContent.key_points?.length || 0}
                                            </p>
                                            <p className="text-green-600 font-semibold mt-4">
                                                📊 Storage Optimization: ~99% saved!
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Submit */}
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={() => router.push('/dashboard/manage')}
                            className="flex-1 px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !extractedContent}
                            className="flex-1 px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Saving...' : 'Save Syllabus'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

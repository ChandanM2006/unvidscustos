'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useSmartBack } from '@/lib/navigation'
import { Upload, FileText, Image, Check, Loader2, ArrowLeft, Book, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'

interface Subject {
    subject_id: string
    name: string
    code: string
}

interface ClassItem {
    class_id: string
    name: string
    grade_level: number
}

interface ExtractedChapter {
    chapter_number: number
    chapter_title: string
    topics: string[]
    key_points: string[]
    formulas: string[]
    estimated_periods: number
    difficulty_level: string
    summary: string
}

interface ExtractionResult {
    textbook_title: string
    total_chapters: number
    chapters: ExtractedChapter[]
}

export default function SyllabusUploadPage() {
    const { goBack, router } = useSmartBack('/dashboard/manage/syllabus')
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [classes, setClasses] = useState<ClassItem[]>([])
    const [loading, setLoading] = useState(false)
    const [dragActive, setDragActive] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [extracting, setExtracting] = useState(false)
    const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null)
    const [saving, setSaving] = useState(false)
    const [expandedChapter, setExpandedChapter] = useState<number | null>(null)
    const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        subject_id: '',
        class_id: '',
    })

    useEffect(() => {
        loadUserAndData()
    }, [])

    async function loadUserAndData() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const { data: userData } = await supabase
                .from('users')
                .select('school_id, role')
                .eq('email', session.user.email)
                .single()

            if (!userData || !['super_admin', 'sub_admin'].includes(userData.role)) {
                alert('Only administrators can upload textbooks.')
                router.replace('/dashboard/redirect')
                return
            }

            if (userData?.school_id) {
                setCurrentSchoolId(userData.school_id)
                loadData(userData.school_id)
            }
        } catch (error) {
            console.error('Error loading user:', error)
        }
    }

    async function loadData(schoolId: string) {
        try {
            const { data: subjectsData } = await supabase
                .from('subjects')
                .select('*')
                .eq('school_id', schoolId)
                .eq('is_active', true)
                .order('name')
            setSubjects(subjectsData || [])

            const { data: classesData } = await supabase
                .from('classes')
                .select('*')
                .eq('school_id', schoolId)
                .order('grade_level')
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
        const validTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'image/png', 'image/jpeg', 'image/jpg'
        ]
        if (!validTypes.includes(file.type)) {
            alert('Invalid file type! Please upload PDF, DOCX, PPTX, or Images only.')
            return
        }
        if (file.size > 25 * 1024 * 1024) {
            alert('File too large! Maximum size is 25MB.')
            return
        }
        setSelectedFile(file)
        setExtractionResult(null)
    }

    async function extractAndAnalyze() {
        if (!selectedFile || !formData.subject_id || !formData.class_id) {
            alert('Please select subject, class, and upload a file first.')
            return
        }

        setExtracting(true)
        try {
            // Step 1: Extract raw text from file via AI service
            const extractFormData = new FormData()
            extractFormData.append('file', selectedFile)

            const extractResponse = await fetch('/api/syllabus/extract-textbook', {
                method: 'POST',
                body: extractFormData
            })

            if (!extractResponse.ok) {
                const err = await extractResponse.json().catch(() => ({}))
                throw new Error(err.error || 'Failed to extract content from file')
            }

            const result: ExtractionResult = await extractResponse.json()
            setExtractionResult(result)

        } catch (error: any) {
            console.error('Error extracting:', error)
            alert('Failed to extract textbook content: ' + error.message)
        } finally {
            setExtracting(false)
        }
    }

    async function handleSave() {
        if (!extractionResult || !formData.subject_id || !formData.class_id) return

        setSaving(true)
        try {
            const selectedClass = classes.find(c => c.class_id === formData.class_id)
            if (!selectedClass) throw new Error('Class not found')

            const originalSizeMB = selectedFile ? selectedFile.size / (1024 * 1024) : 0

            // Save each chapter as a syllabus_document + its topics as lesson_topics
            for (const chapter of extractionResult.chapters) {
                const chapterContent = {
                    title: chapter.chapter_title,
                    sections: chapter.topics.map((t, i) => ({
                        heading: t,
                        text: '',
                        page: i + 1
                    })),
                    formulas: chapter.formulas,
                    key_points: chapter.key_points,
                    examples: [],
                    definitions: [],
                    summary: chapter.summary,
                    difficulty_level: chapter.difficulty_level,
                    estimated_periods: chapter.estimated_periods
                }

                const extractedSizeKB = JSON.stringify(chapterContent).length / 1024
                const compressionRatio = originalSizeMB > 0
                    ? ((1 - extractedSizeKB / 1024 / originalSizeMB) * 100).toFixed(2)
                    : '0'

                // Insert syllabus_document for this chapter
                const { data: docData, error: docError } = await supabase
                    .from('syllabus_documents')
                    .insert([{
                        subject_id: formData.subject_id,
                        grade_level: selectedClass.grade_level,
                        chapter_number: chapter.chapter_number,
                        chapter_title: chapter.chapter_title,
                        original_filename: selectedFile?.name,
                        original_file_type: selectedFile?.type,
                        original_size_mb: parseFloat(originalSizeMB.toFixed(2)),
                        content: chapterContent,
                        extracted_size_kb: parseFloat(extractedSizeKB.toFixed(2)),
                        compression_ratio: parseFloat(compressionRatio as string),
                        ai_processed: true
                    }])
                    .select()
                    .single()

                if (docError) throw docError

                // Insert lesson_topics for each topic in this chapter
                if (docData && chapter.topics.length > 0) {
                    const topicsToInsert = chapter.topics.map((topic, idx) => ({
                        document_id: docData.document_id,
                        topic_number: idx + 1,
                        topic_title: topic,
                        content: {
                            chapter: chapter.chapter_title,
                            key_points: chapter.key_points,
                            formulas: chapter.formulas
                        },
                        estimated_duration_minutes: Math.round((chapter.estimated_periods * 45) / chapter.topics.length),
                        difficulty_level: chapter.difficulty_level,
                        learning_objectives: chapter.key_points.slice(0, 3)
                    }))

                    const { error: topicError } = await supabase
                        .from('lesson_topics')
                        .insert(topicsToInsert)

                    if (topicError) {
                        console.error('Error inserting topics for chapter', chapter.chapter_number, topicError)
                    }
                }
            }

            alert(`✅ Textbook uploaded successfully!\n\n📚 ${extractionResult.total_chapters} chapters extracted\n📝 Topics created for each chapter\n\nTeachers can now generate lesson plans from this textbook!`)
            router.push('/dashboard/manage/syllabus')
        } catch (error: any) {
            console.error('Error saving:', error)
            alert('Failed to save: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    function getFileIcon(type: string) {
        if (type?.includes('pdf')) return <FileText className="w-6 h-6 text-red-500" />
        if (type?.includes('image')) return <Image className="w-6 h-6 text-green-500" />
        return <FileText className="w-6 h-6 text-blue-500" />
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                    <button onClick={() => router.push('/dashboard/manage/syllabus')} className="text-gray-600 hover:text-gray-900">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                            <Upload className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Upload Textbook</h1>
                            <p className="text-sm text-gray-500">AI will auto-extract chapters, topics & content</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
                {/* Step 1: Select Subject & Class */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">1</div>
                        <h2 className="text-lg font-semibold text-gray-900">Select Subject & Class</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                            <select
                                value={formData.subject_id}
                                onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                                required
                            >
                                <option value="">Select Subject</option>
                                {subjects.map(s => (
                                    <option key={s.subject_id} value={s.subject_id}>{s.name} ({s.code})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label>
                            <select
                                value={formData.class_id}
                                onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                                required
                            >
                                <option value="">Select Class</option>
                                {classes.map(c => (
                                    <option key={c.class_id} value={c.class_id}>{c.name} (Grade {c.grade_level})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Step 2: Upload File */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-sm">2</div>
                        <h2 className="text-lg font-semibold text-gray-900">Upload Textbook</h2>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">
                        Upload the entire textbook PDF — AI will automatically identify and extract all chapters, topics, formulas, and key points.
                    </p>

                    <div
                        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${dragActive ? 'border-purple-500 bg-purple-50' :
                            selectedFile ? 'border-green-400 bg-green-50' :
                                'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                            }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById('file-input')?.click()}
                    >
                        <input
                            id="file-input"
                            type="file"
                            accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg"
                            onChange={handleFileInput}
                            className="hidden"
                        />
                        {selectedFile ? (
                            <div className="flex items-center justify-center gap-3">
                                {getFileIcon(selectedFile.type)}
                                <div className="text-left">
                                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                                    <p className="text-sm text-gray-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                                </div>
                                <Check className="w-5 h-5 text-green-500" />
                            </div>
                        ) : (
                            <>
                                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                                <p className="font-medium text-gray-700">Drop your textbook file here</p>
                                <p className="text-sm text-gray-400 mt-1">PDF, DOCX, PPTX, or Images (max 25MB)</p>
                            </>
                        )}
                    </div>

                    {selectedFile && !extractionResult && (
                        <button
                            onClick={extractAndAnalyze}
                            disabled={extracting || !formData.subject_id || !formData.class_id}
                            className="mt-4 w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {extracting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    AI is analyzing your textbook... This may take a moment
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    Extract Chapters with AI
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Step 3: Review AI Extraction */}
                {extractionResult && (
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-sm">3</div>
                            <h2 className="text-lg font-semibold text-gray-900">Review Extracted Content</h2>
                        </div>

                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 mb-4 border border-green-200">
                            <div className="flex items-center gap-2 mb-1">
                                <Book className="w-5 h-5 text-green-600" />
                                <span className="font-semibold text-green-800">{extractionResult.textbook_title}</span>
                            </div>
                            <p className="text-sm text-green-700">
                                📚 {extractionResult.total_chapters} chapters found • AI extracted topics, key points & formulas
                            </p>
                        </div>

                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {extractionResult.chapters.map((chapter, idx) => (
                                <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
                                    <button
                                        onClick={() => setExpandedChapter(expandedChapter === idx ? null : idx)}
                                        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-bold text-sm">
                                                {chapter.chapter_number}
                                            </span>
                                            <div>
                                                <p className="font-medium text-gray-900">{chapter.chapter_title}</p>
                                                <p className="text-xs text-gray-500">
                                                    {chapter.topics.length} topics • {chapter.estimated_periods} periods • {chapter.difficulty_level}
                                                </p>
                                            </div>
                                        </div>
                                        {expandedChapter === idx ? (
                                            <ChevronUp className="w-5 h-5 text-gray-400" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-gray-400" />
                                        )}
                                    </button>
                                    {expandedChapter === idx && (
                                        <div className="px-4 py-3 bg-white space-y-3">
                                            <p className="text-sm text-gray-600">{chapter.summary}</p>

                                            {chapter.topics.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-500 mb-1">TOPICS:</p>
                                                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                                                        {chapter.topics.map((t, i) => <li key={i}>{t}</li>)}
                                                    </ul>
                                                </div>
                                            )}

                                            {chapter.key_points.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-500 mb-1">KEY POINTS:</p>
                                                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                                                        {chapter.key_points.map((k, i) => <li key={i}>{k}</li>)}
                                                    </ul>
                                                </div>
                                            )}

                                            {chapter.formulas.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-500 mb-1">FORMULAS:</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {chapter.formulas.map((f, i) => (
                                                            <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-mono">{f}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => { setExtractionResult(null); setSelectedFile(null) }}
                                className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                            >
                                Re-upload
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Saving {extractionResult.total_chapters} chapters...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-5 h-5" />
                                        Save All {extractionResult.total_chapters} Chapters
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">💡 How it works</h3>
                    <ol className="space-y-1 text-sm text-blue-800 list-decimal list-inside">
                        <li>Select the subject and class for this textbook</li>
                        <li>Upload the entire textbook (PDF recommended)</li>
                        <li>AI automatically identifies all chapters and extracts topics, key points, and formulas</li>
                        <li>Review the extracted content and save</li>
                        <li>Teachers can then select any chapter to generate detailed lesson plans!</li>
                    </ol>
                </div>
            </main>
        </div>
    )
}

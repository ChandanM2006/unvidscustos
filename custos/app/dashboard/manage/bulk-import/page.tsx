'use client'

import { useState, useEffect } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { ArrowLeft, Upload, UserPlus, Trash2, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ExtractedStudent {
    name: string
    roll_number?: string
    included: boolean
}

export default function BulkImportPage() {
    const { goBack, router } = useSmartBack('/dashboard/manage/users')
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [extractedStudents, setExtractedStudents] = useState<ExtractedStudent[]>([])
    const [selectedClass, setSelectedClass] = useState('')
    const [selectedSection, setSelectedSection] = useState('')
    const [selectedRole, setSelectedRole] = useState('student')
    const [classes, setClasses] = useState<any[]>([])
    const [sections, setSections] = useState<any[]>([])

    const loadClassesAndSections = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const { data: userData } = await supabase
            .from('users')
            .select('school_id')
            .eq('email', session.user.email)
            .single()

        if (userData?.school_id) {
            const { data: classesData } = await supabase
                .from('classes')
                .select('*')
                .eq('school_id', userData.school_id)

            if (classesData) setClasses(classesData)

            // Filter sections to only this school's classes
            const classIds = (classesData || []).map((c: any) => c.class_id)
            if (classIds.length > 0) {
                const { data: sectionsData } = await supabase
                    .from('sections')
                    .select('*')
                    .in('class_id', classIds)

                if (sectionsData) setSections(sectionsData)
            }
        }
    }

    useEffect(() => {
        loadClassesAndSections()
    }, [])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            // Create preview
            const reader = new FileReader()
            reader.onload = (event) => {
                setPreview(event.target?.result as string)
            }
            reader.readAsDataURL(selectedFile)
        }
    }

    const handleExtract = async () => {
        if (!file) {
            alert('Please select an image first')
            return
        }

        setLoading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const response = await fetch('http://localhost:8000/api/vision/extract-roster', {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                throw new Error('Failed to extract names from image')
            }

            const data = await response.json()

            if (data.success && data.students) {
                const studentsWithSelection = data.students.map((student: any) => ({
                    ...student,
                    included: true
                }))
                setExtractedStudents(studentsWithSelection)
            } else {
                alert('No students found in the image')
            }
        } catch (error: any) {
            console.error('Error extracting names:', error)
            alert('Failed to extract names: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const toggleStudent = (index: number) => {
        setExtractedStudents(prev => {
            const updated = [...prev]
            updated[index].included = !updated[index].included
            return updated
        })
    }

    const updateStudentName = (index: number, newName: string) => {
        setExtractedStudents(prev => {
            const updated = [...prev]
            updated[index].name = newName
            return updated
        })
    }

    const handleBulkCreate = async () => {
        const includedStudents = extractedStudents.filter(s => s.included)

        if (includedStudents.length === 0) {
            alert('No students selected')
            return
        }

        if (!selectedClass) {
            alert('Please select a class')
            return
        }

        setLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const { data: userData } = await supabase
                .from('users')
                .select('school_id')
                .eq('email', session.user.email)
                .single()

            if (!userData?.school_id) {
                alert('School not found')
                return
            }

            // Generate email addresses and create users
            const usersToCreate = includedStudents.map((student, index) => {
                const emailSafeName = student.name.toLowerCase().replace(/\s+/g, '.')
                const email = `${emailSafeName}@${selectedRole}.school`

                return {
                    school_id: userData.school_id,
                    role: selectedRole,
                    email: email,
                    full_name: student.name,
                    class_id: (selectedRole === 'student' || selectedRole === 'teacher') ? selectedClass : null,
                    section_id: (selectedRole === 'student') ? (selectedSection || null) : null
                }
            })

            const { error } = await supabase
                .from('users')
                .insert(usersToCreate)

            if (error) throw error

            alert(`Successfully created ${includedStudents.length} student(s)!`)
            router.push('/dashboard/manage/users')
        } catch (error: any) {
            console.error('Error creating users:', error)
            alert('Failed to create users: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <button
                            onClick={() => router.push('/dashboard/manage/users')}
                            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>Back to Users</span>
                        </button>
                        <h1 className="text-xl font-semibold text-gray-800">Bulk Import Users</h1>
                        <div className="w-32"></div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left: Image Upload */}
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Student Roster</h2>

                        <div className="space-y-6">
                            {/* File Upload */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Select Image
                                </label>
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        id="file-upload"
                                    />
                                    <label htmlFor="file-upload" className="cursor-pointer">
                                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                        <p className="text-sm text-gray-600">
                                            {file ? file.name : 'Click to upload or drag and drop'}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-2">PNG, JPG up to 10MB</p>
                                    </label>
                                </div>
                            </div>

                            {/* Preview */}
                            {preview && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Preview
                                    </label>
                                    <img
                                        src={preview}
                                        alt="Preview"
                                        className="w-full rounded-lg border border-gray-200"
                                    />
                                </div>
                            )}

                            {/* Extract Button */}
                            <button
                                onClick={handleExtract}
                                disabled={!file || loading}
                                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Extracting Names...' : 'Extract Student Names'}
                            </button>
                        </div>
                    </div>

                    {/* Right: Extracted Students */}
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">
                            Extracted Students ({extractedStudents.filter(s => s.included).length})
                        </h2>

                        {extractedStudents.length === 0 ? (
                            <div className="text-center py-12">
                                <UserPlus className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">No students extracted yet</p>
                                <p className="text-sm text-gray-400 mt-2">Upload an image and click "Extract"</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Role Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        User Role *
                                    </label>
                                    <select
                                        value={selectedRole}
                                        onChange={(e) => setSelectedRole(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                                    >
                                        <option value="student">Student</option>
                                        <option value="teacher">Teacher</option>
                                        <option value="parent">Parent</option>
                                        <option value="sub_admin">Sub Admin</option>
                                    </select>
                                </div>

                                {/* Class & Section Selection */}
                                {(selectedRole === 'student' || selectedRole === 'teacher') && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Class *
                                            </label>
                                            <select
                                                value={selectedClass}
                                                onChange={(e) => setSelectedClass(e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            >
                                                <option value="">Select class</option>
                                                {classes.map((cls) => (
                                                    <option key={cls.class_id} value={cls.class_id}>
                                                        {cls.name} (Grade {cls.grade_level})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Section (Optional)
                                            </label>
                                            <select
                                                value={selectedSection}
                                                onChange={(e) => setSelectedSection(e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            >
                                                <option value="">No section</option>
                                                {sections.filter(s => s.class_id === selectedClass).map((section) => (
                                                    <option key={section.section_id} value={section.section_id}>
                                                        {section.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {/* Student List */}
                                <div className="max-h-96 overflow-y-auto space-y-2">
                                    {extractedStudents.map((student, index) => (
                                        <div
                                            key={index}
                                            className={`flex items-center space-x-3 p-3 rounded-lg border ${student.included
                                                ? 'border-blue-200 bg-blue-50'
                                                : 'border-gray-200 bg-gray-50'
                                                }`}
                                        >
                                            <button
                                                onClick={() => toggleStudent(index)}
                                                className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center ${student.included
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-200 text-gray-400'
                                                    }`}
                                            >
                                                {student.included ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                            </button>
                                            <input
                                                type="text"
                                                value={student.name}
                                                onChange={(e) => updateStudentName(index, e.target.value)}
                                                className="flex-1 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* Create Button */}
                                <button
                                    onClick={handleBulkCreate}
                                    disabled={loading || !selectedClass || extractedStudents.filter(s => s.included).length === 0}
                                    className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading
                                        ? 'Creating Students...'
                                        : `Create ${extractedStudents.filter(s => s.included).length} Student(s)`}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}

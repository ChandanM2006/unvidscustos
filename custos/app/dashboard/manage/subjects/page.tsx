'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { BookOpen, Plus, Edit2, Trash2, CheckSquare, Square } from 'lucide-react'

interface Subject {
    subject_id: string
    name: string
    code: string
    description: string
    is_active: boolean
    created_at: string
    assignments?: ClassSectionAssignment[]
}

interface Class {
    class_id: string
    name: string
    grade_level: number
}

interface Section {
    section_id: string
    class_id: string
    name: string
}

interface ClassSectionAssignment {
    class_id: string
    section_id: string
    class_name?: string
    section_name?: string
}

export default function SubjectsManagement() {
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [classes, setClasses] = useState<Class[]>([])
    const [sections, setSections] = useState<Section[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
    const [mounted, setMounted] = useState(false)

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        is_active: true,
        assignments: [] as { class_id: string; section_id: string }[]
    })

    useEffect(() => {
        setMounted(true)
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        try {
            // Check role - only admins can access
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                window.location.href = '/login'
                return
            }

            const { data: userData } = await supabase
                .from('users')
                .select('role')
                .eq('email', session.user.email)
                .single()

            if (!userData || !['super_admin', 'sub_admin'].includes(userData.role)) {
                alert('Only administrators can access this page.')
                window.location.href = '/dashboard'
                return
            }

            // Load classes
            const { data: classesData, error: classesError } = await supabase
                .from('classes')
                .select('*')
                .order('grade_level')

            if (classesError) throw classesError
            setClasses(classesData || [])

            // Load sections
            const { data: sectionsData, error: sectionsError } = await supabase
                .from('sections')
                .select('*')
                .order('name')

            if (sectionsError) throw sectionsError
            setSections(sectionsData || [])

            // Load subjects with their assignments
            const { data: subjectsData, error: subjectsError } = await supabase
                .from('subjects')
                .select('*')
                .order('name')

            if (subjectsError) throw subjectsError

            // Load assignments for each subject
            if (subjectsData) {
                const subjectsWithAssignments = await Promise.all(
                    subjectsData.map(async (subject) => {
                        const { data: assignments } = await supabase
                            .from('class_section_subjects')
                            .select(`
                class_id,
                section_id,
                classes:class_id(name),
                sections:section_id(name)
              `)
                            .eq('subject_id', subject.subject_id)

                        return {
                            ...subject,
                            assignments: assignments?.map((a: any) => ({
                                class_id: a.class_id,
                                section_id: a.section_id,
                                class_name: a.classes?.name,
                                section_name: a.sections?.name
                            })) || []
                        }
                    })
                )
                setSubjects(subjectsWithAssignments)
            }
        } catch (error: any) {
            console.error('Error loading data:', error)
            alert('Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        if (formData.assignments.length === 0) {
            alert('Please select at least one class-section combination')
            return
        }

        setLoading(true)

        try {
            let subjectId: string

            if (editingSubject) {
                // Update subject
                const { error } = await supabase
                    .from('subjects')
                    .update({
                        name: formData.name,
                        code: formData.code,
                        description: formData.description,
                        is_active: formData.is_active
                    })
                    .eq('subject_id', editingSubject.subject_id)

                if (error) throw error
                subjectId = editingSubject.subject_id

                // Delete old assignments
                await supabase
                    .from('class_section_subjects')
                    .delete()
                    .eq('subject_id', subjectId)
            } else {
                // Create new subject
                const { data, error } = await supabase
                    .from('subjects')
                    .insert([{
                        name: formData.name,
                        code: formData.code,
                        description: formData.description,
                        is_active: formData.is_active
                    }])
                    .select()
                    .single()

                if (error) throw error
                subjectId = data.subject_id
            }

            // Insert new assignments
            const assignmentsToInsert = formData.assignments.map(a => ({
                subject_id: subjectId,
                class_id: a.class_id,
                section_id: a.section_id
            }))

            const { error: assignError } = await supabase
                .from('class_section_subjects')
                .insert(assignmentsToInsert)

            if (assignError) throw assignError

            alert(editingSubject ? 'Subject updated successfully!' : 'Subject created successfully!')
            setShowModal(false)
            setEditingSubject(null)
            resetForm()
            loadData()
        } catch (error: any) {
            console.error('Error saving subject:', error)
            alert('Failed to save subject: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this subject? All class-section assignments will be removed.')) return

        try {
            const { error } = await supabase
                .from('subjects')
                .delete()
                .eq('subject_id', id)

            if (error) throw error
            alert('Subject deleted successfully!')
            loadData()
        } catch (error: any) {
            console.error('Error deleting subject:', error)
            alert('Failed to delete subject: ' + error.message)
        }
    }

    function resetForm() {
        setFormData({
            name: '',
            code: '',
            description: '',
            is_active: true,
            assignments: []
        })
    }

    function openEditModal(subject: Subject) {
        setEditingSubject(subject)
        setFormData({
            name: subject.name,
            code: subject.code || '',
            description: subject.description || '',
            is_active: subject.is_active,
            assignments: subject.assignments?.map(a => ({
                class_id: a.class_id,
                section_id: a.section_id
            })) || []
        })
        setShowModal(true)
    }

    function toggleAssignment(classId: string, sectionId: string) {
        const exists = formData.assignments.some(
            a => a.class_id === classId && a.section_id === sectionId
        )

        if (exists) {
            setFormData(prev => ({
                ...prev,
                assignments: prev.assignments.filter(
                    a => !(a.class_id === classId && a.section_id === sectionId)
                )
            }))
        } else {
            setFormData(prev => ({
                ...prev,
                assignments: [...prev.assignments, { class_id: classId, section_id: sectionId }]
            }))
        }
    }

    function isAssigned(classId: string, sectionId: string): boolean {
        return formData.assignments.some(
            a => a.class_id === classId && a.section_id === sectionId
        )
    }

    // Group sections by class
    const classSections = classes.map(cls => ({
        class: cls,
        sections: sections.filter(s => s.class_id === cls.class_id)
    }))

    if (!mounted || (loading && subjects.length === 0)) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                            <BookOpen className="w-10 h-10 text-blue-600" />
                            Subjects Management
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Manage curriculum subjects and class assignments
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            resetForm()
                            setEditingSubject(null)
                            setShowModal(true)
                        }}
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
                    >
                        <Plus className="w-5 h-5" />
                        Add Subject
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <div className="text-3xl font-bold text-blue-600">{subjects.length}</div>
                        <div className="text-gray-600 mt-1">Total Subjects</div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <div className="text-3xl font-bold text-green-600">
                            {subjects.filter(s => s.is_active).length}
                        </div>
                        <div className="text-gray-600 mt-1">Active</div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <div className="text-3xl font-bold text-purple-600">
                            {subjects.reduce((acc, s) => acc + (s.assignments?.length || 0), 0)}
                        </div>
                        <div className="text-gray-600 mt-1">Total Assignments</div>
                    </div>
                </div>

                {/* Subjects List */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    {subjects.length === 0 ? (
                        <div className="p-12 text-center">
                            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-700 mb-2">No subjects yet</h3>
                            <p className="text-gray-500 mb-4">Get started by creating your first subject!</p>
                            <p className="text-sm text-gray-400">
                                💡 Make sure you've created Classes and Sections first
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                            {subjects.map((subject) => (
                                <div
                                    key={subject.subject_id}
                                    className="bg-gradient-to-br from-white to-gray-50 rounded-xl border-2 border-gray-100 p-6 hover:border-blue-300 hover:shadow-lg transition-all duration-200"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-xl font-bold text-gray-900">{subject.name}</h3>
                                                {!subject.is_active && (
                                                    <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">
                                                        Inactive
                                                    </span>
                                                )}
                                            </div>
                                            {subject.code && (
                                                <p className="text-sm text-gray-500 font-mono">{subject.code}</p>
                                            )}
                                        </div>
                                    </div>

                                    {subject.description && (
                                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{subject.description}</p>
                                    )}

                                    <div className="mb-4">
                                        <p className="text-xs text-gray-500 mb-2 font-semibold">Assigned to:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {subject.assignments && subject.assignments.length > 0 ? (
                                                subject.assignments.map((assign, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium"
                                                    >
                                                        {assign.class_name} - {assign.section_name}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-gray-400 text-xs">No assignments</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openEditModal(subject)}
                                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(subject.subject_id)}
                                            className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-4xl w-full mx-4 my-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">
                            {editingSubject ? 'Edit Subject' : 'Create New Subject'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Subject Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                                        placeholder="e.g., Mathematics, Science"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Subject Code
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                                        placeholder="e.g., MATH, SCI"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={2}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                                    placeholder="Brief description"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Assign to Class & Sections * ({formData.assignments.length} selected)
                                </label>
                                <div className="border-2 border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto bg-gray-50">
                                    {classSections.length === 0 ? (
                                        <p className="text-gray-500 text-center py-8">
                                            ⚠️ No classes or sections found. Please create classes and sections first!
                                        </p>
                                    ) : (
                                        <div className="space-y-4">
                                            {classSections.map(({ class: cls, sections: clsSections }) => (
                                                <div key={cls.class_id} className="bg-white rounded-lg p-4 border border-gray-200">
                                                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                                        <BookOpen className="w-4 h-4 text-blue-600" />
                                                        {cls.name} (Grade {cls.grade_level})
                                                    </h4>
                                                    {clsSections.length === 0 ? (
                                                        <p className="text-sm text-gray-400 ml-6">No sections available</p>
                                                    ) : (
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 ml-6">
                                                            {clsSections.map(section => (
                                                                <button
                                                                    key={section.section_id}
                                                                    type="button"
                                                                    onClick={() => toggleAssignment(cls.class_id, section.section_id)}
                                                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${isAssigned(cls.class_id, section.section_id)
                                                                        ? 'bg-blue-600 text-white shadow-md'
                                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                                        }`}
                                                                >
                                                                    {isAssigned(cls.class_id, section.section_id) ? (
                                                                        <CheckSquare className="w-4 h-4" />
                                                                    ) : (
                                                                        <Square className="w-4 h-4" />
                                                                    )}
                                                                    Section {section.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {formData.assignments.length === 0 && (
                                    <p className="text-red-500 text-sm mt-2">⚠️ Please select at least one class-section</p>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 cursor-pointer">
                                    Active Subject
                                </label>
                            </div>

                            <div className="flex space-x-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false)
                                        setEditingSubject(null)
                                        resetForm()
                                    }}
                                    className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || formData.assignments.length === 0}
                                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Saving...' : editingSubject ? 'Update Subject' : 'Create Subject'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

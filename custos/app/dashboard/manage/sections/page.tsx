'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSmartBack } from '@/lib/navigation'
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react'

interface Class {
    class_id: string
    name: string
    grade_level: number
}

interface Section {
    section_id: string
    class_id: string
    name: string
    created_at: string
    classes?: Class
}

export default function SectionsPage() {
    const { goBack, router } = useSmartBack('/dashboard/manage')
    const [sections, setSections] = useState<Section[]>([])
    const [classes, setClasses] = useState<Class[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingSection, setEditingSection] = useState<Section | null>(null)
    const [mounted, setMounted] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        class_id: ''
    })

    useEffect(() => {
        setMounted(true)
        loadData()
    }, [])

    const loadData = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }

            const { data: userData } = await supabase
                .from('users')
                .select('school_id, role')
                .eq('email', session.user.email)
                .single()

            // Only admins can access this page
            if (!userData || !['super_admin', 'sub_admin'].includes(userData.role)) {
                alert('Only administrators can access this page.')
                router.replace('/dashboard/redirect')
                return
            }

            if (userData?.school_id) {
                // Load classes
                const { data: classesData } = await supabase
                    .from('classes')
                    .select('*')
                    .eq('school_id', userData.school_id)
                    .order('grade_level', { ascending: true })

                if (classesData) setClasses(classesData)

                // Load sections filtered to this school's classes only
                const classIds = (classesData || []).map((c: Class) => c.class_id)

                if (classIds.length > 0) {
                    const { data: sectionsData } = await supabase
                        .from('sections')
                        .select(`
                            *,
                            classes (
                                class_id,
                                name,
                                grade_level
                            )
                        `)
                        .in('class_id', classIds)
                        .order('created_at', { ascending: false })

                    if (sectionsData) setSections(sectionsData as Section[])
                } else {
                    setSections([])
                }
            }
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            if (editingSection) {
                // Update existing section
                const { error } = await supabase
                    .from('sections')
                    .update({
                        name: formData.name,
                        class_id: formData.class_id
                    })
                    .eq('section_id', editingSection.section_id)

                if (error) {
                    console.error('Supabase update error:', error.message, error.details, error.hint, error.code)
                    alert('Failed to update section: ' + error.message)
                    return
                }
                alert('Section updated successfully!')
            } else {
                // Create new section
                const { error } = await supabase
                    .from('sections')
                    .insert({
                        class_id: formData.class_id,
                        name: formData.name
                    })

                if (error) {
                    console.error('Supabase insert error:', error.message, error.details, error.hint, error.code)
                    alert('Failed to create section: ' + error.message)
                    return
                }
                alert('Section created successfully!')
            }

            setShowModal(false)
            setEditingSection(null)
            setFormData({ name: '', class_id: '' })
            loadData()
        } catch (error: any) {
            console.error('Error saving section:', error?.message || error)
            alert('Failed to save section: ' + (error?.message || 'Unknown error'))
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (sectionId: string) => {
        if (!confirm('Are you sure you want to delete this section?')) {
            return
        }

        try {
            const { error } = await supabase
                .from('sections')
                .delete()
                .eq('section_id', sectionId)

            if (error) throw error
            alert('Section deleted successfully!')
            loadData()
        } catch (error: any) {
            console.error('Error deleting section:', error)
            alert('Failed to delete section: ' + error.message)
        }
    }

    const openEditModal = (section: Section) => {
        setEditingSection(section)
        setFormData({
            name: section.name,
            class_id: section.class_id
        })
        setShowModal(true)
    }

    const openCreateModal = () => {
        setEditingSection(null)
        setFormData({ name: '', class_id: classes[0]?.class_id || '' })
        setShowModal(true)
    }

    if (!mounted || (loading && sections.length === 0)) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <button
                            onClick={goBack}
                            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>Back to Manage</span>
                        </button>
                        <h1 className="text-xl font-semibold text-gray-800">Section Management</h1>
                        <button
                            onClick={openCreateModal}
                            disabled={classes.length === 0}
                            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Section</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {classes.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
                        <div className="text-6xl mb-4">📚</div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Classes Yet</h3>
                        <p className="text-gray-600 mb-6">You need to create classes before adding sections</p>
                        <button
                            onClick={() => router.push('/dashboard/manage/classes')}
                            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
                        >
                            Go to Class Management
                        </button>
                    </div>
                ) : sections.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
                        <div className="text-6xl mb-4">🏫</div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Sections Yet</h3>
                        <p className="text-gray-600 mb-6">Get started by creating your first section</p>
                        <button
                            onClick={openCreateModal}
                            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
                        >
                            Create First Section
                        </button>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Section Name
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Class
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Grade Level
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Created At
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {sections.map((section) => (
                                    <tr key={section.section_id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="text-2xl mr-3">📋</div>
                                                <div className="text-sm font-medium text-gray-900">{section.name}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{section.classes?.name}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                Grade {section.classes?.grade_level}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(section.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <button
                                                onClick={() => openEditModal(section)}
                                                className="text-blue-600 hover:text-blue-900 mr-4"
                                            >
                                                <Pencil className="w-4 h-4 inline" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(section.section_id)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                <Trash2 className="w-4 h-4 inline" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">
                            {editingSection ? 'Edit Section' : 'Create New Section'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Class *
                                </label>
                                <select
                                    value={formData.class_id}
                                    onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                                >
                                    <option value="">Select a class</option>
                                    {classes.map((cls) => (
                                        <option key={cls.class_id} value={cls.class_id}>
                                            {cls.name} (Grade {cls.grade_level})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Section Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                                    placeholder="e.g., A, B, C or Alpha, Beta"
                                />
                            </div>
                            <div className="flex space-x-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false)
                                        setEditingSection(null)
                                    }}
                                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : editingSection ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSmartBack } from '@/lib/navigation'
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react'

interface Class {
    class_id: string
    name: string
    grade_level: number
    created_at: string
}

export default function ClassesPage() {
    const { goBack, router } = useSmartBack('/dashboard/manage')
    const [classes, setClasses] = useState<Class[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingClass, setEditingClass] = useState<Class | null>(null)
    const [mounted, setMounted] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        grade_level: 1
    })

    useEffect(() => {
        setMounted(true)
        loadClasses()
    }, [])

    const loadClasses = async () => {
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
                const { data: classesData, error } = await supabase
                    .from('classes')
                    .select('*')
                    .eq('school_id', userData.school_id)
                    .order('grade_level', { ascending: true })

                if (!error && classesData) {
                    setClasses(classesData)
                }
            }
        } catch (error) {
            console.error('Error loading classes:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const { data: userData } = await supabase
                .from('users')
                .select('school_id')
                .eq('email', session.user.email)
                .single()

            if (editingClass) {
                // Update existing class
                const { error } = await supabase
                    .from('classes')
                    .update({
                        name: formData.name,
                        grade_level: formData.grade_level
                    })
                    .eq('class_id', editingClass.class_id)

                if (error) throw error
                alert('Class updated successfully!')
            } else {
                // Create new class
                const { error } = await supabase
                    .from('classes')
                    .insert({
                        school_id: userData?.school_id,
                        name: formData.name,
                        grade_level: formData.grade_level
                    })

                if (error) throw error
                alert('Class created successfully!')
            }

            setShowModal(false)
            setEditingClass(null)
            setFormData({ name: '', grade_level: 1 })
            loadClasses()
        } catch (error: any) {
            console.error('Error saving class:', error)
            alert('Failed to save class: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (classId: string) => {
        if (!confirm('Are you sure you want to delete this class? This will also delete all associated sections.')) {
            return
        }

        try {
            const { error } = await supabase
                .from('classes')
                .delete()
                .eq('class_id', classId)

            if (error) throw error
            alert('Class deleted successfully!')
            loadClasses()
        } catch (error: any) {
            console.error('Error deleting class:', error)
            alert('Failed to delete class: ' + error.message)
        }
    }

    const openEditModal = (classItem: Class) => {
        setEditingClass(classItem)
        setFormData({
            name: classItem.name,
            grade_level: classItem.grade_level
        })
        setShowModal(true)
    }

    const openCreateModal = () => {
        setEditingClass(null)
        setFormData({ name: '', grade_level: 1 })
        setShowModal(true)
    }

    if (!mounted || (loading && classes.length === 0)) {
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
                            <span>Back to Dashboard</span>
                        </button>
                        <h1 className="text-xl font-semibold text-gray-800">Class Management</h1>
                        <button
                            onClick={openCreateModal}
                            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Class</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    {classes.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="text-6xl mb-4">🏫</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Classes Yet</h3>
                            <p className="text-gray-600 mb-6">Get started by creating your first class</p>
                            <button
                                onClick={openCreateModal}
                                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
                            >
                                Create First Class
                            </button>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Grade Level
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Class Name
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
                                {classes.map((classItem) => (
                                    <tr key={classItem.class_id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-2xl font-bold text-blue-600">
                                                {classItem.grade_level}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{classItem.name}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(classItem.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <button
                                                onClick={() => openEditModal(classItem)}
                                                className="text-blue-600 hover:text-blue-900 mr-4"
                                            >
                                                <Pencil className="w-4 h-4 inline" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(classItem.class_id)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                <Trash2 className="w-4 h-4 inline" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </main>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">
                            {editingClass ? 'Edit Class' : 'Create New Class'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Class Name *
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
                                    Grade Level *
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="12"
                                    value={formData.grade_level || ''}
                                    onChange={(e) => setFormData({ ...formData, grade_level: parseInt(e.target.value) || 0 })}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                                />
                            </div>
                            <div className="flex space-x-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false)
                                        setEditingClass(null)
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
                                    {loading ? 'Saving...' : editingClass ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

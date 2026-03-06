'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useSmartBack } from '@/lib/navigation'
import { Calendar, Plus, Edit, Trash2, Check, X, ArrowLeft } from 'lucide-react'

interface AcademicYear {
    year_id: string
    year_name: string
    start_date: string
    end_date: string
    is_current: boolean
    status: string
    created_at: string
}

export default function AcademicYearsPage() {
    const { goBack, router } = useSmartBack('/dashboard/manage')
    const [years, setYears] = useState<AcademicYear[]>([])
    const [loading, setLoading] = useState(true)
    const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [editingYear, setEditingYear] = useState<AcademicYear | null>(null)

    const [formData, setFormData] = useState({
        year_name: '',
        start_date: '',
        end_date: '',
        is_current: true
    })

    useEffect(() => {
        loadYears()
    }, [])

    async function loadYears() {
        try {
            // Check role - only admins can access
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }

            const { data: userData } = await supabase
                .from('users')
                .select('role, school_id')
                .eq('email', session.user.email)
                .single()

            if (!userData || !['super_admin', 'sub_admin'].includes(userData.role)) {
                alert('Only administrators can access this page.')
                router.replace('/dashboard/redirect')
                return
            }

            setCurrentSchoolId(userData.school_id)

            const { data, error } = await supabase
                .from('academic_years')
                .select('*')
                .eq('school_id', userData.school_id)
                .order('start_date', { ascending: false })

            if (error) throw error
            setYears(data || [])
        } catch (error: any) {
            console.error('Error loading years:', error)
        } finally {
            setLoading(false)
        }
    }

    function openModal(year?: AcademicYear) {
        if (year) {
            setEditingYear(year)
            setFormData({
                year_name: year.year_name,
                start_date: year.start_date,
                end_date: year.end_date,
                is_current: year.is_current
            })
        } else {
            setEditingYear(null)
            setFormData({
                year_name: '',
                start_date: '',
                end_date: '',
                is_current: true
            })
        }
        setShowModal(true)
    }

    function closeModal() {
        setShowModal(false)
        setEditingYear(null)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)

        try {
            if (editingYear) {
                const { error } = await supabase
                    .from('academic_years')
                    .update(formData)
                    .eq('year_id', editingYear.year_id)

                if (error) throw error
                alert('Academic year updated successfully!')
            } else {
                const { error } = await supabase
                    .from('academic_years')
                    .insert([{ ...formData, school_id: currentSchoolId }])

                if (error) throw error
                alert('Academic year created successfully!')
            }

            closeModal()
            loadYears()
        } catch (error: any) {
            console.error('Error saving year:', error)
            alert('Failed to save: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this academic year?')) return

        try {
            const { error } = await supabase
                .from('academic_years')
                .delete()
                .eq('year_id', id)

            if (error) throw error
            alert('Academic year deleted successfully!')
            loadYears()
        } catch (error: any) {
            console.error('Error deleting year:', error)
            alert('Failed to delete: ' + error.message)
        }
    }

    async function setActiveYear(id: string) {
        try {
            // Deactivate all years for THIS school only
            await supabase
                .from('academic_years')
                .update({ is_current: false })
                .eq('school_id', currentSchoolId)

            // Activate selected year
            const { error } = await supabase
                .from('academic_years')
                .update({ is_current: true })
                .eq('year_id', id)

            if (error) throw error
            alert('Active academic year updated!')
            loadYears()
        } catch (error: any) {
            console.error('Error setting active year:', error)
            alert('Failed to set active: ' + error.message)
        }
    }

    const activeYear = years.find(y => y.is_current)

    if (loading && years.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8">
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
                                <Calendar className="w-10 h-10 text-blue-600" />
                                Academic Years
                            </h1>
                            <p className="text-gray-600 mt-2">
                                Manage school academic sessions and years
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => openModal()}
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
                    >
                        <Plus className="w-5 h-5" />
                        Add Academic Year
                    </button>
                </div>

                {/* Active Year Banner */}
                {activeYear && (
                    <div className="mb-8 p-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl shadow-xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-medium opacity-90">Current Academic Year</div>
                                <div className="text-3xl font-bold mt-1">{activeYear.year_name}</div>
                                <div className="text-sm mt-2">
                                    {new Date(activeYear.start_date).toLocaleDateString()} - {new Date(activeYear.end_date).toLocaleDateString()}
                                </div>
                            </div>
                            <Check className="w-16 h-16 opacity-50" />
                        </div>
                    </div>
                )}

                {/* Years List */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    {years.length === 0 ? (
                        <div className="p-12 text-center">
                            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Academic Years</h3>
                            <p className="text-gray-500 mb-6">Create your first academic year to get started</p>
                            <button
                                onClick={() => openModal()}
                                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all inline-flex items-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Add Academic Year
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {years.map((year) => (
                                <div
                                    key={year.year_id}
                                    className={`p-6 hover:bg-gray-50 transition-colors ${year.is_current ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-xl font-bold text-gray-900">{year.year_name}</h3>
                                                {year.is_current && (
                                                    <span className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-full">
                                                        ACTIVE
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-gray-600 mt-2">
                                                {new Date(year.start_date).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })} - {new Date(year.end_date).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!year.is_current && (
                                                <button
                                                    onClick={() => setActiveYear(year.year_id)}
                                                    className="px-4 py-2 border-2 border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors flex items-center gap-2"
                                                >
                                                    <Check className="w-4 h-4" />
                                                    Set Active
                                                </button>
                                            )}
                                            <button
                                                onClick={() => openModal(year)}
                                                className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Edit className="w-5 h-5 text-blue-600" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(year.year_id)}
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

                {/* Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">
                                {editingYear ? 'Edit Academic Year' : 'Add Academic Year'}
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Year Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.year_name}
                                        onChange={(e) => setFormData({ ...formData, year_name: e.target.value })}
                                        required
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                                        placeholder="e.g., 2024-2025"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Start Date *
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.start_date}
                                            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            End Date *
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.end_date}
                                            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                            required
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="is_current"
                                        checked={formData.is_current}
                                        onChange={(e) => setFormData({ ...formData, is_current: e.target.checked })}
                                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <label htmlFor="is_current" className="text-gray-700">
                                        Set as active academic year
                                    </label>
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
                                        className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-semibold disabled:opacity-50"
                                    >
                                        {loading ? 'Saving...' : editingYear ? 'Update' : 'Create'}
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

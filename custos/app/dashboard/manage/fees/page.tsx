'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Plus, Trash2, Edit3, Save, X, IndianRupee,
    ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
    Receipt, AlertCircle, CheckCircle, Loader2, Eye
} from 'lucide-react'

interface FeeSlot {
    fee_slot_id?: string
    name: string
    amount: number
    description: string
    is_mandatory: boolean
}

interface FeeStructure {
    fee_structure_id: string
    school_id: string
    class_id: string
    academic_year: string
    name: string
    description: string
    is_active: boolean
    fee_slots: FeeSlot[]
    classes: { name: string; grade_level: number }
}

interface ClassItem {
    class_id: string
    name: string
    grade_level: number
}

type TabType = 'structures' | 'payments'

export default function FeesManagePage() {
    const { goBack, router } = useSmartBack('/dashboard/manage')

    const [activeTab, setActiveTab] = useState<TabType>('structures')
    const [schoolId, setSchoolId] = useState<string>('')
    const [classes, setClasses] = useState<ClassItem[]>([])
    const [structures, setStructures] = useState<FeeStructure[]>([])
    const [payments, setPayments] = useState<any[]>([]) // eslint-disable-line @typescript-eslint/no-explicit-any
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // Form state
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        class_id: '',
        academic_year: '2025-2026',
        name: '',
        description: '',
    })
    const [formSlots, setFormSlots] = useState<FeeSlot[]>([
        { name: 'Tuition Fee', amount: 0, description: '', is_mandatory: true }
    ])

    const [expandedStructure, setExpandedStructure] = useState<string | null>(null)

    // Fetch school data
    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            // Get user's school
            const { data: user } = await supabase
                .from('users')
                .select('school_id')
                .eq('email', session.user.email)
                .single()

            if (!user) return
            setSchoolId(user.school_id)

            // Get classes
            const { data: classData } = await supabase
                .from('classes')
                .select('class_id, name, grade_level')
                .eq('school_id', user.school_id)
                .order('grade_level')

            setClasses(classData || [])

            // Get fee structures
            const res = await fetch(`/api/fees/structures?school_id=${user.school_id}`)
            const json = await res.json()
            setStructures(json.data || [])

            // Get payments
            const payRes = await fetch(`/api/fees/payments?school_id=${user.school_id}`)
            const payJson = await payRes.json()
            setPayments(payJson.data || [])
        } catch (err) {
            console.error('Error fetching data:', err)
            setError('Failed to load data')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    const resetForm = () => {
        setFormData({ class_id: '', academic_year: '2025-2026', name: '', description: '' })
        setFormSlots([{ name: 'Tuition Fee', amount: 0, description: '', is_mandatory: true }])
        setEditingId(null)
        setShowForm(false)
    }

    const addSlot = () => {
        setFormSlots([...formSlots, { name: '', amount: 0, description: '', is_mandatory: true }])
    }

    const removeSlot = (index: number) => {
        if (formSlots.length <= 1) return
        setFormSlots(formSlots.filter((_, i) => i !== index))
    }

    const updateSlot = (index: number, field: keyof FeeSlot, value: string | number | boolean) => {
        const updated = [...formSlots]
        updated[index] = { ...updated[index], [field]: value }
        setFormSlots(updated)
    }

    const getTotalAmount = (slots: FeeSlot[]) => {
        return slots.reduce((sum, slot) => sum + Number(slot.amount), 0)
    }

    const handleSubmit = async () => {
        setError('')
        setSuccess('')

        if (!formData.class_id || !formData.name || !formData.academic_year) {
            setError('Please fill in all required fields')
            return
        }

        const emptySlots = formSlots.filter(s => !s.name || s.amount <= 0)
        if (emptySlots.length > 0) {
            setError('All fee slots must have a name and amount greater than 0')
            return
        }

        setSaving(true)
        try {
            if (editingId) {
                // Update existing
                const res = await fetch('/api/fees/structures', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fee_structure_id: editingId,
                        name: formData.name,
                        description: formData.description,
                        slots: formSlots,
                    }),
                })
                const json = await res.json()
                if (!res.ok) throw new Error(json.error)
                setSuccess('Fee structure updated successfully!')
            } else {
                // Create new
                const res = await fetch('/api/fees/structures', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        school_id: schoolId,
                        class_id: formData.class_id,
                        academic_year: formData.academic_year,
                        name: formData.name,
                        description: formData.description,
                        slots: formSlots,
                    }),
                })
                const json = await res.json()
                if (!res.ok) throw new Error(json.error)
                setSuccess('Fee structure created successfully!')
            }

            resetForm()
            fetchData()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to save fee structure')
        } finally {
            setSaving(false)
        }
    }

    const handleEdit = (structure: FeeStructure) => {
        setFormData({
            class_id: structure.class_id,
            academic_year: structure.academic_year,
            name: structure.name,
            description: structure.description || '',
        })
        setFormSlots(
            structure.fee_slots.map(s => ({
                name: s.name,
                amount: s.amount,
                description: s.description || '',
                is_mandatory: s.is_mandatory,
            }))
        )
        setEditingId(structure.fee_structure_id)
        setShowForm(true)
    }

    const handleToggleActive = async (structure: FeeStructure) => {
        try {
            const res = await fetch('/api/fees/structures', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fee_structure_id: structure.fee_structure_id,
                    is_active: !structure.is_active,
                }),
            })
            if (!res.ok) {
                const json = await res.json()
                throw new Error(json.error)
            }
            fetchData()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to update')
        }
    }

    const handleDelete = async (structureId: string) => {
        if (!confirm('Are you sure you want to delete this fee structure?')) return
        try {
            const res = await fetch(`/api/fees/structures?fee_structure_id=${structureId}`, {
                method: 'DELETE',
            })
            if (!res.ok) {
                const json = await res.json()
                throw new Error(json.error)
            }
            setSuccess('Fee structure deleted')
            fetchData()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to delete')
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid': return 'bg-emerald-100 text-emerald-800'
            case 'created': return 'bg-yellow-100 text-yellow-800'
            case 'failed': return 'bg-red-100 text-red-800'
            case 'pending': return 'bg-gray-100 text-gray-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <p className="text-gray-600">Loading fee management...</p>
                </div>
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
                            <span>Back</span>
                        </button>
                        <h1 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                            <IndianRupee className="w-5 h-5 text-green-600" />
                            Fee Management
                        </h1>
                        <div className="w-20"></div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Alerts */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-800">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span>{error}</span>
                        <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
                    </div>
                )}
                {success && (
                    <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800">
                        <CheckCircle className="w-5 h-5 shrink-0" />
                        <span>{success}</span>
                        <button onClick={() => setSuccess('')} className="ml-auto"><X className="w-4 h-4" /></button>
                    </div>
                )}

                {/* Razorpay Test Mode Banner */}
                <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-amber-800">🧪 Test Mode Active</p>
                        <p className="text-amber-700 text-sm">Razorpay is running in test mode. No real payments will be processed. Use test card <code className="bg-amber-100 px-1 rounded">4111 1111 1111 1111</code> for testing.</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-8 bg-gray-100 rounded-xl p-1 w-fit">
                    <button
                        onClick={() => setActiveTab('structures')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'structures'
                            ? 'bg-white shadow-sm text-blue-700'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <span className="flex items-center gap-2">
                            <Receipt className="w-4 h-4" />
                            Fee Structures
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('payments')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'payments'
                            ? 'bg-white shadow-sm text-blue-700'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <span className="flex items-center gap-2">
                            <IndianRupee className="w-4 h-4" />
                            Payments ({payments.filter(p => p.status === 'paid').length})
                        </span>
                    </button>
                </div>

                {/* Structures Tab */}
                {activeTab === 'structures' && (
                    <div>
                        {/* Create Button */}
                        {!showForm && (
                            <button
                                onClick={() => setShowForm(true)}
                                className="mb-6 flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 font-medium"
                            >
                                <Plus className="w-5 h-5" />
                                Create Fee Structure
                            </button>
                        )}

                        {/* Create/Edit Form */}
                        {showForm && (
                            <div className="mb-8 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                                <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600">
                                    <h3 className="text-xl font-bold text-white">
                                        {editingId ? 'Edit Fee Structure' : 'Create New Fee Structure'}
                                    </h3>
                                    <p className="text-blue-100 text-sm mt-1">
                                        Define fee categories and amounts for a class
                                    </p>
                                </div>

                                <div className="p-6 space-y-6">
                                    {/* Basic Info */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label>
                                            <select
                                                value={formData.class_id}
                                                onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                                                disabled={!!editingId}
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                            >
                                                <option value="">Select Class</option>
                                                {classes.map(c => (
                                                    <option key={c.class_id} value={c.class_id}>
                                                        {c.name} (Grade {c.grade_level})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year *</label>
                                            <select
                                                value={formData.academic_year}
                                                onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                                                disabled={!!editingId}
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                            >
                                                <option value="2024-2025">2024-2025</option>
                                                <option value="2025-2026">2025-2026</option>
                                                <option value="2026-2027">2026-2027</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Structure Name *</label>
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                placeholder="e.g., Annual Fee 2025-2026"
                                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                                        <input
                                            type="text"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Brief description of this fee structure"
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    {/* Fee Slots */}
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-lg font-semibold text-gray-900">Fee Categories</h4>
                                            <button
                                                onClick={addSlot}
                                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add Category
                                            </button>
                                        </div>

                                        <div className="space-y-3">
                                            {formSlots.map((slot, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200"
                                                >
                                                    <span className="mt-2.5 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                                                        {index + 1}
                                                    </span>
                                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                                                        <div className="md:col-span-2">
                                                            <input
                                                                type="text"
                                                                value={slot.name}
                                                                onChange={(e) => updateSlot(index, 'name', e.target.value)}
                                                                placeholder="Fee name (e.g., Tuition Fee)"
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                            />
                                                        </div>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-2 text-gray-500">₹</span>
                                                            <input
                                                                type="number"
                                                                value={slot.amount || ''}
                                                                onChange={(e) => updateSlot(index, 'amount', parseFloat(e.target.value) || 0)}
                                                                placeholder="Amount"
                                                                min="0"
                                                                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => updateSlot(index, 'is_mandatory', !slot.is_mandatory)}
                                                                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${slot.is_mandatory
                                                                    ? 'bg-green-100 text-green-700'
                                                                    : 'bg-gray-100 text-gray-500'
                                                                    }`}
                                                            >
                                                                {slot.is_mandatory ? (
                                                                    <ToggleRight className="w-4 h-4" />
                                                                ) : (
                                                                    <ToggleLeft className="w-4 h-4" />
                                                                )}
                                                                {slot.is_mandatory ? 'Required' : 'Optional'}
                                                            </button>
                                                            {formSlots.length > 1 && (
                                                                <button
                                                                    onClick={() => removeSlot(index)}
                                                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Total */}
                                        <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl flex items-center justify-between">
                                            <span className="font-semibold text-green-800">Total Fee Amount</span>
                                            <span className="text-2xl font-bold text-green-700">
                                                ₹{getTotalAmount(formSlots).toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={handleSubmit}
                                            disabled={saving}
                                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50"
                                        >
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            {editingId ? 'Update Structure' : 'Save Structure'}
                                        </button>
                                        <button
                                            onClick={resetForm}
                                            className="px-6 py-3 text-gray-600 hover:text-gray-900 rounded-xl border border-gray-300 hover:border-gray-400 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Existing Structures List */}
                        {structures.length === 0 && !showForm ? (
                            <div className="text-center py-16">
                                <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Fee Structures Yet</h3>
                                <p className="text-gray-500">Create your first fee structure to start collecting fees</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {structures.map((structure) => (
                                    <div
                                        key={structure.fee_structure_id}
                                        className={`bg-white rounded-2xl shadow-md border transition-all ${structure.is_active ? 'border-gray-100' : 'border-gray-200 opacity-60'
                                            }`}
                                    >
                                        {/* Structure Header */}
                                        <div
                                            className="p-6 flex items-center justify-between cursor-pointer"
                                            onClick={() => setExpandedStructure(
                                                expandedStructure === structure.fee_structure_id ? null : structure.fee_structure_id
                                            )}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${structure.is_active
                                                    ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                                                    : 'bg-gray-300'
                                                    }`}>
                                                    <IndianRupee className="w-6 h-6 text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900 text-lg">{structure.name}</h3>
                                                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium">
                                                            {structure.classes?.name || 'Unknown Class'}
                                                        </span>
                                                        <span>{structure.academic_year}</span>
                                                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${structure.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                            {structure.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-xl font-bold text-green-700">
                                                    ₹{getTotalAmount(structure.fee_slots).toLocaleString('en-IN')}
                                                </span>
                                                {expandedStructure === structure.fee_structure_id
                                                    ? <ChevronUp className="w-5 h-5 text-gray-400" />
                                                    : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {expandedStructure === structure.fee_structure_id && (
                                            <div className="border-t border-gray-100 px-6 pb-6">
                                                {/* Slots Table */}
                                                <div className="mt-4 bg-gray-50 rounded-xl overflow-hidden">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="bg-gray-100">
                                                                <th className="text-left px-4 py-3 font-semibold text-gray-700">#</th>
                                                                <th className="text-left px-4 py-3 font-semibold text-gray-700">Fee Category</th>
                                                                <th className="text-left px-4 py-3 font-semibold text-gray-700">Type</th>
                                                                <th className="text-right px-4 py-3 font-semibold text-gray-700">Amount</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {structure.fee_slots
                                                                .sort((a, b) => (a.fee_slot_id || '').localeCompare(b.fee_slot_id || ''))
                                                                .map((slot, idx) => (
                                                                    <tr key={slot.fee_slot_id || idx} className="border-t border-gray-200">
                                                                        <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                                                                        <td className="px-4 py-3 font-medium text-gray-900">{slot.name}</td>
                                                                        <td className="px-4 py-3">
                                                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${slot.is_mandatory
                                                                                ? 'bg-blue-100 text-blue-700'
                                                                                : 'bg-gray-100 text-gray-600'
                                                                                }`}>
                                                                                {slot.is_mandatory ? 'Mandatory' : 'Optional'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                                                            ₹{Number(slot.amount).toLocaleString('en-IN')}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            <tr className="border-t-2 border-gray-300 bg-gradient-to-r from-green-50 to-emerald-50">
                                                                <td colSpan={3} className="px-4 py-3 font-bold text-green-800">Total</td>
                                                                <td className="px-4 py-3 text-right font-bold text-green-700 text-lg">
                                                                    ₹{getTotalAmount(structure.fee_slots).toLocaleString('en-IN')}
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex gap-3 mt-4">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleEdit(structure) }}
                                                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleToggleActive(structure) }}
                                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${structure.is_active
                                                            ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                                                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                                                            }`}
                                                    >
                                                        {structure.is_active ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                                                        {structure.is_active ? 'Deactivate' : 'Activate'}
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(structure.fee_structure_id) }}
                                                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Payments Tab */}
                {activeTab === 'payments' && (
                    <div>
                        {payments.length === 0 ? (
                            <div className="text-center py-16">
                                <IndianRupee className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Payments Yet</h3>
                                <p className="text-gray-500">Payments will appear here when parents pay fees</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="text-left px-6 py-4 font-semibold text-gray-700">Student</th>
                                            <th className="text-left px-6 py-4 font-semibold text-gray-700">Fee Structure</th>
                                            <th className="text-left px-6 py-4 font-semibold text-gray-700">Amount</th>
                                            <th className="text-left px-6 py-4 font-semibold text-gray-700">Status</th>
                                            <th className="text-left px-6 py-4 font-semibold text-gray-700">Date</th>
                                            <th className="text-left px-6 py-4 font-semibold text-gray-700">Receipt</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payments.map((payment) => (
                                            <tr key={payment.payment_id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-gray-900">
                                                        {payment.users?.full_name || 'Unknown'}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {payment.users?.email}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-700">
                                                    {payment.fee_structures?.name || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 font-semibold text-gray-900">
                                                    ₹{Number(payment.total_amount).toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(payment.status)}`}>
                                                        {payment.status.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-600">
                                                    {payment.paid_at
                                                        ? new Date(payment.paid_at).toLocaleDateString('en-IN')
                                                        : new Date(payment.created_at).toLocaleDateString('en-IN')
                                                    }
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button className="text-blue-600 hover:text-blue-800">
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}

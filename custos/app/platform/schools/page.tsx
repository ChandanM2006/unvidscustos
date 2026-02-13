'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
    Building2, Plus, Users, Key, Eye, EyeOff,
    Loader2, Copy, CheckCircle, School, Edit2,
    Trash2, ArrowLeft, Settings, X
} from 'lucide-react'

interface SchoolData {
    school_id: string
    name: string
    address: string
    phone: string
    email: string
    config_json: any
    created_at: string
    admin_email?: string
    user_count?: number
}

export default function SchoolManagementPage() {
    const router = useRouter()
    const [schools, setSchools] = useState<SchoolData[]>([])
    const [loading, setLoading] = useState(true)

    // Create School Modal
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [creating, setCreating] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [copiedCredentials, setCopiedCredentials] = useState(false)

    // Created credentials (to show after success)
    const [createdCredentials, setCreatedCredentials] = useState<{
        email: string
        password: string
        schoolName: string
    } | null>(null)

    const [formData, setFormData] = useState({
        schoolName: '',
        address: '',
        phone: '',
        schoolEmail: '',
        adminName: '',
        adminEmail: '',
        adminPassword: ''
    })

    useEffect(() => {
        loadSchools()
    }, [])

    async function loadSchools() {
        try {
            // Load all schools
            const { data: schoolsData, error } = await supabase
                .from('schools')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error

            // Get user counts for each school
            if (schoolsData) {
                const enrichedSchools = await Promise.all(
                    schoolsData.map(async (school) => {
                        // Get admin user
                        const { data: adminData } = await supabase
                            .from('users')
                            .select('email')
                            .eq('school_id', school.school_id)
                            .eq('role', 'super_admin')
                            .limit(1)
                            .single()

                        // Get user count
                        const { count } = await supabase
                            .from('users')
                            .select('*', { count: 'exact', head: true })
                            .eq('school_id', school.school_id)

                        return {
                            ...school,
                            admin_email: adminData?.email || 'N/A',
                            user_count: count || 0
                        }
                    })
                )
                setSchools(enrichedSchools)
            }
        } catch (error) {
            console.error('Error loading schools:', error)
        } finally {
            setLoading(false)
        }
    }

    function generatePassword() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
        let password = ''
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        setFormData(f => ({ ...f, adminPassword: password }))
    }

    async function handleCreateSchool() {
        // Validation
        if (!formData.schoolName || !formData.adminName || !formData.adminEmail || !formData.adminPassword) {
            alert('Please fill in all required fields:\n• School Name\n• Admin Name\n• Admin Email\n• Admin Password')
            return
        }

        if (formData.adminPassword.length < 6) {
            alert('Password must be at least 6 characters')
            return
        }

        setCreating(true)

        try {
            // Step 1: Create the school
            const { data: schoolData, error: schoolError } = await supabase
                .from('schools')
                .insert({
                    name: formData.schoolName,
                    address: formData.address,
                    phone: formData.phone,
                    email: formData.schoolEmail,
                    config_json: {
                        primary_color: '#2563eb',
                        secondary_color: '#7c3aed'
                    }
                })
                .select()
                .single()

            if (schoolError) throw schoolError

            // Step 2: Create Supabase Auth user for admin
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.adminEmail,
                password: formData.adminPassword,
                options: {
                    data: {
                        full_name: formData.adminName,
                        role: 'super_admin'
                    }
                }
            })

            if (authError) throw authError

            // Step 3: Create user record in users table
            const { error: userError } = await supabase
                .from('users')
                .insert({
                    user_id: authData.user?.id,
                    email: formData.adminEmail,
                    full_name: formData.adminName,
                    role: 'super_admin',
                    school_id: schoolData.school_id
                })

            if (userError) throw userError

            // Success! Show credentials
            setCreatedCredentials({
                email: formData.adminEmail,
                password: formData.adminPassword,
                schoolName: formData.schoolName
            })

            // Reset form
            setFormData({
                schoolName: '',
                address: '',
                phone: '',
                schoolEmail: '',
                adminName: '',
                adminEmail: '',
                adminPassword: ''
            })

            // Reload schools list
            loadSchools()

        } catch (error: any) {
            console.error('Error creating school:', error)
            alert('Error creating school: ' + error.message)
        } finally {
            setCreating(false)
        }
    }

    function copyCredentials() {
        if (!createdCredentials) return

        const text = `School: ${createdCredentials.schoolName}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`
        navigator.clipboard.writeText(text)
        setCopiedCredentials(true)
        setTimeout(() => setCopiedCredentials(false), 2000)
    }

    async function handleDeleteSchool(schoolId: string, schoolName: string) {
        if (!confirm(`Are you sure you want to delete "${schoolName}"?\n\nThis will delete ALL data including:\n• All users\n• All classes and sections\n• All documents and content\n\nThis action CANNOT be undone.`)) {
            return
        }

        try {
            // Delete school (cascades to users, etc.)
            const { error } = await supabase
                .from('schools')
                .delete()
                .eq('school_id', schoolId)

            if (error) throw error

            alert('School deleted successfully')
            loadSchools()
        } catch (error: any) {
            console.error('Error deleting school:', error)
            alert('Error: ' + error.message)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/platform')}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6 text-white" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-white">School Management</h1>
                            <p className="text-purple-300">Create and manage schools on your platform</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setCreatedCredentials(null)
                            setShowCreateModal(true)
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg"
                    >
                        <Plus className="w-5 h-5" />
                        Create New School
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-500/20 rounded-xl">
                                <Building2 className="w-8 h-8 text-blue-400" />
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-white">{schools.length}</div>
                                <div className="text-purple-300">Total Schools</div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-500/20 rounded-xl">
                                <Users className="w-8 h-8 text-green-400" />
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-white">
                                    {schools.reduce((sum, s) => sum + (s.user_count || 0), 0)}
                                </div>
                                <div className="text-purple-300">Total Users</div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-500/20 rounded-xl">
                                <CheckCircle className="w-8 h-8 text-purple-400" />
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-white">{schools.length}</div>
                                <div className="text-purple-300">Active Schools</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Schools List */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 overflow-hidden">
                    <div className="p-6 border-b border-white/10">
                        <h2 className="text-xl font-bold text-white">All Schools</h2>
                    </div>

                    {schools.length === 0 ? (
                        <div className="p-12 text-center">
                            <Building2 className="w-16 h-16 text-white/30 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">No Schools Yet</h3>
                            <p className="text-purple-300 mb-4">Create your first school to get started</p>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
                            >
                                Create School
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/10">
                            {schools.map(school => (
                                <div key={school.school_id} className="p-6 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                                                <School className="w-6 h-6 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white">{school.name}</h3>
                                                <p className="text-sm text-purple-300">{school.address || 'No address'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-8">
                                            <div className="text-right">
                                                <div className="text-sm text-purple-300">Admin</div>
                                                <div className="text-white font-medium">{school.admin_email}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm text-purple-300">Users</div>
                                                <div className="text-white font-bold text-lg">{school.user_count}</div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleDeleteSchool(school.school_id, school.name)}
                                                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                                    title="Delete school"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create School Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-white/20">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">
                                {createdCredentials ? '✅ School Created!' : 'Create New School'}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowCreateModal(false)
                                    setCreatedCredentials(null)
                                }}
                                className="p-2 hover:bg-white/10 rounded-lg"
                            >
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>

                        {createdCredentials ? (
                            // Show created credentials
                            <div className="p-6">
                                <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-6 mb-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <CheckCircle className="w-8 h-8 text-green-400" />
                                        <div>
                                            <h3 className="text-lg font-bold text-white">School Created Successfully!</h3>
                                            <p className="text-green-300 text-sm">Save these credentials - they won't be shown again</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3 bg-black/30 rounded-lg p-4">
                                        <div>
                                            <span className="text-purple-300 text-sm">School:</span>
                                            <div className="text-white font-medium">{createdCredentials.schoolName}</div>
                                        </div>
                                        <div>
                                            <span className="text-purple-300 text-sm">Admin Email:</span>
                                            <div className="text-white font-mono">{createdCredentials.email}</div>
                                        </div>
                                        <div>
                                            <span className="text-purple-300 text-sm">Password:</span>
                                            <div className="text-white font-mono">{createdCredentials.password}</div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={copyCredentials}
                                    className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-purple-700"
                                >
                                    {copiedCredentials ? (
                                        <>
                                            <CheckCircle className="w-5 h-5" />
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-5 h-5" />
                                            Copy Credentials
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            // Show create form
                            <div className="p-6 space-y-4">
                                <div className="border-b border-white/10 pb-4 mb-4">
                                    <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                                        <Building2 className="w-5 h-5 text-purple-400" />
                                        School Details
                                    </h3>
                                    <div className="space-y-3">
                                        <input
                                            type="text"
                                            value={formData.schoolName}
                                            onChange={(e) => setFormData(f => ({ ...f, schoolName: e.target.value }))}
                                            className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50"
                                            placeholder="School Name *"
                                        />
                                        <input
                                            type="text"
                                            value={formData.address}
                                            onChange={(e) => setFormData(f => ({ ...f, address: e.target.value }))}
                                            className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50"
                                            placeholder="Address"
                                        />
                                        <div className="grid grid-cols-2 gap-3">
                                            <input
                                                type="text"
                                                value={formData.phone}
                                                onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))}
                                                className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50"
                                                placeholder="Phone"
                                            />
                                            <input
                                                type="email"
                                                value={formData.schoolEmail}
                                                onChange={(e) => setFormData(f => ({ ...f, schoolEmail: e.target.value }))}
                                                className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50"
                                                placeholder="School Email"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                                        <Key className="w-5 h-5 text-green-400" />
                                        Super Admin Credentials
                                    </h3>
                                    <div className="space-y-3">
                                        <input
                                            type="text"
                                            value={formData.adminName}
                                            onChange={(e) => setFormData(f => ({ ...f, adminName: e.target.value }))}
                                            className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50"
                                            placeholder="Admin Full Name *"
                                        />
                                        <input
                                            type="email"
                                            value={formData.adminEmail}
                                            onChange={(e) => setFormData(f => ({ ...f, adminEmail: e.target.value }))}
                                            className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50"
                                            placeholder="Admin Email *"
                                        />
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={formData.adminPassword}
                                                onChange={(e) => setFormData(f => ({ ...f, adminPassword: e.target.value }))}
                                                className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 pr-24"
                                                placeholder="Admin Password *"
                                            />
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="p-1.5 hover:bg-white/10 rounded text-white/50"
                                                >
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={generatePassword}
                                                    className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                                                >
                                                    Generate
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!createdCredentials && (
                            <div className="p-6 border-t border-white/10 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 text-white hover:bg-white/10 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateSchool}
                                    disabled={creating}
                                    className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-green-700 disabled:opacity-50"
                                >
                                    {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                    Create School
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

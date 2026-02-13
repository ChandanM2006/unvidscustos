'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Pencil, Trash2, Search, UserPlus, X, Loader2, Eye, EyeOff } from 'lucide-react'

interface Class {
    class_id: string
    name: string
}

interface Section {
    section_id: string
    name: string
    class_id: string
}

interface User {
    user_id: string
    email: string
    full_name: string
    role: string
    class_id: string | null
    section_id: string | null
    created_at: string
}

export default function UsersPage() {
    const router = useRouter()
    const [users, setUsers] = useState<User[]>([])
    const [filteredUsers, setFilteredUsers] = useState<User[]>([])
    const [classes, setClasses] = useState<Class[]>([])
    const [sections, setSections] = useState<Section[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [roleFilter, setRoleFilter] = useState('all')
    const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null)

    // Add/Edit User Modal
    const [showModal, setShowModal] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [saving, setSaving] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const [formData, setFormData] = useState({
        email: '',
        full_name: '',
        role: 'student',
        password: '',
        class_id: '',
        section_id: ''
    })

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        filterUsers()
    }, [users, searchQuery, roleFilter])

    const loadData = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }

            const { data: userData } = await supabase
                .from('users')
                .select('school_id')
                .eq('email', session.user.email)
                .single()

            if (userData?.school_id) {
                setCurrentSchoolId(userData.school_id)

                // Load users
                const { data: usersData } = await supabase
                    .from('users')
                    .select('*')
                    .eq('school_id', userData.school_id)
                    .order('created_at', { ascending: false })

                if (usersData) setUsers(usersData)

                // Load classes
                const { data: classesData } = await supabase
                    .from('classes')
                    .select('*')
                    .eq('school_id', userData.school_id)
                    .order('grade_level', { ascending: true })

                if (classesData) setClasses(classesData)

                // Load sections
                const { data: sectionsData } = await supabase
                    .from('sections')
                    .select('*')

                if (sectionsData) setSections(sectionsData)
            }
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    const filterUsers = () => {
        let filtered = users

        if (roleFilter !== 'all') {
            filtered = filtered.filter(user => user.role === roleFilter)
        }

        if (searchQuery) {
            filtered = filtered.filter(user =>
                user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.email.toLowerCase().includes(searchQuery.toLowerCase())
            )
        }

        setFilteredUsers(filtered)
    }

    const openAddModal = () => {
        setEditingUser(null)
        setFormData({
            email: '',
            full_name: '',
            role: 'student',
            password: '',
            class_id: '',
            section_id: ''
        })
        setShowModal(true)
    }

    const openEditModal = (user: User) => {
        setEditingUser(user)
        setFormData({
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            password: '', // Don't show password
            class_id: user.class_id || '',
            section_id: user.section_id || ''
        })
        setShowModal(true)
    }

    const handleSave = async () => {
        if (!formData.full_name || !formData.email) {
            alert('Please fill in name and email')
            return
        }

        if (!editingUser && !formData.password) {
            alert('Password is required for new users')
            return
        }

        setSaving(true)

        try {
            if (editingUser) {
                // Update existing user
                const updateData: any = {
                    full_name: formData.full_name,
                    role: formData.role,
                    class_id: formData.class_id || null,
                    section_id: formData.section_id || null
                }

                const { error } = await supabase
                    .from('users')
                    .update(updateData)
                    .eq('user_id', editingUser.user_id)

                if (error) throw error
                alert('User updated successfully!')
            } else {
                // Create new user via API route (uses admin API, bypasses email confirmation)
                const response = await fetch('/api/users/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: formData.email,
                        password: formData.password,
                        full_name: formData.full_name,
                        role: formData.role,
                        school_id: currentSchoolId,
                        class_id: formData.class_id || null,
                        section_id: formData.section_id || null
                    })
                })

                const data = await response.json()

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to create user')
                }

                alert(`User created successfully!\n\nEmail: ${formData.email}\nPassword: ${formData.password}\n\nUser can now login immediately.`)
            }

            setShowModal(false)
            loadData()
        } catch (error: any) {
            console.error('Error saving user:', error)
            alert('Error: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (userId: string) => {
        if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) {
            return
        }

        try {
            const { error } = await supabase
                .from('users')
                .delete()
                .eq('user_id', userId)

            if (error) throw error
            alert('User deleted successfully!')
            loadData()
        } catch (error: any) {
            console.error('Error deleting user:', error)
            alert('Failed to delete user: ' + error.message)
        }
    }

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'super_admin':
                return 'bg-red-100 text-red-800'
            case 'sub_admin':
                return 'bg-orange-100 text-orange-800'
            case 'teacher':
                return 'bg-blue-100 text-blue-800'
            case 'student':
                return 'bg-green-100 text-green-800'
            case 'parent':
                return 'bg-purple-100 text-purple-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    const formatRole = (role: string) => {
        return role.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ')
    }

    const getFilteredSections = () => {
        if (!formData.class_id) return []
        return sections.filter(s => s.class_id === formData.class_id)
    }

    if (loading && users.length === 0) {
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
                            onClick={() => router.push('/dashboard/manage')}
                            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>Back to Manage</span>
                        </button>
                        <h1 className="text-xl font-semibold text-gray-800">User Management</h1>
                        <div className="flex gap-2">
                            <button
                                onClick={() => router.push('/dashboard/manage/users/add')}
                                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all"
                            >
                                <UserPlus className="w-4 h-4" />
                                <span>Add User</span>
                            </button>
                            <button
                                onClick={() => router.push('/dashboard/manage/bulk-import')}
                                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Bulk Import</span>
                            </button>
                            <button
                                onClick={() => router.push('/dashboard/manage/users/invitations')}
                                className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
                            >
                                <span>Invitations</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Filters and Search */}
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by name or email..."
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                                />
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                            >
                                <option value="all">All Roles</option>
                                <option value="super_admin">Super Admin</option>
                                <option value="sub_admin">Sub Admin</option>
                                <option value="teacher">Teacher</option>
                                <option value="student">Student</option>
                                <option value="parent">Parent</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                        <div className="text-sm text-gray-600 mb-1">Total Users</div>
                        <div className="text-3xl font-bold text-gray-900">{users.length}</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                        <div className="text-sm text-gray-600 mb-1">Students</div>
                        <div className="text-3xl font-bold text-green-600">
                            {users.filter(u => u.role === 'student').length}
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                        <div className="text-sm text-gray-600 mb-1">Teachers</div>
                        <div className="text-3xl font-bold text-blue-600">
                            {users.filter(u => u.role === 'teacher').length}
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                        <div className="text-sm text-gray-600 mb-1">Parents</div>
                        <div className="text-3xl font-bold text-purple-600">
                            {users.filter(u => u.role === 'parent').length}
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
                        <div className="text-sm text-gray-600 mb-1">Admins</div>
                        <div className="text-3xl font-bold text-red-600">
                            {users.filter(u => u.role.includes('admin')).length}
                        </div>
                    </div>
                </div>

                {/* Users Table */}
                <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                    <table className="min-w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    User
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Role
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Email
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Class / Section
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Created
                                </th>
                                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredUsers.map(user => {
                                const userClass = classes.find(c => c.class_id === user.class_id)
                                const userSection = sections.find(s => s.section_id === user.section_id)
                                return (
                                    <tr key={user.user_id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div
                                                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                                                    style={{ backgroundColor: getRoleBadgeColor(user.role).includes('red') ? '#ef4444' : getRoleBadgeColor(user.role).includes('blue') ? '#3b82f6' : getRoleBadgeColor(user.role).includes('green') ? '#22c55e' : getRoleBadgeColor(user.role).includes('purple') ? '#a855f7' : '#f97316' }}
                                                >
                                                    {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="font-medium text-gray-900">{user.full_name}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                                                {formatRole(user.role)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {user.email}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {userClass ? `${userClass.name}${userSection ? ` - ${userSection.name}` : ''}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <button
                                                onClick={() => openEditModal(user)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Edit user"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user.user_id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete user"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>

                    {filteredUsers.length === 0 && (
                        <div className="text-center py-12">
                            <p className="text-gray-500">No users found</p>
                        </div>
                    )}
                </div>
            </main>

            {/* Add/Edit User Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingUser ? 'Edit User' : 'Add New User'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                                <input
                                    type="text"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData(f => ({ ...f, full_name: e.target.value }))}
                                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900"
                                    placeholder="John Doe"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))}
                                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900"
                                    placeholder="user@school.edu"
                                    disabled={!!editingUser}
                                />
                            </div>
                            {!editingUser && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={formData.password}
                                            onChange={(e) => setFormData(f => ({ ...f, password: e.target.value }))}
                                            className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 pr-10"
                                            placeholder="Min. 6 characters"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData(f => ({ ...f, role: e.target.value }))}
                                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white"
                                >
                                    <option value="student">Student</option>
                                    <option value="teacher">Teacher</option>
                                    <option value="parent">Parent</option>
                                    <option value="sub_admin">Sub Admin</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                            </div>
                            {(formData.role === 'student' || formData.role === 'teacher') && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                                        <select
                                            value={formData.class_id}
                                            onChange={(e) => setFormData(f => ({ ...f, class_id: e.target.value, section_id: '' }))}
                                            className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white"
                                        >
                                            <option value="">Select Class</option>
                                            {classes.map(c => (
                                                <option key={c.class_id} value={c.class_id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {formData.class_id && formData.role === 'student' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                                            <select
                                                value={formData.section_id}
                                                onChange={(e) => setFormData(f => ({ ...f, section_id: e.target.value }))}
                                                className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white"
                                            >
                                                <option value="">Select Section</option>
                                                {getFilteredSections().map(s => (
                                                    <option key={s.section_id} value={s.section_id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="p-6 border-t flex justify-end gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                                {editingUser ? 'Update User' : 'Create User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

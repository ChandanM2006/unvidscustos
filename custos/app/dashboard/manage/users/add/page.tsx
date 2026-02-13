'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, UserPlus, Mail, Phone, User, GraduationCap,
    Users, Send, Loader2, CheckCircle, X, ChevronDown
} from 'lucide-react'

interface ClassItem {
    class_id: string
    name: string
    grade_level: number
}

interface Section {
    section_id: string
    name: string
    class_id: string
}

export default function AddUserPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null)

    const [classes, setClasses] = useState<ClassItem[]>([])
    const [sections, setSections] = useState<Section[]>([])
    const [step, setStep] = useState(1)
    const [success, setSuccess] = useState(false)

    // Form data
    const [userType, setUserType] = useState<'student' | 'teacher' | 'parent' | 'sub_admin'>('student')

    const [formData, setFormData] = useState({
        // Basic Info
        full_name: '',
        email: '',
        phone: '',

        // Student specific
        class_id: '',
        section_id: '',

        // Parent info (for students)
        parent1_name: '',
        parent1_email: '',
        parent1_phone: '',
        parent1_relationship: 'father',

        parent2_name: '',
        parent2_email: '',
        parent2_phone: '',
        parent2_relationship: 'mother',

        // Invitation options
        send_email_invite: true,
        send_sms_invite: false
    })

    useEffect(() => {
        checkAuth()
    }, [])

    async function checkAuth() {
        try {
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
                router.push('/dashboard')
                return
            }

            setCurrentSchoolId(userData.school_id)

            // Load classes
            const { data: classesData } = await supabase
                .from('classes')
                .select('*')
                .eq('school_id', userData.school_id)
                .order('grade_level')

            setClasses(classesData || [])

            // Load sections
            const { data: sectionsData } = await supabase
                .from('sections')
                .select('*')
                .order('name')

            setSections(sectionsData || [])

        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit() {
        if (!formData.full_name) {
            alert('Please enter the name')
            return
        }

        if (!formData.email && !formData.phone) {
            alert('Please enter email or phone number')
            return
        }

        setSaving(true)

        try {
            // Try to use invitation system first
            const inviteData: any = {
                full_name: formData.full_name,
                email: formData.email || null,
                phone: formData.phone || null,
                role: userType,
                school_id: currentSchoolId,
                metadata: {},
                status: 'pending',
                invite_method: formData.send_email_invite ? 'email' : (formData.send_sms_invite ? 'sms' : 'email')
            }

            // Add role-specific data
            if (userType === 'student') {
                inviteData.metadata = {
                    class_id: formData.class_id || null,
                    section_id: formData.section_id || null
                }

                if (formData.parent1_name) {
                    inviteData.parent1_name = formData.parent1_name
                    inviteData.parent1_email = formData.parent1_email || null
                    inviteData.parent1_phone = formData.parent1_phone || null
                    inviteData.parent1_relationship = formData.parent1_relationship
                }

                if (formData.parent2_name) {
                    inviteData.parent2_name = formData.parent2_name
                    inviteData.parent2_email = formData.parent2_email || null
                    inviteData.parent2_phone = formData.parent2_phone || null
                    inviteData.parent2_relationship = formData.parent2_relationship
                }
            }

            // Try insert invitation
            const { data: invite, error: inviteError } = await supabase
                .from('user_invitations')
                .insert(inviteData)
                .select()
                .single()

            if (inviteError) {
                // Table doesn't exist or error - fall back to direct creation
                console.log('Invitation system not available, creating user directly...')
                await createUserDirectly()
                return
            }

            // Invitation created successfully - create parent invitations too
            if (userType === 'student' && formData.parent1_email) {
                await supabase.from('user_invitations').insert({
                    full_name: formData.parent1_name,
                    email: formData.parent1_email,
                    phone: formData.parent1_phone,
                    role: 'parent',
                    school_id: currentSchoolId,
                    metadata: { student_invite_id: invite.invite_id },
                    status: 'pending'
                })
            }

            if (userType === 'student' && formData.parent2_email) {
                await supabase.from('user_invitations').insert({
                    full_name: formData.parent2_name,
                    email: formData.parent2_email,
                    phone: formData.parent2_phone,
                    role: 'parent',
                    school_id: currentSchoolId,
                    metadata: { student_invite_id: invite.invite_id },
                    status: 'pending'
                })
            }

            await supabase
                .from('user_invitations')
                .update({ status: 'invited', invite_sent_at: new Date().toISOString() })
                .eq('invite_id', invite.invite_id)

            setSuccess(true)

        } catch (error: any) {
            console.error('Error with invitation system:', error)
            // Always fall back to direct user creation
            await createUserDirectly()
        } finally {
            setSaving(false)
        }
    }

    async function createUserDirectly() {
        // Fallback: Create user directly with a temporary password
        const tempPassword = Math.random().toString(36).slice(-8) + 'A1!'

        console.log('Creating user directly:', formData.full_name, formData.email)

        const response = await fetch('/api/users/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: formData.email,
                password: tempPassword,
                full_name: formData.full_name,
                role: userType,
                school_id: currentSchoolId,
                class_id: formData.class_id || null,
                section_id: formData.section_id || null
            })
        })

        const data = await response.json()
        console.log('Create user response:', data)

        if (!response.ok) {
            alert('Failed to create user: ' + (data.error || 'Unknown error'))
            setSaving(false)
            return
        }

        // If student has parents, create and link them
        if (userType === 'student' && formData.parent1_email && formData.parent1_name) {
            const parentPass = Math.random().toString(36).slice(-8) + 'A1!'
            console.log('Creating parent 1:', formData.parent1_name)

            const parentRes = await fetch('/api/users/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.parent1_email,
                    password: parentPass,
                    full_name: formData.parent1_name,
                    role: 'parent',
                    school_id: currentSchoolId
                })
            })

            if (parentRes.ok) {
                const parentData = await parentRes.json()
                console.log('Parent 1 created, linking to student...')
                // Link parent to student
                const { error: linkError } = await supabase.from('parent_student_links').insert({
                    parent_id: parentData.user.user_id,
                    student_id: data.user.user_id,
                    relationship: formData.parent1_relationship
                })
                if (linkError) console.error('Link error:', linkError)
            } else {
                console.log('Parent 1 creation failed')
            }
        }

        if (userType === 'student' && formData.parent2_email && formData.parent2_name) {
            const parentPass = Math.random().toString(36).slice(-8) + 'A1!'
            console.log('Creating parent 2:', formData.parent2_name)

            const parentRes = await fetch('/api/users/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.parent2_email,
                    password: parentPass,
                    full_name: formData.parent2_name,
                    role: 'parent',
                    school_id: currentSchoolId
                })
            })

            if (parentRes.ok) {
                const parentData = await parentRes.json()
                console.log('Parent 2 created, linking to student...')
                const { error: linkError } = await supabase.from('parent_student_links').insert({
                    parent_id: parentData.user.user_id,
                    student_id: data.user.user_id,
                    relationship: formData.parent2_relationship
                })
                if (linkError) console.error('Link error:', linkError)
            } else {
                console.log('Parent 2 creation failed')
            }
        }

        console.log('User created successfully!')
        setSuccess(true)
    }

    const filteredSections = sections.filter(s => s.class_id === formData.class_id)

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        )
    }

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">User Added Successfully!</h2>
                    <p className="text-gray-600 mb-6">
                        {userType === 'student' && formData.parent1_email
                            ? 'Student and parent accounts have been created. Invitations will be sent.'
                            : 'The user account has been created.'}
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                setSuccess(false)
                                setFormData({
                                    full_name: '', email: '', phone: '',
                                    class_id: '', section_id: '',
                                    parent1_name: '', parent1_email: '', parent1_phone: '', parent1_relationship: 'father',
                                    parent2_name: '', parent2_email: '', parent2_phone: '', parent2_relationship: 'mother',
                                    send_email_invite: true, send_sms_invite: false
                                })
                            }}
                            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                        >
                            Add Another
                        </button>
                        <button
                            onClick={() => router.push('/dashboard/manage/users')}
                            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"
                        >
                            View All Users
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/dashboard/manage/users')} className="p-2 hover:bg-gray-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Add New User</h1>
                            <p className="text-sm text-gray-500">Create user with invitation</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6">
                {/* User Type Selection */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Select User Type</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { type: 'student', label: 'Student', icon: GraduationCap, color: 'green' },
                            { type: 'teacher', label: 'Teacher', icon: User, color: 'blue' },
                            { type: 'parent', label: 'Parent', icon: Users, color: 'purple' },
                            { type: 'sub_admin', label: 'Sub Admin', icon: UserPlus, color: 'orange' }
                        ].map(({ type, label, icon: Icon, color }) => (
                            <button
                                key={type}
                                onClick={() => setUserType(type as any)}
                                className={`p-4 rounded-xl border-2 transition-all ${userType === type
                                    ? `border-${color}-500 bg-${color}-50`
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <Icon className={`w-8 h-8 mx-auto mb-2 ${userType === type ? `text-${color}-600` : 'text-gray-400'}`} />
                                <p className={`font-medium text-center ${userType === type ? `text-${color}-700` : 'text-gray-600'}`}>
                                    {label}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Basic Info */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-600" />
                        {userType.charAt(0).toUpperCase() + userType.slice(1)} Information
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                            <input
                                type="text"
                                value={formData.full_name}
                                onChange={(e) => setFormData(f => ({ ...f, full_name: e.target.value }))}
                                className="w-full p-3 border border-gray-300 rounded-lg text-gray-900"
                                placeholder="Enter full name"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))}
                                    className="w-full pl-10 p-3 border border-gray-300 rounded-lg text-gray-900"
                                    placeholder="user@email.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))}
                                    className="w-full pl-10 p-3 border border-gray-300 rounded-lg text-gray-900"
                                    placeholder="+91 9876543210"
                                />
                            </div>
                        </div>

                        {/* Student specific fields */}
                        {userType === 'student' && (
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
                                            <option key={c.class_id} value={c.class_id}>
                                                {c.name} (Grade {c.grade_level})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                                    <select
                                        value={formData.section_id}
                                        onChange={(e) => setFormData(f => ({ ...f, section_id: e.target.value }))}
                                        className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white"
                                        disabled={!formData.class_id}
                                    >
                                        <option value="">Select Section</option>
                                        {filteredSections.map(s => (
                                            <option key={s.section_id} value={s.section_id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Parent Info (for Students only) */}
                {userType === 'student' && (
                    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Users className="w-5 h-5 text-purple-600" />
                            Parent/Guardian Information
                        </h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Parents will receive an invitation to create their account and will be automatically linked to this student.
                        </p>

                        {/* Parent 1 */}
                        <div className="border border-gray-200 rounded-xl p-4 mb-4">
                            <h3 className="font-medium text-gray-800 mb-3">Parent/Guardian 1</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={formData.parent1_name}
                                        onChange={(e) => setFormData(f => ({ ...f, parent1_name: e.target.value }))}
                                        className="w-full p-3 border border-gray-300 rounded-lg text-gray-900"
                                        placeholder="Parent name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                                    <select
                                        value={formData.parent1_relationship}
                                        onChange={(e) => setFormData(f => ({ ...f, parent1_relationship: e.target.value }))}
                                        className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white"
                                    >
                                        <option value="father">Father</option>
                                        <option value="mother">Mother</option>
                                        <option value="guardian">Guardian</option>
                                        <option value="grandparent">Grandparent</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={formData.parent1_email}
                                        onChange={(e) => setFormData(f => ({ ...f, parent1_email: e.target.value }))}
                                        className="w-full p-3 border border-gray-300 rounded-lg text-gray-900"
                                        placeholder="parent@email.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                    <input
                                        type="tel"
                                        value={formData.parent1_phone}
                                        onChange={(e) => setFormData(f => ({ ...f, parent1_phone: e.target.value }))}
                                        className="w-full p-3 border border-gray-300 rounded-lg text-gray-900"
                                        placeholder="+91 9876543210"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Parent 2 */}
                        <div className="border border-gray-200 rounded-xl p-4">
                            <h3 className="font-medium text-gray-800 mb-3">Parent/Guardian 2 (Optional)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={formData.parent2_name}
                                        onChange={(e) => setFormData(f => ({ ...f, parent2_name: e.target.value }))}
                                        className="w-full p-3 border border-gray-300 rounded-lg text-gray-900"
                                        placeholder="Parent name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                                    <select
                                        value={formData.parent2_relationship}
                                        onChange={(e) => setFormData(f => ({ ...f, parent2_relationship: e.target.value }))}
                                        className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white"
                                    >
                                        <option value="mother">Mother</option>
                                        <option value="father">Father</option>
                                        <option value="guardian">Guardian</option>
                                        <option value="grandparent">Grandparent</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={formData.parent2_email}
                                        onChange={(e) => setFormData(f => ({ ...f, parent2_email: e.target.value }))}
                                        className="w-full p-3 border border-gray-300 rounded-lg text-gray-900"
                                        placeholder="parent@email.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                    <input
                                        type="tel"
                                        value={formData.parent2_phone}
                                        onChange={(e) => setFormData(f => ({ ...f, parent2_phone: e.target.value }))}
                                        className="w-full p-3 border border-gray-300 rounded-lg text-gray-900"
                                        placeholder="+91 9876543210"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Submit */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-medium text-gray-900">Ready to add user?</h3>
                            <p className="text-sm text-gray-500">
                                {userType === 'student' && formData.parent1_name
                                    ? 'Student and parent accounts will be created and linked.'
                                    : 'User will be created and can login immediately.'}
                            </p>
                        </div>
                        <button
                            onClick={handleSubmit}
                            disabled={saving || !formData.full_name}
                            className="px-8 py-3 bg-blue-600 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
                        >
                            {saving ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <UserPlus className="w-5 h-5" />
                            )}
                            Add User
                        </button>
                    </div>
                </div>
            </main>
        </div>
    )
}

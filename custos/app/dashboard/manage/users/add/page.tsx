'use client'

import { useState, useEffect } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, UserPlus, Mail, Phone, User, GraduationCap,
    Users, Send, Loader2, CheckCircle, X, ChevronDown, Hash, Search
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

interface StudentItem {
    user_id: string
    full_name: string
    email: string | null
    class_name?: string
    section_name?: string
}

export default function AddUserPage() {
    const { goBack, router } = useSmartBack('/dashboard/manage/users')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null)

    const [classes, setClasses] = useState<ClassItem[]>([])
    const [sections, setSections] = useState<Section[]>([])
    const [students, setStudents] = useState<StudentItem[]>([])
    const [step, setStep] = useState(1)
    const [success, setSuccess] = useState(false)

    // Form data
    const [userType, setUserType] = useState<'student' | 'teacher' | 'parent' | 'sub_admin'>('student')

    const [formData, setFormData] = useState({
        // Basic Info
        full_name: '',
        email: '',
        phone: '',
        roll_number: '',

        // Student specific
        class_id: '',
        section_id: '',

        // Parent-specific: link to child
        linked_student_id: '',
        parent_relationship: 'father',

        // Invitation options
        send_email_invite: true,
        send_sms_invite: false
    })
    const [studentSearch, setStudentSearch] = useState('')

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
                router.replace('/dashboard/redirect')
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

            // Load sections filtered to this school's classes
            const classIds = (classesData || []).map((c: any) => c.class_id)
            let loadedSections: any[] = []
            if (classIds.length > 0) {
                const { data: sectionsData } = await supabase
                    .from('sections')
                    .select('*')
                    .in('class_id', classIds)
                    .order('name')

                loadedSections = sectionsData || []
            }
            setSections(loadedSections)

            // Load students (for parent linking)
            const { data: studentsData, error: studentsError } = await supabase
                .from('users')
                .select('user_id, full_name, email, class_id, section_id')
                .eq('school_id', userData.school_id)
                .eq('role', 'student')
                .order('full_name')

            console.log('[AddUser] Students loaded:', studentsData?.length, 'school_id:', userData.school_id)
            if (studentsError) console.error('[AddUser] Students load error:', studentsError.message)

            // Enrich with class/section names
            const enrichedStudents: StudentItem[] = (studentsData || []).map((s: any) => {
                const cls = classesData?.find((c: any) => c.class_id === s.class_id)
                const sec = loadedSections?.find((sec: any) => sec.section_id === s.section_id)
                return {
                    user_id: s.user_id,
                    full_name: s.full_name,
                    email: s.email,
                    class_name: cls?.name || '',
                    section_name: sec?.name || ''
                }
            })
            setStudents(enrichedStudents)

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

        if (!formData.email) {
            alert('Please enter an email address')
            return
        }

        if (userType === 'student' && !formData.roll_number) {
            alert('Please enter a Roll Number for the student')
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
                metadata: userType === 'parent' && formData.linked_student_id
                    ? { student_id: formData.linked_student_id, relationship: formData.parent_relationship }
                    : {},
                status: 'pending',
                invite_method: formData.send_email_invite ? 'email' : (formData.send_sms_invite ? 'sms' : 'email')
            }

            // Add role-specific data
            if (userType === 'student') {
                inviteData.metadata = {
                    class_id: formData.class_id || null,
                    section_id: formData.section_id || null,
                    roll_number: formData.roll_number || null
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


            await supabase
                .from('user_invitations')
                .update({ status: 'invited', invite_sent_at: new Date().toISOString() })
                .eq('invite_id', invite.invite_id)

            // Parent-child link is handled server-side in /api/users/create
            // (metadata.student_id is passed via invite → join page → API)


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

        // If parent with student link, pass student_id to API so it links server-side (bypasses RLS)
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
                section_id: formData.section_id || null,
                roll_number: userType === 'student' ? (formData.roll_number || null) : null,
                student_id: userType === 'parent' && formData.linked_student_id ? formData.linked_student_id : null
            })
        })

        const data = await response.json()
        console.log('Create user response:', data)

        if (!response.ok) {
            alert('Failed to create user: ' + (data.error || 'Unknown error'))
            setSaving(false)
            return
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
                        The user account has been created successfully.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                setSuccess(false)
                                setFormData({
                                    full_name: '', email: '', phone: '', roll_number: '',
                                    class_id: '', section_id: '',
                                    linked_student_id: '', parent_relationship: 'father',
                                    send_email_invite: true, send_sms_invite: false
                                })
                                setStudentSearch('')
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

                        {/* Show Roll No for students, Phone for others */}
                        {userType === 'student' ? (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Roll No *</label>
                                <div className="relative">
                                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={formData.roll_number}
                                        onChange={(e) => setFormData(f => ({ ...f, roll_number: e.target.value }))}
                                        className="w-full pl-10 p-3 border border-gray-300 rounded-lg text-gray-900"
                                        placeholder="e.g. 2024001"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Student's unique identification number</p>
                            </div>
                        ) : (
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
                        )}

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

                {/* Link to Student (for Parents only) */}
                {userType === 'parent' && (
                    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <GraduationCap className="w-5 h-5 text-green-600" />
                            Link to Child (Student)
                        </h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Select the student this parent should be linked to. You can link more students later from the user management page.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                                <select
                                    value={formData.parent_relationship}
                                    onChange={(e) => setFormData(f => ({ ...f, parent_relationship: e.target.value }))}
                                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white"
                                >
                                    <option value="father">Father</option>
                                    <option value="mother">Mother</option>
                                    <option value="guardian">Guardian</option>
                                    <option value="grandparent">Grandparent</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>

                        {/* Selected student chip - shown when a student is linked */}
                        {formData.linked_student_id ? (
                            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl mb-3">
                                <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center text-green-800 font-bold">
                                    {students.find(s => s.user_id === formData.linked_student_id)?.full_name.charAt(0) || '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-green-900">
                                        {students.find(s => s.user_id === formData.linked_student_id)?.full_name}
                                    </p>
                                    <p className="text-xs text-green-700">
                                        {(() => {
                                            const s = students.find(s => s.user_id === formData.linked_student_id)
                                            return s ? [s.class_name, s.section_name].filter(Boolean).join(' - ') || 'No class assigned' : ''
                                        })()}
                                    </p>
                                </div>
                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                <button
                                    onClick={() => {
                                        setFormData(f => ({ ...f, linked_student_id: '' }))
                                        setStudentSearch('')
                                    }}
                                    className="p-1 text-green-600 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Remove link"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            /* Autocomplete search input */
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Search Student</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={studentSearch}
                                        onChange={(e) => setStudentSearch(e.target.value)}
                                        className="w-full pl-10 p-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        placeholder="Start typing student name..."
                                        autoComplete="off"
                                    />
                                    {studentSearch && (
                                        <button
                                            onClick={() => setStudentSearch('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Dropdown results - only show when typing */}
                                {studentSearch.length >= 1 && (
                                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                        {students
                                            .filter(s =>
                                                s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                                                (s.email && s.email.toLowerCase().includes(studentSearch.toLowerCase()))
                                            )
                                            .slice(0, 10)
                                            .map(student => (
                                                <button
                                                    key={student.user_id}
                                                    onClick={() => {
                                                        setFormData(f => ({ ...f, linked_student_id: student.user_id }))
                                                        setStudentSearch('')
                                                    }}
                                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-green-50 transition-colors border-b border-gray-50 last:border-b-0"
                                                >
                                                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">
                                                        {student.full_name.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-gray-900 truncate">{student.full_name}</p>
                                                        <p className="text-xs text-gray-500 truncate">
                                                            {[student.class_name, student.section_name].filter(Boolean).join(' - ') || 'No class assigned'}
                                                            {student.email ? ` • ${student.email}` : ''}
                                                        </p>
                                                    </div>
                                                    <ChevronDown className="w-4 h-4 text-gray-300 -rotate-90" />
                                                </button>
                                            ))}
                                        {students.filter(s =>
                                            s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                                            (s.email && s.email.toLowerCase().includes(studentSearch.toLowerCase()))
                                        ).length === 0 && (
                                                <div className="px-4 py-6 text-center">
                                                    <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                                    <p className="text-sm text-gray-500">No students match "{studentSearch}"</p>
                                                    <p className="text-xs text-gray-400 mt-1">Make sure students have been added to this school first.</p>
                                                </div>
                                            )}
                                    </div>
                                )}

                                {/* Helper text */}
                                {!studentSearch && students.length > 0 && (
                                    <p className="text-xs text-gray-400 mt-1.5">
                                        {students.length} student{students.length !== 1 ? 's' : ''} available. Type to search.
                                    </p>
                                )}
                                {students.length === 0 && (
                                    <p className="text-xs text-amber-600 mt-1.5">
                                        ⚠ No students found in this school. Please add students first.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Submit */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-medium text-gray-900">Ready to add user?</h3>
                            <p className="text-sm text-gray-500">
                                User will be created and can login immediately.
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

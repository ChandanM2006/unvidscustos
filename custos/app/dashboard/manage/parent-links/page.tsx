'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Users, Link2, Search, Plus, Trash2, Loader2,
    UserPlus, CheckCircle, X, AlertCircle
} from 'lucide-react'

interface Parent {
    user_id: string
    full_name: string
    email: string
    phone?: string
    linked_students: Student[]
}

interface Student {
    user_id: string
    full_name: string
    email: string
    class_id?: string
    class_name?: string
}

export default function ParentStudentLinkingPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [parents, setParents] = useState<Parent[]>([])
    const [allStudents, setAllStudents] = useState<Student[]>([])
    const [searchQuery, setSearchQuery] = useState('')

    // Modal state
    const [showModal, setShowModal] = useState(false)
    const [selectedParent, setSelectedParent] = useState<Parent | null>(null)
    const [studentSearch, setStudentSearch] = useState('')

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            // Check admin role
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
                router.push('/dashboard')
                return
            }

            // Load all parents
            const { data: parentsData } = await supabase
                .from('users')
                .select('user_id, full_name, email, phone')
                .eq('role', 'parent')
                .eq('school_id', userData.school_id)
                .order('full_name')

            // Load all students
            const { data: studentsData } = await supabase
                .from('users')
                .select('user_id, full_name, email, class_id, classes(name)')
                .eq('role', 'student')
                .eq('school_id', userData.school_id)
                .order('full_name')

            const students = (studentsData || []).map((s: any) => ({
                ...s,
                class_name: s.classes?.name
            }))
            setAllStudents(students)

            // Load parent-student links
            const { data: linksData } = await supabase
                .from('parent_student_links')
                .select('parent_id, student_id')

            // Organize data
            const parentsWithLinks = (parentsData || []).map(parent => {
                const linkedStudentIds = (linksData || [])
                    .filter(link => link.parent_id === parent.user_id)
                    .map(link => link.student_id)

                const linkedStudents = students.filter(s => linkedStudentIds.includes(s.user_id))

                return {
                    ...parent,
                    linked_students: linkedStudents
                }
            })

            setParents(parentsWithLinks)
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    async function linkStudent(parentId: string, studentId: string) {
        setSaving(true)
        try {
            const { error } = await supabase
                .from('parent_student_links')
                .insert({
                    parent_id: parentId,
                    student_id: studentId,
                    relationship: 'parent'
                })

            if (error) throw error

            // Refresh data
            await loadData()
            alert('Student linked successfully!')
        } catch (error: any) {
            console.error('Error linking:', error)
            alert('Error: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    async function unlinkStudent(parentId: string, studentId: string) {
        if (!confirm('Are you sure you want to remove this link?')) return

        try {
            const { error } = await supabase
                .from('parent_student_links')
                .delete()
                .eq('parent_id', parentId)
                .eq('student_id', studentId)

            if (error) throw error

            // Refresh data
            await loadData()
        } catch (error: any) {
            console.error('Error unlinking:', error)
            alert('Error: ' + error.message)
        }
    }

    function openLinkModal(parent: Parent) {
        setSelectedParent(parent)
        setStudentSearch('')
        setShowModal(true)
    }

    const filteredParents = parents.filter(p =>
        p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.email.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const availableStudents = allStudents.filter(s =>
        !selectedParent?.linked_students.some(ls => ls.user_id === s.user_id) &&
        (s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
            s.email.toLowerCase().includes(studentSearch.toLowerCase()))
    )

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
                <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Header */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/dashboard/manage')} className="p-2 hover:bg-white/10 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-purple-300" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-white flex items-center gap-2">
                                <Link2 className="w-6 h-6 text-purple-400" />
                                Parent-Student Linking
                            </h1>
                            <p className="text-sm text-purple-300/70">Connect parents to their children's accounts</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-white font-medium">{parents.length} Parents</p>
                        <p className="text-sm text-purple-300/70">{allStudents.length} Students</p>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6">
                {/* Search */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-4 mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300/50" />
                        <input
                            type="text"
                            placeholder="Search parents by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50"
                        />
                    </div>
                </div>

                {/* Parents List */}
                {parents.length === 0 ? (
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-12 text-center">
                        <Users className="w-16 h-16 mx-auto mb-4 text-purple-300/50" />
                        <h3 className="text-xl font-bold text-white mb-2">No Parents Found</h3>
                        <p className="text-purple-300/70">Create parent accounts first in User Management</p>
                        <button
                            onClick={() => router.push('/dashboard/manage/users')}
                            className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-xl font-medium"
                        >
                            Go to User Management
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredParents.map(parent => (
                            <div
                                key={parent.user_id}
                                className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-6"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                                            {parent.full_name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white">{parent.full_name}</h3>
                                            <p className="text-sm text-purple-300/70">{parent.email}</p>
                                            {parent.phone && (
                                                <p className="text-sm text-purple-300/70">{parent.phone}</p>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => openLinkModal(parent)}
                                        className="px-4 py-2 bg-purple-600 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-purple-700"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        Link Student
                                    </button>
                                </div>

                                {/* Linked Students */}
                                <div className="mt-4 pt-4 border-t border-white/10">
                                    <p className="text-sm text-purple-300/70 mb-3">
                                        Linked Children ({parent.linked_students.length})
                                    </p>
                                    {parent.linked_students.length === 0 ? (
                                        <div className="flex items-center gap-2 text-yellow-400/70">
                                            <AlertCircle className="w-4 h-4" />
                                            <span className="text-sm">No students linked yet</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {parent.linked_students.map(student => (
                                                <div
                                                    key={student.user_id}
                                                    className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-green-500/30 flex items-center justify-center">
                                                        <span className="text-green-400 font-bold text-sm">
                                                            {student.full_name.charAt(0)}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-white">{student.full_name}</p>
                                                        {student.class_name && (
                                                            <p className="text-xs text-purple-300/70">{student.class_name}</p>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => unlinkStudent(parent.user_id, student.user_id)}
                                                        className="ml-2 p-1 text-red-400 hover:bg-red-500/20 rounded"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Link Student Modal */}
            {showModal && selectedParent && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-white">Link Student</h2>
                                <p className="text-sm text-purple-300/70">to {selectedParent.full_name}</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>

                        <div className="p-4 border-b border-white/10">
                            <input
                                type="text"
                                placeholder="Search students..."
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50"
                            />
                        </div>

                        <div className="max-h-80 overflow-y-auto p-4 space-y-2">
                            {availableStudents.length === 0 ? (
                                <p className="text-center text-purple-300/70 py-8">No students available to link</p>
                            ) : (
                                availableStudents.map(student => (
                                    <div
                                        key={student.user_id}
                                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-green-500/30 flex items-center justify-center">
                                                <span className="text-green-400 font-bold">{student.full_name.charAt(0)}</span>
                                            </div>
                                            <div>
                                                <p className="font-medium text-white">{student.full_name}</p>
                                                <p className="text-sm text-purple-300/70">
                                                    {student.class_name || 'No class'} • {student.email}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                linkStudent(selectedParent.user_id, student.user_id)
                                                setShowModal(false)
                                            }}
                                            disabled={saving}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                                        >
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Link'}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

'use client'

import { useState, useEffect } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, ArrowUpCircle, Users, CheckCircle, XCircle,
    AlertTriangle, ChevronRight, Loader2, RefreshCw, GraduationCap,
    ArrowRightCircle, Filter, Search
} from 'lucide-react'

interface Student {
    user_id: string
    full_name: string
    email: string
    class_id: string
    section_id: string
    roll_number?: string
}

interface ClassItem {
    class_id: string
    name: string
    grade_level: number
}

interface AcademicYear {
    year_id: string
    year_name: string
    is_current: boolean
}

interface PromotionCandidate extends Student {
    selected: boolean
    action: 'promote' | 'retain' | null
    final_percentage?: number
    remarks?: string
}

export default function StudentPromotionPage() {
    const { goBack, router } = useSmartBack('/dashboard/manage')

    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)

    // Data
    const [classes, setClasses] = useState<ClassItem[]>([])
    const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
    const [students, setStudents] = useState<PromotionCandidate[]>([])

    // Selection
    const [fromYearId, setFromYearId] = useState('')
    const [toYearId, setToYearId] = useState('')
    const [fromClassId, setFromClassId] = useState('')
    const [toClassId, setToClassId] = useState('')

    // Stats
    const [stats, setStats] = useState({ total: 0, toPromote: 0, toRetain: 0 })

    // Search
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        loadInitialData()
    }, [])

    useEffect(() => {
        if (fromClassId && fromYearId) {
            loadStudents()
        }
    }, [fromClassId, fromYearId])

    useEffect(() => {
        // Calculate stats
        const toPromote = students.filter(s => s.action === 'promote').length
        const toRetain = students.filter(s => s.action === 'retain').length
        setStats({ total: students.length, toPromote, toRetain })
    }, [students])

    async function loadInitialData() {
        try {
            // Check role - only admins can access promotions
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

            // Load classes for this school
            const { data: classData } = await supabase
                .from('classes')
                .select('*')
                .eq('school_id', userData.school_id)
                .order('grade_level', { ascending: true })
            setClasses(classData || [])

            // Load academic years for this school
            const { data: yearData } = await supabase
                .from('academic_years')
                .select('*')
                .eq('school_id', userData.school_id)
                .order('created_at', { ascending: false })
            setAcademicYears(yearData || [])

            // Auto-select current year as "from"
            const currentYear = yearData?.find(y => y.is_current)
            if (currentYear) setFromYearId(currentYear.year_id)

        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadStudents() {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('role', 'student')
                .eq('class_id', fromClassId)
                .order('full_name', { ascending: true })

            if (error) throw error

            // Transform to promotion candidates
            const candidates: PromotionCandidate[] = (data || []).map(s => ({
                ...s,
                selected: true,
                action: 'promote' as const,
                final_percentage: undefined,
                remarks: ''
            }))

            setStudents(candidates)
        } catch (error) {
            console.error('Error loading students:', error)
        }
    }

    function toggleStudentAction(userId: string, action: 'promote' | 'retain') {
        setStudents(prev => prev.map(s =>
            s.user_id === userId
                ? { ...s, action: s.action === action ? null : action }
                : s
        ))
    }

    function selectAll(action: 'promote' | 'retain') {
        setStudents(prev => prev.map(s => ({ ...s, action })))
    }

    async function executePromotion() {
        if (!toClassId || !toYearId) {
            alert('Please select target class and academic year')
            return
        }

        const toPromote = students.filter(s => s.action === 'promote')
        const toRetain = students.filter(s => s.action === 'retain')

        if (toPromote.length === 0 && toRetain.length === 0) {
            alert('Please select students to promote or retain')
            return
        }

        if (!confirm(`Confirm promotion:\n• ${toPromote.length} students will be PROMOTED to next class\n• ${toRetain.length} students will be RETAINED\n\nThis action cannot be easily undone.`)) {
            return
        }

        setProcessing(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()

            // 1. Create promotion batch record
            const { data: batch, error: batchError } = await supabase
                .from('promotion_batches')
                .insert({
                    from_year_id: fromYearId,
                    to_year_id: toYearId,
                    from_class_id: fromClassId,
                    to_class_id: toClassId,
                    total_students: students.length,
                    promoted_count: toPromote.length,
                    retained_count: toRetain.length,
                    status: 'in_progress',
                    initiated_by: user?.id
                })
                .select()
                .single()

            if (batchError) throw batchError

            // 2. Update promoted students' class
            for (const student of toPromote) {
                // Update user record
                await supabase
                    .from('users')
                    .update({ class_id: toClassId })
                    .eq('user_id', student.user_id)

                // Create history record
                await supabase
                    .from('student_academic_history')
                    .insert({
                        student_id: student.user_id,
                        academic_year_id: fromYearId,
                        class_id: fromClassId,
                        promotion_status: 'promoted',
                        final_percentage: student.final_percentage,
                        teacher_remarks: student.remarks,
                        promoted_at: new Date().toISOString(),
                        promoted_by: user?.id
                    })
            }

            // 3. Record retained students
            for (const student of toRetain) {
                await supabase
                    .from('student_academic_history')
                    .insert({
                        student_id: student.user_id,
                        academic_year_id: fromYearId,
                        class_id: fromClassId,
                        promotion_status: 'retained',
                        final_percentage: student.final_percentage,
                        teacher_remarks: student.remarks,
                        promoted_at: new Date().toISOString(),
                        promoted_by: user?.id
                    })
            }

            // 4. Mark batch as completed
            await supabase
                .from('promotion_batches')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('batch_id', batch.batch_id)

            alert(`Promotion completed successfully!\n• ${toPromote.length} promoted\n• ${toRetain.length} retained`)

            // Reload students
            loadStudents()

        } catch (error: any) {
            console.error('Promotion error:', error)
            alert('Error during promotion: ' + error.message)
        } finally {
            setProcessing(false)
        }
    }

    const filteredStudents = students.filter(s =>
        s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const getNextClass = (currentClassId: string): ClassItem | undefined => {
        const currentClass = classes.find(c => c.class_id === currentClassId)
        if (!currentClass) return undefined
        return classes.find(c => c.grade_level === currentClass.grade_level + 1)
    }

    // Auto-suggest next class
    useEffect(() => {
        if (fromClassId) {
            const nextClass = getNextClass(fromClassId)
            if (nextClass) setToClassId(nextClass.class_id)
        }
    }, [fromClassId])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8">
            <div className="max-w-7xl mx-auto">
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
                            <h1 className="text-3xl font-bold text-gray-900">Student Promotion</h1>
                            <p className="text-gray-600">Promote or retain students for the new academic year</p>
                        </div>
                    </div>
                    <GraduationCap className="w-12 h-12 text-indigo-600" />
                </div>

                {/* Configuration */}
                <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Promotion Configuration</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* From Year */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">From Academic Year</label>
                            <select
                                value={fromYearId}
                                onChange={(e) => setFromYearId(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white"
                            >
                                <option value="">Select Year</option>
                                {academicYears.map(y => (
                                    <option key={y.year_id} value={y.year_id}>
                                        {y.year_name} {y.is_current && '(Current)'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* From Class */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">From Class</label>
                            <select
                                value={fromClassId}
                                onChange={(e) => setFromClassId(e.target.value)}
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

                        {/* To Year */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">To Academic Year</label>
                            {academicYears.filter(y => y.year_id !== fromYearId).length === 0 ? (
                                <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
                                    <p className="text-sm text-yellow-800 mb-2">No target year available</p>
                                    <button
                                        onClick={() => router.push('/dashboard/manage/academic-years')}
                                        className="text-sm text-indigo-600 font-medium hover:underline"
                                    >
                                        + Create Next Academic Year
                                    </button>
                                </div>
                            ) : (
                                <select
                                    value={toYearId}
                                    onChange={(e) => setToYearId(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white"
                                >
                                    <option value="">Select Year</option>
                                    {academicYears.filter(y => y.year_id !== fromYearId).map(y => (
                                        <option key={y.year_id} value={y.year_id}>
                                            {y.year_name}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* To Class */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">To Class</label>
                            <select
                                value={toClassId}
                                onChange={(e) => setToClassId(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white"
                            >
                                <option value="">Select Class</option>
                                {classes.filter(c => c.class_id !== fromClassId).map(c => (
                                    <option key={c.class_id} value={c.class_id}>
                                        {c.name} (Grade {c.grade_level})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-xl shadow-lg p-6 text-center">
                        <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                        <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                        <p className="text-sm text-gray-500">Total Students</p>
                    </div>
                    <div className="bg-green-50 rounded-xl shadow-lg p-6 text-center border-2 border-green-200">
                        <ArrowUpCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                        <p className="text-3xl font-bold text-green-700">{stats.toPromote}</p>
                        <p className="text-sm text-green-600">To Promote</p>
                    </div>
                    <div className="bg-yellow-50 rounded-xl shadow-lg p-6 text-center border-2 border-yellow-200">
                        <AlertTriangle className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                        <p className="text-3xl font-bold text-yellow-700">{stats.toRetain}</p>
                        <p className="text-sm text-yellow-600">To Retain</p>
                    </div>
                </div>

                {/* Student List */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <h2 className="text-lg font-bold text-gray-900">Students</h2>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search students..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => selectAll('promote')}
                                className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200"
                            >
                                Promote All
                            </button>
                            <button
                                onClick={() => selectAll('retain')}
                                className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-200"
                            >
                                Retain All
                            </button>
                        </div>
                    </div>

                    {students.length === 0 ? (
                        <div className="p-12 text-center">
                            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">No students found</p>
                            <p className="text-sm text-gray-400">Select a class to view students</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                            {filteredStudents.map(student => (
                                <div key={student.user_id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                            <span className="text-indigo-700 font-bold">
                                                {student.full_name.charAt(0)}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{student.full_name}</p>
                                            <p className="text-sm text-gray-500">{student.email}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => toggleStudentAction(student.user_id, 'promote')}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${student.action === 'promote'
                                                ? 'bg-green-600 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-green-100'
                                                }`}
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                            Promote
                                        </button>
                                        <button
                                            onClick={() => toggleStudentAction(student.user_id, 'retain')}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${student.action === 'retain'
                                                ? 'bg-yellow-500 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-yellow-100'
                                                }`}
                                        >
                                            <AlertTriangle className="w-4 h-4" />
                                            Retain
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Action Footer */}
                    <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
                        <button
                            onClick={executePromotion}
                            disabled={processing || (stats.toPromote === 0 && stats.toRetain === 0)}
                            className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold flex items-center gap-2 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <ArrowRightCircle className="w-5 h-5" />
                                    Execute Promotion
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

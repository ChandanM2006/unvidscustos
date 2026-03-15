'use client'

import { useState, useEffect } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Calendar, BookOpen, Clock, MoreVertical, Layers, GraduationCap } from 'lucide-react'

interface LessonPlan {
    plan_id: string
    document_id: string
    class_id: string
    start_date: string
    end_date: string
    status: 'draft' | 'published' | 'in_progress' | 'completed'
    syllabus_documents: {
        chapter_title: string
        subject_id: string
        subjects: {
            name: string
        }
    }
}

interface ClassItem {
    class_id: string
    name: string
    grade_level: number
}

interface Section {
    section_id: string
    name: string
}

interface Subject {
    subject_id: string
    name: string
}

export default function LessonPlansListPage() {
    const { router } = useSmartBack('/dashboard/manage')
    
    // User Context
    const [loading, setLoading] = useState(true)
    const [schoolId, setSchoolId] = useState<string | null>(null)
    const [isTeacher, setIsTeacher] = useState(false)
    const [userId, setUserId] = useState<string | null>(null)

    // Data
    const [classes, setClasses] = useState<ClassItem[]>([])
    const [sections, setSections] = useState<Section[]>([])
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [plans, setPlans] = useState<LessonPlan[]>([])
    const [plansLoading, setPlansLoading] = useState(false)

    // Selection
    const [selectedClassId, setSelectedClassId] = useState('')
    const [selectedSectionId, setSelectedSectionId] = useState('')
    const [selectedSubjectId, setSelectedSubjectId] = useState('')

    useEffect(() => {
        initPage()
    }, [])

    async function initPage() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }
            setUserId(session.user.id)

            const { data: userData } = await supabase
                .from('users')
                .select('role, school_id')
                .eq('email', session.user.email)
                .single()

            if (!userData || !['super_admin', 'sub_admin', 'teacher'].includes(userData.role)) {
                alert('You do not have permission to access this page.')
                router.replace('/dashboard/redirect')
                return
            }

            setSchoolId(userData.school_id)
            setIsTeacher(userData.role === 'teacher')

            // Load initial classes based on role
            await loadClasses(userData.school_id, userData.role === 'teacher' ? session.user.id : null)

        } catch (error: any) {
            console.error('Error initializing:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadClasses(schoolId: string, teacherId: string | null) {
        if (!schoolId) return
        
        let query = supabase.from('classes').select('class_id, name, grade_level').eq('school_id', schoolId)
        
        if (teacherId) {
            // If teacher, maybe they want to see only their assigned classes
            // For now let's just show all classes or filter via timetable
            // To keep it robust, we'll fetch all classes for the school and they can filter
            // Or we could fetch from timetable. Let's fetch all classes for the school.
        }

        const { data } = await query.order('grade_level', { ascending: true })
        setClasses(data || [])
    }

    // Effect for Class Selection
    useEffect(() => {
        setSelectedSectionId('')
        setSelectedSubjectId('')
        setSections([])
        setSubjects([])
        setPlans([])
        
        if (selectedClassId) {
            loadSections(selectedClassId)
        }
    }, [selectedClassId])

    // Effect for Section Selection
    useEffect(() => {
        setSelectedSubjectId('')
        setSubjects([])
        setPlans([])
        
        if (selectedClassId && selectedSectionId) {
            loadSubjects(selectedClassId, selectedSectionId)
        }
    }, [selectedSectionId])

    // Effect for Subject Selection
    useEffect(() => {
        if (selectedClassId && selectedSubjectId) {
            loadPlans(selectedClassId, selectedSubjectId)
        } else {
            setPlans([])
        }
    }, [selectedSubjectId])

    async function loadSections(classId: string) {
        if (!classId) return
        const { data } = await supabase
            .from('sections')
            .select('*')
            .eq('class_id', classId)
            .order('name', { ascending: true })
        
        setSections(data || [])
    }

    async function loadSubjects(classId: string, sectionId: string) {
        if (!schoolId) return
        
        // Load subjects. If admin, maybe all subjects for that school.
        // If teacher, the ones they teach? The prompt says "they should select class section then subject"
        // Let's load all subjects for the school for simplicity or join with syllabus_documents to ensure they have plans
        const { data } = await supabase
            .from('subjects')
            .select('subject_id, name')
            .eq('school_id', schoolId)
            .order('name', { ascending: true })

        setSubjects(data || [])
    }

    async function loadPlans(classId: string, subjectId: string) {
        setPlansLoading(true)
        try {
            // Find document IDs for the selected subject
            const { data: docs } = await supabase
                .from('syllabus_documents')
                .select('document_id')
                .eq('subject_id', subjectId)
                
            const docIds = docs?.map(d => d.document_id) || []
            
            if (docIds.length === 0) {
                setPlans([])
                return
            }

            const { data, error } = await supabase
                .from('lesson_plans')
                .select(`
                    *,
                    syllabus_documents!inner (
                        chapter_title,
                        subject_id,
                        subjects (name)
                    )
                `)
                .eq('class_id', classId)
                .in('document_id', docIds)
                // The one created 1st at top
                .order('created_at', { ascending: true })

            if (error) throw error
            setPlans(data || [])
        } catch (error: any) {
            console.error('Error loading plans:', error)
        } finally {
            setPlansLoading(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'published': return 'bg-green-100 text-green-800'
            case 'in_progress': return 'bg-blue-100 text-blue-800'
            case 'completed': return 'bg-gray-100 text-gray-800'
            default: return 'bg-yellow-100 text-yellow-800'
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Lesson Plans</h1>
                        <p className="text-gray-600">AI-generated schedules and curriculum planning</p>
                    </div>
                    {isTeacher && (
                        <button
                            onClick={() => router.push('/dashboard/manage/lesson-plans/create')}
                            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-semibold"
                        >
                            <Plus className="w-5 h-5" />
                            Create New Plan
                        </button>
                    )}
                </div>

                {/* Filters */}
                <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
                    <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
                        <GraduationCap className="w-4 h-4 text-purple-500" />
                        Select Class, Section &amp; Subject
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Class Selection */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Class</label>
                            <select
                                value={selectedClassId}
                                onChange={e => setSelectedClassId(e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-purple-300 outline-none"
                            >
                                <option value="">Select Class</option>
                                {classes.map(c => (
                                    <option key={c.class_id} value={c.class_id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Section Selection */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Section</label>
                            <select
                                value={selectedSectionId}
                                onChange={e => setSelectedSectionId(e.target.value)}
                                disabled={!selectedClassId}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-purple-300 outline-none disabled:opacity-50"
                            >
                                <option value="">Select Section</option>
                                {sections.map(s => (
                                    <option key={s.section_id} value={s.section_id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Subject Selection */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
                            <select
                                value={selectedSubjectId}
                                onChange={e => setSelectedSubjectId(e.target.value)}
                                disabled={!selectedSectionId}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-purple-300 outline-none disabled:opacity-50"
                            >
                                <option value="">Select Subject</option>
                                {subjects.map(s => (
                                    <option key={s.subject_id} value={s.subject_id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Plans Display */}
                {selectedSubjectId ? (
                    plansLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                        </div>
                    ) : plans.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-md p-12 text-center">
                            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Layers className="w-10 h-10 text-purple-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">No Lesson Plans Found</h3>
                            <p className="text-gray-500 max-w-md mx-auto">
                                There are no lesson plans created for this subject and class combination yet.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {plans.map((plan, index) => (
                                <div key={plan.plan_id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-100">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(plan.status)}`}>
                                            {plan.status.replace('_', ' ')}
                                        </div>
                                        {/* Order number to show created latest vs first */}
                                        <div className="text-xs text-gray-400 font-medium tracking-wider">
                                            #{index + 1}
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-1">
                                        {plan.syllabus_documents?.chapter_title || 'Untitled Plan'}
                                    </h3>
                                    <p className="text-sm text-gray-500 mb-4 flex items-center gap-1">
                                        <BookOpen className="w-4 h-4" />
                                        {plan.syllabus_documents?.subjects?.name || 'Unknown Subject'}
                                    </p>

                                    <div className="space-y-2 text-sm text-gray-600 mb-6">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                            <span>
                                                {new Date(plan.start_date).toLocaleDateString()} - {new Date(plan.end_date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-gray-400" />
                                            <span>
                                                {/* Calculate duration in weeks using rough math */}
                                                {Math.ceil((new Date(plan.end_date).getTime() - new Date(plan.start_date).getTime()) / (1000 * 60 * 60 * 24 * 7))} weeks duration
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => router.push(`/dashboard/manage/lesson-plans/${plan.plan_id}`)}
                                        className="w-full py-2 border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors font-semibold"
                                    >
                                        View Schedule
                                    </button>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    <div className="bg-white rounded-2xl shadow-md p-12 text-center">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Layers className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Select Filters</h3>
                        <p className="text-gray-500 max-w-md mx-auto">
                            Please select a Class, Section, and Subject above to view the corresponding lesson plans according to your syllabus.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

'use client'

import { useState, useEffect } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, Calendar, BookOpen, Clock, MoreVertical, Search, Filter } from 'lucide-react'

interface LessonPlan {
    plan_id: string
    document_id: string
    start_date: string
    end_date: string
    status: 'draft' | 'published' | 'in_progress' | 'completed'
    syllabus_documents: {
        chapter_title: string
        subjects: {
            name: string
        }
    }
}

export default function LessonPlansListPage() {
    const { goBack, router } = useSmartBack('/dashboard/manage')
    const [plans, setPlans] = useState<LessonPlan[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadPlans()
    }, [])

    async function loadPlans() {
        try {
            // Check role - only admins and teachers can access
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

            if (!userData || !['super_admin', 'sub_admin', 'teacher'].includes(userData.role)) {
                alert('You do not have permission to access this page.')
                router.replace('/dashboard/redirect')
                return
            }

            // Get subject IDs for this school
            const { data: schoolSubjects } = await supabase
                .from('subjects')
                .select('subject_id')
                .eq('school_id', userData.school_id)

            const subjectIds = schoolSubjects?.map(s => s.subject_id) || []

            // Get document IDs for this school's subjects
            let documentIds: string[] = []
            if (subjectIds.length > 0) {
                const { data: docs } = await supabase
                    .from('syllabus_documents')
                    .select('document_id')
                    .in('subject_id', subjectIds)
                documentIds = docs?.map(d => d.document_id) || []
            }

            if (documentIds.length === 0) {
                setPlans([])
                setLoading(false)
                return
            }

            const { data, error } = await supabase
                .from('lesson_plans')
                .select(`
                    *,
                    syllabus_documents (
                        chapter_title,
                        subjects (name)
                    )
                `)
                .in('document_id', documentIds)
                .order('created_at', { ascending: false })

            if (error) throw error
            setPlans(data || [])
        } catch (error: any) {
            console.error('Error loading plans:', error)
        } finally {
            setLoading(false)
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Lesson Plans</h1>
                        <p className="text-gray-600">AI-generated schedules and curriculum planning</p>
                    </div>
                    <button
                        onClick={() => router.push('/dashboard/manage/lesson-plans/create')}
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-semibold"
                    >
                        <Plus className="w-5 h-5" />
                        Create New Plan
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                    </div>
                ) : plans.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
                        <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Calendar className="w-10 h-10 text-purple-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No Lesson Plans Yet</h3>
                        <p className="text-gray-500 max-w-md mx-auto mb-8">
                            Let AI organize your syllabus into a perfect schedule. Create your first lesson plan now!
                        </p>
                        <button
                            onClick={() => router.push('/dashboard/manage/lesson-plans/create')}
                            className="text-purple-600 font-semibold hover:text-purple-700 underline"
                        >
                            Get Started
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {plans.map(plan => (
                            <div key={plan.plan_id} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 border border-gray-100">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(plan.status)}`}>
                                        {plan.status.replace('_', ' ')}
                                    </div>
                                    <button className="text-gray-400 hover:text-gray-600">
                                        <MoreVertical className="w-5 h-5" />
                                    </button>
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
                                        <span>4 weeks duration</span>
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
                )}
            </div>
        </div>
    )
}

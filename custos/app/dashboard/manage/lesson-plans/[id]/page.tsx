'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Calendar, BookOpen, Clock, CheckCircle, Circle, Play, Pause, MoreVertical } from 'lucide-react'

interface LessonPlan {
    plan_id: string
    document_id: string
    start_date: string
    end_date: string
    status: string
    total_periods: number
    periods_per_week: number
    ai_schedule: {
        schedule: any[]
        summary: any
    }
    syllabus_documents: {
        chapter_title: string
        grade_level: number
        subjects: {
            name: string
            code: string
        }
    }
    classes: {
        name: string
    }
}

interface DailyDetail {
    detail_id: string
    lesson_date: string
    day_number: number
    topic_content: {
        title: string
        activities: string[]
    }
    status: 'scheduled' | 'completed' | 'skipped'
}

export default function LessonPlanDetailPage() {
    const router = useRouter()
    const params = useParams()
    const planId = params.id as string

    const [plan, setPlan] = useState<LessonPlan | null>(null)
    const [dailyDetails, setDailyDetails] = useState<DailyDetail[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'schedule' | 'overview'>('schedule')

    useEffect(() => {
        if (planId) {
            loadPlan()
            loadDailyDetails()
        }
    }, [planId])

    async function loadPlan() {
        try {
            const { data, error } = await supabase
                .from('lesson_plans')
                .select(`
                    *,
                    syllabus_documents (
                        chapter_title,
                        grade_level,
                        subjects (name, code)
                    ),
                    classes (name)
                `)
                .eq('plan_id', planId)
                .single()

            if (error) throw error

            // Format nested array
            const formattedPlan = {
                ...data,
                syllabus_documents: {
                    ...data.syllabus_documents,
                    subjects: Array.isArray(data.syllabus_documents?.subjects)
                        ? data.syllabus_documents.subjects[0]
                        : data.syllabus_documents?.subjects
                }
            }
            setPlan(formattedPlan)
        } catch (error: any) {
            console.error('Error loading plan:', error)
            alert('Failed to load lesson plan')
        } finally {
            setLoading(false)
        }
    }

    async function loadDailyDetails() {
        try {
            const { data, error } = await supabase
                .from('daily_lesson_details')
                .select('*')
                .eq('plan_id', planId)
                .order('day_number', { ascending: true })

            if (error) throw error
            setDailyDetails(data || [])
        } catch (error: any) {
            console.error('Error loading daily details:', error)
        }
    }

    async function updateDayStatus(detailId: string, newStatus: 'completed' | 'skipped') {
        try {
            const { error } = await supabase
                .from('daily_lesson_details')
                .update({
                    status: newStatus,
                    actual_completion_date: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : null
                })
                .eq('detail_id', detailId)

            if (error) throw error

            // Refresh
            loadDailyDetails()
        } catch (error: any) {
            console.error('Error updating status:', error)
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle className="w-5 h-5 text-green-500" />
            case 'skipped': return <Pause className="w-5 h-5 text-yellow-500" />
            default: return <Circle className="w-5 h-5 text-gray-300" />
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-50 border-green-200'
            case 'skipped': return 'bg-yellow-50 border-yellow-200'
            default: return 'bg-white border-gray-200'
        }
    }

    const completedCount = dailyDetails.filter(d => d.status === 'completed').length
    const progressPercent = dailyDetails.length > 0 ? Math.round((completedCount / dailyDetails.length) * 100) : 0

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        )
    }

    if (!plan) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Plan Not Found</h2>
                    <button onClick={() => router.back()} className="text-purple-600 underline">Go Back</button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/dashboard/manage/lesson-plans')}
                            className="p-2 hover:bg-white rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                {plan.syllabus_documents?.chapter_title || 'Lesson Plan'}
                            </h1>
                            <p className="text-gray-600 flex items-center gap-2">
                                <BookOpen className="w-4 h-4" />
                                {plan.syllabus_documents?.subjects?.name} • {plan.classes?.name}
                            </p>
                        </div>
                    </div>
                    <div className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider ${plan.status === 'published' ? 'bg-green-100 text-green-800' :
                        plan.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                        }`}>
                        {plan.status}
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold text-gray-900">Progress</h3>
                        <span className="text-sm text-gray-600">{completedCount} / {dailyDetails.length} days completed</span>
                    </div>
                    <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                    </div>
                    <p className="text-right text-sm text-gray-500 mt-1">{progressPercent}% complete</p>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-xl shadow p-4 text-center">
                        <Calendar className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{plan.total_periods || dailyDetails.length}</p>
                        <p className="text-xs text-gray-500">Total Days</p>
                    </div>
                    <div className="bg-white rounded-xl shadow p-4 text-center">
                        <Clock className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{plan.periods_per_week}</p>
                        <p className="text-xs text-gray-500">Periods/Week</p>
                    </div>
                    <div className="bg-white rounded-xl shadow p-4 text-center">
                        <Play className="w-6 h-6 text-green-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{new Date(plan.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        <p className="text-xs text-gray-500">Start Date</p>
                    </div>
                    <div className="bg-white rounded-xl shadow p-4 text-center">
                        <CheckCircle className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{new Date(plan.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        <p className="text-xs text-gray-500">End Date</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('schedule')}
                        className={`px-6 py-2 rounded-lg font-medium transition-all ${activeTab === 'schedule'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        Daily Schedule
                    </button>
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-6 py-2 rounded-lg font-medium transition-all ${activeTab === 'overview'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        AI Summary
                    </button>
                </div>

                {/* Schedule Tab */}
                {activeTab === 'schedule' && (
                    <div className="space-y-3">
                        {dailyDetails.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                                <p className="text-gray-500">No daily details found. The AI schedule may be stored in the plan.</p>
                                <p className="text-sm text-gray-400 mt-2">Check AI Summary tab for the generated schedule.</p>
                            </div>
                        ) : (
                            dailyDetails.map((day) => (
                                <div
                                    key={day.detail_id}
                                    className={`rounded-xl border-2 p-5 transition-all hover:shadow-md ${getStatusColor(day.status)}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            {getStatusIcon(day.status)}
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg font-bold text-purple-600">Day {day.day_number}</span>
                                                    <span className="text-sm text-gray-500">
                                                        {new Date(day.lesson_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>
                                                <h4 className="text-lg font-semibold text-gray-900">{day.topic_content?.title}</h4>
                                                <div className="flex gap-2 mt-2 flex-wrap">
                                                    {day.topic_content?.activities?.map((act, i) => (
                                                        <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                                                            {act}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {day.status === 'scheduled' && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => updateDayStatus(day.detail_id, 'completed')}
                                                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                                                >
                                                    Mark Complete
                                                </button>
                                                <button
                                                    onClick={() => updateDayStatus(day.detail_id, 'skipped')}
                                                    className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600"
                                                >
                                                    Skip
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Overview Tab */}
                {activeTab === 'overview' && plan.ai_schedule && (
                    <div className="bg-white rounded-xl shadow-xl p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">AI-Generated Summary</h3>

                        {plan.ai_schedule.summary && (
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-purple-50 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold text-purple-600">{plan.ai_schedule.summary.total_days}</p>
                                    <p className="text-sm text-gray-600">Total Days</p>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold text-blue-600">{plan.ai_schedule.summary.topics_covered}</p>
                                    <p className="text-sm text-gray-600">Topics Covered</p>
                                </div>
                                <div className="bg-green-50 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold text-green-600">{plan.ai_schedule.summary.percent_utilization}%</p>
                                    <p className="text-sm text-gray-600">Utilization</p>
                                </div>
                            </div>
                        )}

                        <h4 className="font-semibold text-gray-900 mb-3">Full Schedule (from AI)</h4>
                        <div className="max-h-96 overflow-y-auto space-y-2">
                            {plan.ai_schedule.schedule?.map((dayItem: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                                    <div className="w-16 text-center">
                                        <span className="text-2xl font-bold text-purple-600">{dayItem.day}</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900">{dayItem.topic_title}</p>
                                        <p className="text-xs text-gray-500">{dayItem.duration} min</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

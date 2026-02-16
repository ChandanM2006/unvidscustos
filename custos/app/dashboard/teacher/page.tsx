'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { NotificationBell } from '@/components/NotificationBell'
import {
    BookOpen, Clock, Calendar, FileText, Brain, CheckCircle,
    ClipboardCheck, Bell, User, ChevronRight, Loader2, Sparkles,
    BarChart3, MessageSquare
} from 'lucide-react'

interface TodayClass {
    entry_id: string
    subject_name: string
    class_name: string
    section_name: string
    start_time: string
    end_time: string
    room_number?: string
    is_current: boolean
}

interface LessonPlan {
    plan_id: string
    document_title: string
    class_name: string
    status: string
    start_date: string
}

export default function TeacherDashboard() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [teacher, setTeacher] = useState<any>(null)
    const [todayClasses, setTodayClasses] = useState<TodayClass[]>([])
    const [upcomingPlans, setUpcomingPlans] = useState<LessonPlan[]>([])
    const [currentTime, setCurrentTime] = useState(new Date())
    const [stats, setStats] = useState({
        classesToday: 0,
        completedToday: 0,
        lessonPlans: 0,
        pendingAttendance: 0
    })

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        loadTeacherData()
    }, [])

    async function loadTeacherData() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }

            // Get teacher data
            const { data: userData } = await supabase
                .from('users')
                .select('*')
                .eq('email', session.user.email)
                .single()

            if (!userData || userData.role !== 'teacher') {
                router.push('/dashboard')
                return
            }

            setTeacher(userData)

            // Load today's classes
            const today = new Date().getDay()
            const { data: entries } = await supabase
                .from('timetable_entries')
                .select(`
                    *,
                    classes (name),
                    sections (name),
                    subjects (name),
                    timetable_slots (start_time, end_time)
                `)
                .eq('teacher_id', userData.user_id)
                .eq('day_of_week', today)

            if (entries) {
                const formatted = entries.map((e: any) => ({
                    entry_id: e.entry_id,
                    subject_name: e.subjects?.name || 'Unknown',
                    class_name: e.classes?.name || '',
                    section_name: e.sections?.name || '',
                    start_time: e.timetable_slots?.start_time || '',
                    end_time: e.timetable_slots?.end_time || '',
                    room_number: e.room_number,
                    is_current: false
                }))
                setTodayClasses(formatted)
                setStats(prev => ({ ...prev, classesToday: formatted.length }))
            }

            // Load lesson plans
            const { data: plans } = await supabase
                .from('lesson_plans')
                .select(`
                    *,
                    syllabus_documents (chapter_title),
                    classes (name)
                `)
                .eq('teacher_id', userData.user_id)
                .in('status', ['draft', 'published', 'in_progress'])
                .order('start_date', { ascending: true })
                .limit(5)

            if (plans) {
                setUpcomingPlans(plans.map((p: any) => ({
                    plan_id: p.plan_id,
                    document_title: p.syllabus_documents?.chapter_title || 'Untitled',
                    class_name: p.classes?.name || '',
                    status: p.status,
                    start_date: p.start_date
                })))
                setStats(prev => ({ ...prev, lessonPlans: plans.length }))
            }

        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    function formatTime(time: string) {
        if (!time) return ''
        const [h, m] = time.split(':')
        const hour = parseInt(h) % 12 || 12
        const ampm = parseInt(h) >= 12 ? 'PM' : 'AM'
        return `${hour}:${m} ${ampm}`
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            {/* Header */}
            <header className="bg-white border-b shadow-sm sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                            {teacher?.full_name?.charAt(0) || 'T'}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">
                                Hello, {teacher?.full_name?.split(' ')[0]}!
                            </h1>
                            <p className="text-sm text-gray-500">
                                {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    {teacher && <NotificationBell userId={teacher.user_id} />}
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-6 space-y-6">
                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <Clock className="w-8 h-8 text-indigo-600 mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{stats.classesToday}</p>
                        <p className="text-sm text-gray-500">Classes Today</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <CheckCircle className="w-8 h-8 text-green-600 mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{stats.completedToday}</p>
                        <p className="text-sm text-gray-500">Completed</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <FileText className="w-8 h-8 text-purple-600 mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{stats.lessonPlans}</p>
                        <p className="text-sm text-gray-500">Active Plans</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <ClipboardCheck className="w-8 h-8 text-orange-600 mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{stats.pendingAttendance}</p>
                        <p className="text-sm text-gray-500">Pending Attendance</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Today's Schedule */}
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                        <div className="p-6 border-b bg-gradient-to-r from-indigo-500 to-purple-600">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Calendar className="w-5 h-5" />
                                Today's Schedule
                            </h2>
                        </div>
                        <div className="divide-y max-h-96 overflow-y-auto">
                            {todayClasses.length > 0 ? todayClasses.map(cls => (
                                <div key={cls.entry_id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="text-center">
                                            <p className="text-sm font-bold text-indigo-600">
                                                {formatTime(cls.start_time)}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {formatTime(cls.end_time)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900">{cls.subject_name}</p>
                                            <p className="text-sm text-gray-500">
                                                {cls.class_name} {cls.section_name}
                                                {cls.room_number && ` • Room ${cls.room_number}`}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                </div>
                            )) : (
                                <div className="p-8 text-center text-gray-500">
                                    <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                    <p>No classes scheduled today</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Lesson Plans */}
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                        <div className="p-6 border-b bg-gradient-to-r from-purple-500 to-pink-600">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <FileText className="w-5 h-5" />
                                Active Lesson Plans
                            </h2>
                        </div>
                        <div className="divide-y max-h-96 overflow-y-auto">
                            {upcomingPlans.length > 0 ? upcomingPlans.map(plan => (
                                <button
                                    key={plan.plan_id}
                                    onClick={() => router.push(`/dashboard/manage/lesson-plans/${plan.plan_id}`)}
                                    className="w-full p-4 hover:bg-gray-50 flex items-center justify-between text-left"
                                >
                                    <div>
                                        <p className="font-semibold text-gray-900">{plan.document_title}</p>
                                        <p className="text-sm text-gray-500">{plan.class_name}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${plan.status === 'published' ? 'bg-green-100 text-green-700' :
                                        plan.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                            'bg-gray-100 text-gray-600'
                                        }`}>
                                        {plan.status}
                                    </span>
                                </button>
                            )) : (
                                <div className="p-8 text-center text-gray-500">
                                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                    <p>No active lesson plans</p>
                                    <button
                                        onClick={() => router.push('/dashboard/manage/lesson-plans/create')}
                                        className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm"
                                    >
                                        Create New Plan
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <button
                        onClick={() => router.push('/dashboard/teacher/performance')}
                        className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all text-center text-white"
                    >
                        <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-90" />
                        <p className="font-bold">Performance</p>
                        <p className="text-xs opacity-75">Class analytics</p>
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/manage/attendance')}
                        className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-center"
                    >
                        <ClipboardCheck className="w-10 h-10 text-orange-600 mx-auto mb-2" />
                        <p className="font-medium text-gray-900">Mark Attendance</p>
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/manage/lesson-plans/create')}
                        className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-center"
                    >
                        <Sparkles className="w-10 h-10 text-purple-600 mx-auto mb-2" />
                        <p className="font-medium text-gray-900">AI Lesson Plan</p>
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/manage/topics')}
                        className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-center"
                    >
                        <Brain className="w-10 h-10 text-indigo-600 mx-auto mb-2" />
                        <p className="font-medium text-gray-900">Generate Resources</p>
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/manage/syllabus')}
                        className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-center"
                    >
                        <BookOpen className="w-10 h-10 text-green-600 mx-auto mb-2" />
                        <p className="font-medium text-gray-900">View Syllabus</p>
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/teacher/doubts')}
                        className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-center"
                    >
                        <MessageSquare className="w-10 h-10 text-cyan-600 mx-auto mb-2" />
                        <p className="font-medium text-gray-900">Student Doubts</p>
                    </button>
                </div>
            </main>
        </div>
    )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { NotificationBell } from '@/components/NotificationBell'
import {
    BookOpen, Clock, Calendar, FileText, Brain, CheckCircle,
    Bell, ChevronRight, Loader2, GraduationCap, BarChart3, Star,
    Flame, Zap, Trophy, Target, MessageCircle
} from 'lucide-react'

interface TodayClass {
    subject_name: string
    teacher_name: string
    start_time: string
    end_time: string
    is_current: boolean
}

export default function StudentDashboard() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [student, setStudent] = useState<any>(null)
    const [todayClasses, setTodayClasses] = useState<TodayClass[]>([])
    const [currentTime, setCurrentTime] = useState(new Date())
    const [attendancePercent, setAttendancePercent] = useState(0)
    const [className, setClassName] = useState('')
    const [brainData, setBrainData] = useState<any>(null)

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        loadStudentData()
    }, [])

    async function loadStudentData() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }

            // First get basic user data to verify role
            const { data: basicUser } = await supabase
                .from('users')
                .select('user_id, role, full_name, email, school_id, class_id, section_id')
                .eq('email', session.user.email)
                .single()

            if (!basicUser) {
                // User profile not found - go to login, not dashboard (avoids loop)
                await supabase.auth.signOut()
                router.push('/login')
                return
            }

            if (basicUser.role !== 'student') {
                // Not a student - redirect based on actual role instead of /dashboard (avoids loop)
                switch (basicUser.role) {
                    case 'super_admin':
                    case 'sub_admin':
                        router.replace('/dashboard')
                        break
                    case 'teacher':
                        router.replace('/dashboard/teacher')
                        break
                    case 'parent':
                        router.replace('/dashboard/parent')
                        break
                    default:
                        router.replace('/dashboard')
                }
                return
            }

            // Now get full student data with joins (separate query to avoid RLS issues)
            let userData: any = { ...basicUser, classes: null, sections: null }

            if (basicUser.class_id) {
                const { data: classData } = await supabase
                    .from('classes')
                    .select('name')
                    .eq('class_id', basicUser.class_id)
                    .single()
                if (classData) userData.classes = classData
            }

            if (basicUser.section_id) {
                const { data: sectionData } = await supabase
                    .from('sections')
                    .select('name')
                    .eq('section_id', basicUser.section_id)
                    .single()
                if (sectionData) userData.sections = sectionData
            }

            setStudent(userData)
            setClassName(`${userData.classes?.name || ''} ${userData.sections?.name || ''}`.trim())

            // Load today's timetable for student's class
            if (userData.class_id && userData.section_id) {
                const today = new Date().getDay()
                const { data: entries } = await supabase
                    .from('timetable_entries')
                    .select(`
                        *,
                        subjects (name),
                        users:teacher_id (full_name),
                        timetable_slots (start_time, end_time)
                    `)
                    .eq('class_id', userData.class_id)
                    .eq('section_id', userData.section_id)
                    .eq('day_of_week', today)

                if (entries) {
                    const formatted = entries.map((e: any) => ({
                        subject_name: e.subjects?.name || 'Unknown',
                        teacher_name: e.users?.full_name || 'TBA',
                        start_time: e.timetable_slots?.start_time || '',
                        end_time: e.timetable_slots?.end_time || '',
                        is_current: false
                    }))
                    setTodayClasses(formatted)
                }
            }

            // Get attendance summary
            const { data: attendanceData } = await supabase
                .from('attendance_summary')
                .select('percentage')
                .eq('student_id', userData.user_id)
                .order('year', { ascending: false })
                .order('month', { ascending: false })
                .limit(1)
                .single()

            if (attendanceData) {
                setAttendancePercent(Math.round(attendanceData.percentage))
            }

            // Fetch Brain activity data
            try {
                const brainRes = await fetch(`/api/brain/activity?studentId=${userData.user_id}`)
                if (brainRes.ok) {
                    const data = await brainRes.json()
                    setBrainData(data)
                }
            } catch { }

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
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-teal-100">
                <Loader2 className="w-12 h-12 text-teal-600 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100">
            {/* Header */}
            <header className="bg-white border-b shadow-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-teal-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                            {student?.full_name?.charAt(0) || 'S'}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">
                                Hi, {student?.full_name?.split(' ')[0]}! 👋
                            </h1>
                            <p className="text-sm text-gray-500">
                                {className} • {currentTime.toLocaleDateString('en-US', { weekday: 'long' })}
                            </p>
                        </div>
                    </div>
                    {student && <NotificationBell userId={student.user_id} />}
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6 space-y-6">
                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                        <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-2">
                            <GraduationCap className="w-6 h-6 text-teal-600" />
                        </div>
                        <p className="text-xl font-bold text-gray-900">{todayClasses.length}</p>
                        <p className="text-xs text-gray-500">Classes Today</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <p className="text-xl font-bold text-gray-900">{attendancePercent}%</p>
                        <p className="text-xs text-gray-500">Attendance</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                        <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                            <Star className="w-6 h-6 text-yellow-600" />
                        </div>
                        <p className="text-xl font-bold text-gray-900">A+</p>
                        <p className="text-xs text-gray-500">Last Grade</p>
                    </div>
                </div>

                {/* 🧠 Daily Practice CTA */}
                <button
                    onClick={() => router.push('/dashboard/student/practice')}
                    className={`w-full rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all active:scale-[0.99] text-left ${brainData?.todayPractice?.status === 'completed'
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600'
                        }`}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                                {brainData?.todayPractice?.status === 'completed' ? (
                                    <CheckCircle className="w-7 h-7 text-white" />
                                ) : (
                                    <Brain className="w-7 h-7 text-white" />
                                )}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    {brainData?.todayPractice?.status === 'completed'
                                        ? 'Practice Complete! ✅'
                                        : 'Daily Practice'}
                                </h3>
                                <p className="text-sm text-white/70">
                                    {brainData?.todayPractice?.status === 'completed'
                                        ? `Score: ${brainData.todayPractice.score_percentage}%`
                                        : '10 adaptive questions • ~5 min'}
                                </p>
                            </div>
                        </div>
                        <ChevronRight className="w-6 h-6 text-white/70" />
                    </div>
                </button>

                {/* 🔥 Brain Stats Row */}
                {brainData && (
                    <>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                                <Flame className="w-6 h-6 text-orange-500 mx-auto mb-1" />
                                <p className="text-xl font-bold text-gray-900">{brainData.dailyStreak || 0}</p>
                                <p className="text-xs text-gray-500">Day Streak</p>
                            </div>
                            <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                                <Zap className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
                                <p className="text-xl font-bold text-gray-900">{brainData.activityScore || 0}</p>
                                <p className="text-xs text-gray-500">Points</p>
                            </div>
                            <button
                                onClick={() => router.push('/dashboard/student/analytics')}
                                className="bg-white rounded-xl p-4 shadow-sm text-center hover:shadow-md transition-shadow"
                            >
                                <BarChart3 className="w-6 h-6 text-indigo-500 mx-auto mb-1" />
                                <p className="text-xl font-bold text-gray-900">{brainData.achievements?.length || 0}</p>
                                <p className="text-xs text-indigo-600 font-medium">Analytics →</p>
                            </button>
                        </div>
                    </>
                )}

                {/* 📊 This Week */}
                {brainData?.recentHistory && brainData.recentHistory.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm p-5">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">This Week</h3>
                        <div className="flex items-center gap-1">
                            {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                                const d = new Date()
                                d.setDate(d.getDate() - (6 - dayOffset))
                                const dateStr = d.toISOString().split('T')[0]
                                const phase = brainData.recentHistory.find(
                                    (p: any) => p.scheduled_date === dateStr && p.phase_type === 'daily'
                                )
                                const dayLabel = d.toLocaleDateString('en-US', { weekday: 'narrow' })
                                return (
                                    <div key={dayOffset} className="flex-1 text-center">
                                        <div className={`w-8 h-8 mx-auto rounded-lg flex items-center justify-center text-xs font-bold ${phase?.status === 'completed'
                                            ? phase.score_percentage >= 80
                                                ? 'bg-green-500 text-white'
                                                : phase.score_percentage >= 50
                                                    ? 'bg-yellow-500 text-white'
                                                    : 'bg-red-400 text-white'
                                            : dateStr === new Date().toISOString().split('T')[0]
                                                ? 'bg-indigo-100 text-indigo-600 border-2 border-indigo-300'
                                                : 'bg-gray-100 text-gray-400'
                                            }`}>
                                            {phase?.status === 'completed'
                                                ? phase.score_percentage >= 80 ? '✓' : Math.round(phase.score_percentage / 10)
                                                : dayLabel}
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-1">{dayLabel}</p>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Today's Schedule */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div className="p-5 border-b bg-gradient-to-r from-teal-500 to-green-600">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            Today's Classes
                        </h2>
                    </div>
                    <div className="divide-y">
                        {todayClasses.length > 0 ? todayClasses.map((cls, idx) => (
                            <div key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-teal-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">{cls.subject_name}</p>
                                        <p className="text-sm text-gray-500">{cls.teacher_name}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-medium text-teal-600">
                                        {formatTime(cls.start_time)}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {formatTime(cls.end_time)}
                                    </p>
                                </div>
                            </div>
                        )) : (
                            <div className="p-8 text-center text-gray-500">
                                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                <p>No classes scheduled today</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 🤖 AI Tutor CTA */}
                <button
                    onClick={() => router.push('/dashboard/student/tutor')}
                    className="w-full rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all active:scale-[0.99] text-left bg-gradient-to-r from-cyan-600 to-blue-600"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                                <MessageCircle className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Ask AI Tutor</h3>
                                <p className="text-sm text-white/80">Get instant help with any topic • Send photos of problems</p>
                            </div>
                        </div>
                        <ChevronRight className="w-6 h-6 text-white/60" />
                    </div>
                </button>

                {/* Quick Actions */}
                <h3 className="text-lg font-bold text-gray-900">Study Resources</h3>
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => router.push('/dashboard/resources')}
                        className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-left"
                    >
                        <BookOpen className="w-10 h-10 text-teal-600 mb-3" />
                        <p className="font-semibold text-gray-900">Study Materials</p>
                        <p className="text-sm text-gray-500">Notes, guides & more</p>
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/mcq')}
                        className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-left"
                    >
                        <Brain className="w-10 h-10 text-purple-600 mb-3" />
                        <p className="font-semibold text-gray-900">Practice MCQs</p>
                        <p className="text-sm text-gray-500">Test your knowledge</p>
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/attendance')}
                        className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-left"
                    >
                        <CheckCircle className="w-10 h-10 text-green-600 mb-3" />
                        <p className="font-semibold text-gray-900">My Attendance</p>
                        <p className="text-sm text-gray-500">View your record</p>
                    </button>
                    <button
                        onClick={() => router.push('/dashboard/report-card')}
                        className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-left"
                    >
                        <BarChart3 className="w-10 h-10 text-orange-600 mb-3" />
                        <p className="font-semibold text-gray-900">Report Card</p>
                        <p className="text-sm text-gray-500">View your grades</p>
                    </button>
                </div>
            </main>
        </div>
    )
}

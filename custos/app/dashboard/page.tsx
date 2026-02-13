'use client'

import { useEffect, useState } from 'react'
import { supabase, type School, type User } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
    School as SchoolIcon, LogOut, Bell, Home, Users, BookOpen,
    Calendar, FileText, BarChart3, Settings, ClipboardCheck,
    GraduationCap, Loader2, Radio
} from 'lucide-react'

export default function DashboardPage() {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [school, setSchool] = useState<School | null>(null)
    const [loading, setLoading] = useState(true)
    const [greeting, setGreeting] = useState('')
    const [mounted, setMounted] = useState(false)

    // Stats
    const [stats, setStats] = useState({ users: 0, classes: 0, subjects: 0 })

    useEffect(() => {
        setMounted(true)
        checkAuth()
        setTimeBasedGreeting()
    }, [])

    const setTimeBasedGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) setGreeting('Good Morning')
        else if (hour < 17) setGreeting('Good Afternoon')
        else setGreeting('Good Evening')
    }

    const checkAuth = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                router.push('/login')
                return
            }

            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('email', session.user.email)
                .single()

            if (userError) {
                console.error('Error fetching user:', userError)
                return
            }

            // Redirect non-admins to their role-specific dashboards
            // Use replace instead of push to prevent back-button redirect loops
            if (userData.role === 'teacher') {
                router.replace('/dashboard/teacher')
                return
            } else if (userData.role === 'student') {
                router.replace('/dashboard/student')
                return
            } else if (userData.role === 'parent') {
                router.replace('/dashboard/parent')
                return
            }

            setUser(userData)

            if (userData.school_id) {
                const { data: schoolData } = await supabase
                    .from('schools')
                    .select('*')
                    .eq('school_id', userData.school_id)
                    .single()

                if (schoolData) setSchool(schoolData)

                // Load stats
                const { count: usersCount } = await supabase
                    .from('users')
                    .select('*', { count: 'exact', head: true })
                    .eq('school_id', userData.school_id)

                const { count: classesCount } = await supabase
                    .from('classes')
                    .select('*', { count: 'exact', head: true })
                    .eq('school_id', userData.school_id)

                const { count: subjectsCount } = await supabase
                    .from('subjects')
                    .select('*', { count: 'exact', head: true })

                setStats({
                    users: usersCount || 0,
                    classes: classesCount || 0,
                    subjects: subjectsCount || 0
                })
            }
        } catch (error) {
            console.error('Auth check error:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-red-900 to-slate-900">
                <Loader2 className="w-12 h-12 text-red-400 animate-spin" />
            </div>
        )
    }

    const quickActions = [
        { name: 'Live Classes', icon: Radio, gradient: 'from-red-500 to-pink-600', path: '/dashboard/live' },
        { name: 'Manage Users', icon: Users, gradient: 'from-blue-500 to-indigo-600', path: '/dashboard/manage/users' },
        { name: 'Classes', icon: GraduationCap, gradient: 'from-green-500 to-emerald-600', path: '/dashboard/manage/classes' },
        { name: 'Syllabus (AI)', icon: BookOpen, gradient: 'from-purple-500 to-pink-600', path: '/dashboard/manage/syllabus' },
        { name: 'Lesson Plans', icon: FileText, gradient: 'from-orange-500 to-red-600', path: '/dashboard/manage/lesson-plans' },
        { name: 'Timetable', icon: Calendar, gradient: 'from-cyan-500 to-blue-600', path: '/dashboard/manage/timetable' },
        { name: 'Attendance', icon: ClipboardCheck, gradient: 'from-rose-500 to-pink-600', path: '/dashboard/manage/attendance' },
        { name: 'Report Cards', icon: BarChart3, gradient: 'from-amber-500 to-orange-600', path: '/dashboard/manage/report-cards' },
        { name: 'Notifications', icon: Bell, gradient: 'from-teal-500 to-cyan-600', path: '/dashboard/notifications' },
    ]

    const sidebarLinks = [
        { name: 'Dashboard', icon: Home, path: '/dashboard', active: true },
        { name: 'Live Classes', icon: Radio, path: '/dashboard/live' },
        { name: 'Manage', icon: Settings, path: '/dashboard/manage' },
        { name: 'Users', icon: Users, path: '/dashboard/manage/users' },
        { name: 'Classes', icon: GraduationCap, path: '/dashboard/manage/classes' },
        { name: 'Syllabus', icon: BookOpen, path: '/dashboard/manage/syllabus' },
        { name: 'Timetable', icon: Calendar, path: '/dashboard/manage/timetable' },
        { name: 'Attendance', icon: ClipboardCheck, path: '/dashboard/manage/attendance' },
        { name: 'Report Cards', icon: BarChart3, path: '/dashboard/manage/report-cards' },
        { name: 'Notifications', icon: Bell, path: '/dashboard/notifications' },
    ]

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white/5 backdrop-blur-lg border-r border-white/10 hidden lg:block">
                <div className="p-6">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                        CUSTOS
                    </h1>
                    <p className="text-xs text-red-300/60 mt-1">Admin Portal</p>
                </div>

                <nav className="px-4 space-y-1">
                    {sidebarLinks.map((link) => (
                        <a
                            key={link.name}
                            href={link.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${link.active
                                ? 'bg-white/10 text-white font-medium'
                                : 'text-red-200/70 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <link.icon className="w-5 h-5" />
                            {link.name}
                        </a>
                    ))}
                </nav>

                <div className="absolute bottom-0 left-0 w-64 p-4 border-t border-white/10">
                    <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl w-full transition-colors">
                        <LogOut className="w-5 h-5" />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                {/* Header */}
                <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4 sticky top-0 z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-red-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg">
                                {user?.full_name?.charAt(0) || 'A'}
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white">
                                    {mounted && greeting}, {user?.full_name?.split(' ')[0] || 'Admin'}
                                </h1>
                                <p className="text-sm text-red-300/70 capitalize">
                                    {user?.role?.replace('_', ' ')} • {school?.name || 'Your School'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button onClick={() => router.push('/dashboard/notifications')} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                <Bell className="w-5 h-5 text-red-300" />
                            </button>
                            <button onClick={handleLogout} className="p-2 hover:bg-red-500/20 rounded-lg transition-colors lg:hidden">
                                <LogOut className="w-5 h-5 text-red-400" />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Dashboard Content */}
                <main className="p-6">
                    {/* School Branding */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-8 border border-white/10">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-orange-600 rounded-xl flex items-center justify-center">
                                <SchoolIcon className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">{school?.name || 'Your School'}</h2>
                                <p className="text-red-300/70">School Management Dashboard</p>
                            </div>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-red-300/70 text-sm">Total Users</p>
                                    <p className="text-3xl font-bold text-white mt-1">{stats.users}</p>
                                </div>
                                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                                    <Users className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-red-300/70 text-sm">Total Classes</p>
                                    <p className="text-3xl font-bold text-white mt-1">{stats.classes}</p>
                                </div>
                                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                                    <GraduationCap className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-red-300/70 text-sm">Total Subjects</p>
                                    <p className="text-3xl font-bold text-white mt-1">{stats.subjects}</p>
                                </div>
                                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                                    <BookOpen className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        {quickActions.map((action, i) => (
                            <button
                                key={i}
                                onClick={() => router.push(action.path)}
                                className="bg-white/10 backdrop-blur-lg rounded-2xl p-5 border border-white/10 hover:bg-white/20 transition-all hover:scale-105 text-left group"
                            >
                                <div className={`w-12 h-12 bg-gradient-to-r ${action.gradient} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                                    <action.icon className="w-6 h-6 text-white" />
                                </div>
                                <p className="font-medium text-white">{action.name}</p>
                            </button>
                        ))}
                    </div>

                    {/* Info Banner */}
                    {!school && (
                        <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-2xl p-6">
                            <p className="text-yellow-200">
                                <strong>Setup Required:</strong> Complete your school branding to get started.
                            </p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}

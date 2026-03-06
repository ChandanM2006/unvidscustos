'use client'

import { useEffect, useState } from 'react'
import { supabase, type School, type User } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
    School as SchoolIcon, LogOut, Bell, Home, Users, BookOpen,
    Calendar, FileText, BarChart3, Settings, ClipboardCheck,
    GraduationCap, Loader2, Radio, Newspaper, Clock, Camera,
    Upload, PenTool, Sparkles, ChevronRight
} from 'lucide-react'

interface Post {
    post_id: string
    title: string | null
    content: string | null
    media_url: string | null
    post_type: 'photo' | 'file' | 'blog'
    created_at: string
    author?: { full_name: string; role: string }
}

interface SchoolEvent {
    event_id: string
    title: string
    event_date: string
    event_type: string
    color: string
}

export default function DashboardPage() {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [school, setSchool] = useState<School | null>(null)
    const [loading, setLoading] = useState(true)
    const [greeting, setGreeting] = useState('')
    const [mounted, setMounted] = useState(false)

    // Stats
    const [stats, setStats] = useState({ users: 0, classes: 0, subjects: 0 })
    const [recentPosts, setRecentPosts] = useState<Post[]>([])
    const [upcomingEvents, setUpcomingEvents] = useState<SchoolEvent[]>([])

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
                    .eq('school_id', userData.school_id)

                setStats({
                    users: usersCount || 0,
                    classes: classesCount || 0,
                    subjects: subjectsCount || 0
                })

                // Load recent posts
                try {
                    const res = await fetch(`/api/posts?school_id=${userData.school_id}`)
                    const postData = await res.json()
                    if (postData.posts) {
                        setRecentPosts(postData.posts.slice(0, 3))
                    }
                } catch (e) {
                    // Posts API may not be ready yet
                    console.log('Posts not available yet')
                }

                // Load upcoming events
                try {
                    const today = new Date().toISOString().split('T')[0]
                    const { data: eventData } = await supabase
                        .from('school_events')
                        .select('*')
                        .eq('school_id', userData.school_id)
                        .gte('event_date', today)
                        .order('event_date', { ascending: true })
                        .limit(5)
                    if (eventData) setUpcomingEvents(eventData)
                } catch (e) {
                    console.log('Events not available yet')
                }
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
        { name: 'Calendar', icon: Calendar, gradient: 'from-indigo-500 to-purple-600', path: '/dashboard/calendar' },
        { name: 'Posts', icon: Newspaper, gradient: 'from-rose-500 to-orange-600', path: '/dashboard/posts' },
        { name: 'Live Classes', icon: Radio, gradient: 'from-red-500 to-pink-600', path: '/dashboard/live' },
        { name: 'Manage Users', icon: Users, gradient: 'from-blue-500 to-indigo-600', path: '/dashboard/manage/users' },
        { name: 'Classes', icon: GraduationCap, gradient: 'from-green-500 to-emerald-600', path: '/dashboard/manage/classes' },
        { name: 'Syllabus (AI)', icon: BookOpen, gradient: 'from-purple-500 to-pink-600', path: '/dashboard/manage/syllabus' },
        { name: 'Lesson Plans', icon: FileText, gradient: 'from-orange-500 to-red-600', path: '/dashboard/manage/lesson-plans' },
        { name: 'Timetable', icon: Clock, gradient: 'from-cyan-500 to-blue-600', path: '/dashboard/manage/timetable' },
        { name: 'Attendance', icon: ClipboardCheck, gradient: 'from-rose-500 to-pink-600', path: '/dashboard/manage/attendance' },
        { name: 'Report Cards', icon: BarChart3, gradient: 'from-amber-500 to-orange-600', path: '/dashboard/manage/report-cards' },
        { name: 'Notifications', icon: Bell, gradient: 'from-teal-500 to-cyan-600', path: '/dashboard/notifications' },
    ]

    const sidebarLinks = [
        { name: 'Dashboard', icon: Home, path: '/dashboard', active: true },
        { name: 'Calendar', icon: Calendar, path: '/dashboard/calendar' },
        { name: 'Posts', icon: Newspaper, path: '/dashboard/posts' },
        { name: 'Live Classes', icon: Radio, path: '/dashboard/live' },
        { name: 'Manage', icon: Settings, path: '/dashboard/manage' },
        { name: 'Users', icon: Users, path: '/dashboard/manage/users' },
        { name: 'Classes', icon: GraduationCap, path: '/dashboard/manage/classes' },
        { name: 'Syllabus', icon: BookOpen, path: '/dashboard/manage/syllabus' },
        { name: 'Timetable', icon: Clock, path: '/dashboard/manage/timetable' },
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

                    {/* Recent Posts & Upcoming Events Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* Recent Posts */}
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Newspaper className="w-4 h-4 text-rose-400" />
                                    <h4 className="font-semibold text-white text-sm">Recent Posts</h4>
                                </div>
                                <button
                                    onClick={() => router.push('/dashboard/posts')}
                                    className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                                >
                                    View All <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="p-4 space-y-3">
                                {recentPosts.length > 0 ? recentPosts.map(post => (
                                    <div
                                        key={post.post_id}
                                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                                        onClick={() => router.push('/dashboard/posts')}
                                    >
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${post.post_type === 'photo' ? 'bg-pink-500/20' :
                                                post.post_type === 'file' ? 'bg-blue-500/20' : 'bg-amber-500/20'
                                            }`}>
                                            {post.post_type === 'photo' ? <Camera className="w-4 h-4 text-pink-400" /> :
                                                post.post_type === 'file' ? <Upload className="w-4 h-4 text-blue-400" /> :
                                                    <PenTool className="w-4 h-4 text-amber-400" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-white text-sm font-medium truncate">
                                                {post.title || (post.content ? post.content.substring(0, 60) + '...' : 'Untitled')}
                                            </p>
                                            <p className="text-white/40 text-xs mt-0.5">
                                                {post.author?.full_name || 'Admin'} • {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center py-6">
                                        <Newspaper className="w-8 h-8 text-white/10 mx-auto mb-2" />
                                        <p className="text-white/30 text-xs">No posts yet</p>
                                        <button
                                            onClick={() => router.push('/dashboard/posts')}
                                            className="mt-2 text-xs text-rose-400 hover:text-rose-300"
                                        >
                                            Create your first post
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Upcoming Events */}
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-amber-400" />
                                    <h4 className="font-semibold text-white text-sm">Upcoming Events</h4>
                                </div>
                                <button
                                    onClick={() => router.push('/dashboard/calendar')}
                                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                                >
                                    Calendar <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="p-4 space-y-3">
                                {upcomingEvents.length > 0 ? upcomingEvents.map(event => (
                                    <div
                                        key={event.event_id}
                                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                                        onClick={() => router.push('/dashboard/calendar')}
                                    >
                                        <div
                                            className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                                            style={{ backgroundColor: event.color + '20', color: event.color }}
                                        >
                                            {new Date(event.event_date + 'T00:00:00').getDate()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-white text-sm font-medium truncate">{event.title}</p>
                                            <p className="text-white/40 text-xs mt-0.5">
                                                {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                <span className="ml-2 uppercase tracking-wider text-[10px]" style={{ color: event.color }}>
                                                    {event.event_type === 'holiday' ? '🏖️ Holiday' :
                                                        event.event_type === 'occasion' ? '🎉 Occasion' :
                                                            event.event_type === 'exam_period' ? '📝 Exam' : '📌 Event'}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center py-6">
                                        <Calendar className="w-8 h-8 text-white/10 mx-auto mb-2" />
                                        <p className="text-white/30 text-xs">No upcoming events</p>
                                        <button
                                            onClick={() => router.push('/dashboard/calendar')}
                                            className="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
                                        >
                                            Add an event
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
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

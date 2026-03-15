'use client'

import { useEffect, useState } from 'react'
import { supabase, type School, type User } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
    School as SchoolIcon, Bell, Users, BookOpen,
    GraduationCap, Loader2, Radio, Newspaper,
    Camera, Upload, PenTool, Sparkles, ChevronRight,
    Calendar, BarChart3
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

    const [stats, setStats] = useState({ users: 0, classes: 0, subjects: 0 })
    const [recentPosts, setRecentPosts] = useState<Post[]>([])
    const [upcomingEvents, setUpcomingEvents] = useState<SchoolEvent[]>([])

    useEffect(() => {
        setMounted(true)
        checkAuth()
        const h = new Date().getHours()
        setGreeting(h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening')
    }, [])

    const checkAuth = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return }

            const { data: userData } = await supabase.from('users').select('*').eq('email', session.user.email).single()
            if (!userData) return

            if (userData.role === 'teacher') { router.replace('/dashboard/teacher'); return }
            if (userData.role === 'student') { router.replace('/dashboard/student'); return }
            if (userData.role === 'parent')  { router.replace('/dashboard/parent');  return }

            setUser(userData)

            if (userData.school_id) {
                const { data: schoolData } = await supabase.from('schools').select('*').eq('school_id', userData.school_id).single()
                if (schoolData) setSchool(schoolData)

                const [{ count: usersCount }, { count: classesCount }, { count: subjectsCount }] = await Promise.all([
                    supabase.from('users').select('*', { count: 'exact', head: true }).eq('school_id', userData.school_id),
                    supabase.from('classes').select('*', { count: 'exact', head: true }).eq('school_id', userData.school_id),
                    supabase.from('subjects').select('*', { count: 'exact', head: true }).eq('school_id', userData.school_id),
                ])
                setStats({ users: usersCount || 0, classes: classesCount || 0, subjects: subjectsCount || 0 })

                try {
                    const res = await fetch(`/api/posts?school_id=${userData.school_id}`)
                    const d = await res.json()
                    if (d.posts) setRecentPosts(d.posts.slice(0, 3))
                } catch {}

                try {
                    const today = new Date().toISOString().split('T')[0]
                    const { data: eventData } = await supabase
                        .from('school_events').select('*').eq('school_id', userData.school_id)
                        .gte('event_date', today).order('event_date', { ascending: true }).limit(5)
                    if (eventData) setUpcomingEvents(eventData)
                } catch {}
            }
        } catch (err) { console.error(err) } finally { setLoading(false) }
    }

    if (loading) {
        return (
            <div className="min-h-full flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-purple-500/30 border-t-pink-400 animate-spin mx-auto" />
                        <SchoolIcon className="w-6 h-6 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="mt-4 text-purple-300 text-sm font-medium animate-pulse">Loading dashboard...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 space-y-6 text-white">

            {/* Page Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/30">
                        {user?.full_name?.charAt(0) || 'A'}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            {mounted && greeting}, {user?.full_name?.split(' ')[0] || 'Admin'} 👋
                        </h1>
                        <p className="text-sm text-purple-300/60 capitalize">
                            {user?.role?.replace('_', ' ')} • {school?.name || 'Your School'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => router.push('/dashboard/notifications')}
                    className="p-2.5 hover:bg-white/10 rounded-xl transition-colors"
                >
                    <Bell className="w-5 h-5 text-purple-300/70" />
                </button>
            </div>

            {/* School Banner */}
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm border border-purple-500/20 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30 flex-shrink-0">
                    <SchoolIcon className="w-7 h-7 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">{school?.name || 'Your School'}</h2>
                    <p className="text-purple-300/60 text-sm">School Management Dashboard</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: 'Total Users',    value: stats.users,    icon: Users,        gradient: 'from-blue-500 to-indigo-600',  shadow: 'shadow-blue-500/20'  },
                    { label: 'Total Classes',  value: stats.classes,  icon: GraduationCap,gradient: 'from-green-500 to-emerald-600', shadow: 'shadow-green-500/20' },
                    { label: 'Total Subjects', value: stats.subjects, icon: BookOpen,     gradient: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/20' },
                ].map(({ label, value, icon: Icon, gradient, shadow }) => (
                    <div key={label} className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                        <div>
                            <p className="text-purple-300/60 text-sm mb-1">{label}</p>
                            <p className="text-3xl font-bold text-white">{value}</p>
                        </div>
                        <div className={`w-12 h-12 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center shadow-md ${shadow}`}>
                            <Icon className="w-6 h-6 text-white" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Posts & Upcoming Events */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Recent Posts */}
                <div className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
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
                    <div className="p-4 space-y-2">
                        {recentPosts.length > 0 ? recentPosts.map(post => (
                            <div
                                key={post.post_id}
                                className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer"
                                onClick={() => router.push('/dashboard/posts')}
                            >
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${post.post_type === 'photo' ? 'bg-pink-500/20' : post.post_type === 'file' ? 'bg-blue-500/20' : 'bg-amber-500/20'}`}>
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
                            <div className="text-center py-8">
                                <Newspaper className="w-8 h-8 text-white/10 mx-auto mb-2" />
                                <p className="text-white/30 text-xs">No posts yet</p>
                                <button onClick={() => router.push('/dashboard/posts')} className="mt-2 text-xs text-rose-400 hover:text-rose-300">
                                    Create your first post
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Upcoming Events */}
                <div className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
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
                    <div className="p-4 space-y-2">
                        {upcomingEvents.length > 0 ? upcomingEvents.map(event => (
                            <div
                                key={event.event_id}
                                className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer"
                                onClick={() => router.push('/dashboard/calendar')}
                            >
                                <div
                                    className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                                    style={{ backgroundColor: event.color + '25', color: event.color }}
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
                            <div className="text-center py-8">
                                <Calendar className="w-8 h-8 text-white/10 mx-auto mb-2" />
                                <p className="text-white/30 text-xs">No upcoming events</p>
                                <button onClick={() => router.push('/dashboard/calendar')} className="mt-2 text-xs text-indigo-400 hover:text-indigo-300">
                                    Add an event
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Setup banner */}
            {!school && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-5">
                    <p className="text-yellow-200 text-sm">
                        <strong>Setup Required:</strong> Complete your school branding to get started.
                    </p>
                </div>
            )}

        </div>
    )
}

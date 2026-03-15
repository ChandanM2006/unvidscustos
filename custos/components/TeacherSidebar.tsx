'use client'

import { useRouter, usePathname } from 'next/navigation'
import {
    Home, Calendar, Newspaper, BarChart3,
    ClipboardCheck, Sparkles, Radio, Brain,
    Edit3, MessageSquare, Clock, Bell, LogOut, X, BookOpen
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

const NAV_ITEMS = [
    { label: 'Dashboard',      icon: Home,          path: '/dashboard/teacher',                    gradient: 'from-indigo-500 to-violet-600' },
    { label: 'Calendar',       icon: Calendar,       path: '/dashboard/calendar',                   gradient: 'from-blue-500 to-indigo-600' },
    { label: 'Posts',          icon: Newspaper,      path: '/dashboard/posts',                      gradient: 'from-rose-500 to-orange-500' },
    { label: 'Live Class',     icon: Radio,          path: '/dashboard/teacher/live-class',         gradient: 'from-red-500 to-pink-600' },
    { label: 'Performance',    icon: BarChart3,      path: '/dashboard/teacher/performance',        gradient: 'from-amber-400 to-orange-500' },
    { label: 'Mark Attendance',icon: ClipboardCheck, path: '/dashboard/manage/attendance',          gradient: 'from-green-500 to-emerald-600' },
    { label: 'AI Lesson Plan', icon: Sparkles,       path: '/dashboard/manage/lesson-plans/create', gradient: 'from-violet-500 to-purple-600' },
    { label: 'Brain (MCQs)',   icon: Brain,          path: '/dashboard/teacher/brain',              gradient: 'from-cyan-400 to-teal-600' },
    { label: 'Marks Entry',    icon: Edit3,          path: '/dashboard/teacher/marks-entry',        gradient: 'from-sky-400 to-blue-600' },
    { label: 'My Timetable',   icon: Clock,          path: '/dashboard/teacher/timetable',          gradient: 'from-teal-400 to-cyan-600' },
    { label: 'Student Doubts', icon: MessageSquare,  path: '/dashboard/teacher/doubts',             gradient: 'from-fuchsia-500 to-pink-600' },
    { label: 'Notifications',  icon: Bell,           path: '/dashboard/notifications',              gradient: 'from-yellow-400 to-amber-500' },
]

interface TeacherSidebarProps {
    isMobileOpen: boolean
    setIsMobileOpen: (v: boolean) => void
    teacherName?: string
}

export function TeacherSidebar({ isMobileOpen, setIsMobileOpen, teacherName }: TeacherSidebarProps) {
    const router = useRouter()
    const pathname = usePathname()

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/login')
    }

    function navigate(path: string) {
        router.push(path)
        setIsMobileOpen(false)
    }

    const initial = teacherName?.charAt(0)?.toUpperCase() || 'T'

    const SidebarContent = () => (
        <aside className="flex flex-col h-full w-64 bg-slate-900/95 backdrop-blur-lg border-r border-white/10 shadow-2xl">
            {/* Brand */}
            <div className="px-5 py-5 border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/30 glossy-icon">
                        {initial}
                    </div>
                    <div>
                        <h1 className="text-base font-bold bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
                            CUSTOS
                        </h1>
                        <p className="text-[11px] text-indigo-400/60">Teacher Portal</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsMobileOpen(false)}
                    className="lg:hidden p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors duration-200"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 glossy-scroll">
                {NAV_ITEMS.map((item) => {
                    const isActive =
                        item.path === '/dashboard/teacher'
                            ? pathname === item.path
                            : pathname.startsWith(item.path)

                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left group glossy-nav-btn
                                ${isActive
                                    ? 'bg-white/10 text-white shadow-sm'
                                    : 'text-indigo-300/60 hover:bg-white/[0.06] hover:text-white'
                                }`}
                        >
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.gradient} flex items-center justify-center flex-shrink-0 shadow-md glossy-icon`}>
                                <item.icon className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm font-medium">{item.label}</span>
                            {isActive && (
                                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 glossy-dot" />
                            )}
                        </button>
                    )
                })}
            </nav>

            {/* Logout */}
            <div className="px-3 pb-4 pt-2 border-t border-white/[0.07]">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400/70 hover:bg-red-500/10 hover:text-red-300 text-left group glossy-nav-btn"
                >
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-red-500/20 transition-colors duration-200">
                        <LogOut className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">Logout</span>
                </button>
            </div>
        </aside>
    )

    return (
        <>
            {isMobileOpen && (
                <div className="fixed inset-0 bg-black/60 z-[55] lg:hidden glossy-overlay" onClick={() => setIsMobileOpen(false)} />
            )}
            <div className="hidden lg:flex h-screen sticky top-0">
                <SidebarContent />
            </div>
            <div className={`fixed inset-y-0 left-0 z-[60] lg:hidden glossy-slide ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <SidebarContent />
            </div>
        </>
    )
}

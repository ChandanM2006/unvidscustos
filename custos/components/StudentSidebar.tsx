'use client'

import { useRouter, usePathname } from 'next/navigation'
import {
    Home, Calendar, Newspaper, BookOpen,
    BarChart3, CheckCircle, Clock, Trophy,
    MessageCircle, Bell, LogOut, X, Brain
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

const NAV_ITEMS = [
    { label: 'Dashboard',      icon: Home,          path: '/dashboard/student',            gradient: 'from-teal-500 to-emerald-600' },
    { label: 'Calendar',       icon: Calendar,       path: '/dashboard/calendar',           gradient: 'from-indigo-500 to-blue-600' },
    { label: 'Posts',          icon: Newspaper,      path: '/dashboard/posts',              gradient: 'from-rose-500 to-orange-500' },
    { label: 'Study Materials',icon: BookOpen,       path: '/dashboard/resources',          gradient: 'from-violet-500 to-purple-600' },
    { label: 'AI Tutor',       icon: Brain,          path: '/dashboard/student/tutor',      gradient: 'from-cyan-400 to-blue-500' },
    { label: 'Analytics',      icon: BarChart3,      path: '/dashboard/student/analytics',  gradient: 'from-amber-400 to-orange-500' },
    { label: 'My Attendance',  icon: CheckCircle,    path: '/dashboard/student/attendance', gradient: 'from-green-500 to-emerald-600' },
    { label: 'Report Card',    icon: Trophy,         path: '/dashboard/student/report-card',gradient: 'from-orange-400 to-red-500' },
    { label: 'My Timetable',   icon: Clock,          path: '/dashboard/student/timetable',  gradient: 'from-sky-400 to-cyan-600' },
    { label: 'My Progress',    icon: BarChart3,      path: '/dashboard/student/progress',   gradient: 'from-emerald-400 to-teal-600' },
    { label: 'Notifications',  icon: Bell,           path: '/dashboard/notifications',      gradient: 'from-fuchsia-400 to-pink-500' },
]

interface StudentSidebarProps {
    isMobileOpen: boolean
    setIsMobileOpen: (v: boolean) => void
    studentName?: string
}

export function StudentSidebar({ isMobileOpen, setIsMobileOpen, studentName }: StudentSidebarProps) {
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

    const initial = studentName?.charAt(0)?.toUpperCase() || 'S'

    const SidebarContent = () => (
        <aside className="flex flex-col h-full w-64 bg-slate-900/95 backdrop-blur-lg border-r border-white/10 shadow-2xl">
            {/* Brand */}
            <div className="px-5 py-5 border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-teal-500/30 glossy-icon">
                        {initial}
                    </div>
                    <div>
                        <h1 className="text-base font-bold bg-gradient-to-r from-teal-300 to-emerald-300 bg-clip-text text-transparent">
                            CUSTOS
                        </h1>
                        <p className="text-[11px] text-teal-400/60">Student Portal</p>
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
                        item.path === '/dashboard/student'
                            ? pathname === item.path
                            : pathname.startsWith(item.path)

                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left group glossy-nav-btn
                                ${isActive
                                    ? 'bg-white/10 text-white shadow-sm'
                                    : 'text-teal-300/60 hover:bg-white/[0.06] hover:text-white'
                                }`}
                        >
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.gradient} flex items-center justify-center flex-shrink-0 shadow-md glossy-icon`}>
                                <item.icon className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm font-medium">{item.label}</span>
                            {isActive && (
                                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-400 glossy-dot" />
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
            {/* Mobile overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-[55] lg:hidden glossy-overlay"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Desktop: always visible */}
            <div className="hidden lg:flex h-screen sticky top-0">
                <SidebarContent />
            </div>

            {/* Mobile: slide in */}
            <div className={`fixed inset-y-0 left-0 z-[60] lg:hidden glossy-slide ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <SidebarContent />
            </div>
        </>
    )
}

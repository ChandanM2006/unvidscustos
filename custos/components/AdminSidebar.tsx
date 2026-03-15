'use client'

import { useRouter, usePathname } from 'next/navigation'
import {
    Home, Calendar, Newspaper, Radio, Users, GraduationCap,
    BookOpen, Clock, ClipboardCheck, BarChart3, Settings, Bell, X, FileText, LogOut,
    IndianRupee, ClipboardList
} from 'lucide-react'
// Removed useSidebar import
import { supabase } from '@/lib/supabase'

const ALL_LINKS = [
    { name: 'Dashboard',    icon: Home,          path: '/dashboard',                     gradient: 'from-red-500 to-orange-600',    exact: true  },
    { name: 'Calendar',     icon: Calendar,       path: '/dashboard/calendar',            gradient: 'from-indigo-500 to-blue-600',   exact: false },
    { name: 'Posts',        icon: Newspaper,      path: '/dashboard/posts',               gradient: 'from-rose-500 to-orange-500',   exact: false },
    { name: 'Live Classes', icon: Radio,          path: '/dashboard/live',                gradient: 'from-red-500 to-pink-600',      exact: false, adminOnly: true },
    { name: 'Users',        icon: Users,          path: '/dashboard/manage/users',        gradient: 'from-blue-500 to-indigo-600',   exact: false },
    { name: 'Classes',      icon: GraduationCap,  path: '/dashboard/manage/classes',      gradient: 'from-green-500 to-emerald-600', exact: false },
    { name: 'Fees',         icon: IndianRupee,    path: '/dashboard/manage/fees',         gradient: 'from-emerald-400 to-teal-500',  exact: false },
    { name: 'Syllabus (AI)',icon: BookOpen,       path: '/dashboard/manage/syllabus',     gradient: 'from-violet-500 to-purple-600', exact: false },
    { name: 'Lesson Plans', icon: FileText,       path: '/dashboard/manage/lesson-plans', gradient: 'from-purple-500 to-pink-600',   exact: false, adminOnly: true },
    { name: 'Timetable',    icon: Clock,          path: '/dashboard/manage/timetable',    gradient: 'from-sky-400 to-cyan-600',      exact: false },
    { name: 'Attendance',   icon: ClipboardCheck, path: '/dashboard/manage/attendance',   gradient: 'from-teal-400 to-green-500',    exact: false },
    { name: 'Report Cards', icon: BarChart3,      path: '/dashboard/manage/report-cards', gradient: 'from-orange-400 to-red-500',    exact: false, adminOnly: true },
    { name: 'Notifications',icon: Bell,           path: '/dashboard/notifications',       gradient: 'from-amber-400 to-orange-500',  exact: false },
    { name: 'Manage',       icon: Settings,       path: '/dashboard/manage',              gradient: 'from-slate-400 to-slate-600',   exact: true  },
]

interface AdminSidebarProps {
    isMobileOpen: boolean
    setIsMobileOpen: (v: boolean) => void
    adminName?: string
    userRole?: string | null
}

export function AdminSidebar({ isMobileOpen, setIsMobileOpen, adminName, userRole }: AdminSidebarProps) {
    const router = useRouter()
    const pathname = usePathname()

    const isSubAdmin = userRole === 'sub_admin'

    const links = ALL_LINKS.filter(l => {
        if (isSubAdmin && l.adminOnly) return false
        return true
    })

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/login')
    }

    function navigate(path: string) {
        router.push(path)
        setIsMobileOpen(false)
    }

    const SidebarContent = () => (
        <aside className="flex flex-col h-full w-64 bg-purple-950/95 backdrop-blur-lg border-r border-white/10 shadow-2xl">
            {/* Brand */}
            <div className="px-5 py-5 border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-500/30 glossy-icon">
                        {adminName?.charAt(0)?.toUpperCase() || 'C'}
                    </div>
                    <div>
                        <h1 className="text-base font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                            CUSTOS
                        </h1>
                        <p className="text-[11px] text-purple-400/60">
                            {isSubAdmin ? 'Sub Admin Portal' : 'Admin Portal'}
                        </p>
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
                {links.map((link) => {
                    const isActive = link.exact ? pathname === link.path : pathname.startsWith(link.path)
                    return (
                        <button
                            key={link.name}
                            onClick={() => navigate(link.path)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left group glossy-nav-btn
                                ${isActive
                                    ? 'bg-white/10 text-white shadow-sm'
                                    : 'text-purple-300/60 hover:bg-white/[0.06] hover:text-white'
                                }`}
                        >
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${link.gradient} flex items-center justify-center flex-shrink-0 shadow-md glossy-icon`}>
                                <link.icon className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm font-medium">{link.name}</span>
                            {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-pink-400 glossy-dot" />}
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

            {/* Desktop: always visible (sticky inside the flex layout) */}
            <div className="hidden lg:flex h-screen sticky top-0">
                <SidebarContent />
            </div>

            {/* Mobile: slide-in */}
            <div className={`fixed inset-y-0 left-0 z-[60] lg:hidden glossy-slide ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <SidebarContent />
            </div>
        </>
    )
}

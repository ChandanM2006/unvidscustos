'use client'

import { useRouter, usePathname } from 'next/navigation'
import {
    Home, Calendar, Newspaper, IndianRupee,
    CheckCircle, BarChart3, Clock, MessageSquare,
    Bell, LogOut, X, Heart
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

const NAV_ITEMS = [
    { label: 'Dashboard',   icon: Home,          path: '/dashboard/parent',            gradient: 'from-fuchsia-500 to-purple-600' },
    { label: 'Calendar',    icon: Calendar,       path: '/dashboard/calendar',          gradient: 'from-indigo-500 to-purple-600' },
    { label: 'Posts',       icon: Newspaper,      path: '/dashboard/posts',             gradient: 'from-rose-500 to-orange-600' },
    { label: 'Fee Payment', icon: IndianRupee,    path: '/dashboard/parent/fees',       gradient: 'from-emerald-500 to-green-600' },
    { label: 'Attendance',  icon: CheckCircle,    path: '/dashboard/parent/attendance', gradient: 'from-green-500 to-teal-600' },
    { label: 'Report Card', icon: BarChart3,      path: '/dashboard/parent/reports',    gradient: 'from-orange-400 to-red-500' },
    { label: 'Timetable',   icon: Clock,          path: '/dashboard/parent/timetable',  gradient: 'from-cyan-400 to-blue-500' },
    { label: 'Messages',    icon: MessageSquare,  path: '/dashboard/parent/messages',   gradient: 'from-violet-500 to-purple-600' },
    { label: 'Notifications', icon: Bell,         path: '/dashboard/notifications',     gradient: 'from-amber-400 to-orange-500' },
]

interface ParentSidebarProps {
    isMobileOpen: boolean
    setIsMobileOpen: (v: boolean) => void
    parentName?: string
}

export function ParentSidebar({ isMobileOpen, setIsMobileOpen, parentName }: ParentSidebarProps) {
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

    const initial = parentName?.charAt(0)?.toUpperCase() || 'P'

    const SidebarContent = () => (
        <aside className="flex flex-col h-full w-64 bg-purple-950/95 backdrop-blur-lg border-r border-white/10 shadow-2xl">
            {/* Brand */}
            <div className="px-5 py-5 border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-fuchsia-500 to-purple-700 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-fuchsia-500/30 glossy-icon">
                        {initial}
                    </div>
                    <div>
                        <h1 className="text-base font-bold bg-gradient-to-r from-fuchsia-300 to-purple-300 bg-clip-text text-transparent">
                            CUSTOS
                        </h1>
                        <p className="text-[11px] text-purple-400/60">Parent Portal</p>
                    </div>
                </div>
                {/* Close button – mobile only */}
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
                        item.path === '/dashboard/parent'
                            ? pathname === item.path
                            : pathname.startsWith(item.path)

                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left group glossy-nav-btn
                                ${isActive
                                    ? 'bg-white/10 text-white shadow-sm'
                                    : 'text-purple-300/60 hover:bg-white/[0.06] hover:text-white'
                                }`}
                        >
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.gradient} flex items-center justify-center flex-shrink-0 shadow-md glossy-icon`}>
                                <item.icon className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm font-medium">{item.label}</span>
                            {isActive && (
                                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-fuchsia-400 glossy-dot" />
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

'use client'

import { usePathname } from 'next/navigation'
import { AdminSidebar } from '@/components/AdminSidebar'
import { ParentSidebar } from '@/components/ParentSidebar'
import { StudentSidebar } from '@/components/StudentSidebar'
import { TeacherSidebar } from '@/components/TeacherSidebar'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SidebarProvider } from '@/components/SidebarContext'
import { Menu } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const [role, setRole] = useState<string | null>(null)
    const [userName, setUserName] = useState('')
    const [isMobileOpen, setIsMobileOpen] = useState(false)

    useEffect(() => {
        let isMounted = true
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session && isMounted) {
                supabase.from('users').select('role, full_name').eq('email', session.user.email).single()
                    .then(({ data }) => {
                        if (isMounted && data) { setRole(data.role); setUserName(data.full_name || '') }
                    })
            }
        })
        return () => { isMounted = false }
    }, [])

    const isAdmin   = ['super_admin', 'sub_admin'].includes(role || '')
    const isParent  = role === 'parent'
    const isStudent = role === 'student'
    const isTeacher = role === 'teacher'

    // These paths have their own layout.tsx — skip here to avoid double sidebar
    const isInsideParentLayout  = pathname.startsWith('/dashboard/parent')
    const isInsideStudentLayout = pathname.startsWith('/dashboard/student')
    const isInsideTeacherLayout = pathname.startsWith('/dashboard/teacher')

    // Shared wrapper for calendar, posts, and other shared pages
    const SharedShell = ({ sidebar, bg, mobileGradient }: {
        sidebar: React.ReactNode
        bg: string
        mobileGradient: string
    }) => (
        <SidebarProvider>
            <div className={`flex h-screen overflow-hidden ${bg}`}>
                {sidebar}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-black/30 backdrop-blur-xl border-b border-white/[0.07] sticky top-0 z-30">
                        <button onClick={() => setIsMobileOpen(true)} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                            <Menu className="w-5 h-5 text-white" />
                        </button>
                        <h1 className={`text-base font-bold bg-gradient-to-r ${mobileGradient} bg-clip-text text-transparent`}>CUSTOS</h1>
                    </header>
                    <div className="flex-1 overflow-y-auto overflow-x-hidden"><div className="page-transition">{children}</div></div>
                </div>
            </div>
        </SidebarProvider>
    )

    // ── Admin ──────────────────────────────────────────────────────────────
    if (isAdmin && !isInsideParentLayout && !isInsideStudentLayout && !isInsideTeacherLayout) {
        return (
            <SharedShell
                bg="bg-purple-950"
                mobileGradient="from-purple-400 to-purple-400"
                sidebar={<AdminSidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} adminName={userName} userRole={role} />}
            />
        )
    }

    // ── Parent on shared routes (calendar, posts, etc.) ────────────────────
    if (isParent && !isInsideParentLayout && !isInsideStudentLayout && !isInsideTeacherLayout) {
        return (
            <SharedShell
                bg="bg-gradient-to-br from-purple-950 via-fuchsia-950 to-slate-950"
                mobileGradient="from-fuchsia-300 to-purple-300"
                sidebar={<ParentSidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} parentName={userName} />}
            />
        )
    }

    // ── Student on shared routes ───────────────────────────────────────────
    if (isStudent && !isInsideStudentLayout && !isInsideParentLayout && !isInsideTeacherLayout) {
        return (
            <SharedShell
                bg="bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900"
                mobileGradient="from-teal-300 to-emerald-300"
                sidebar={<StudentSidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} studentName={userName} />}
            />
        )
    }

    // ── Teacher on shared routes ───────────────────────────────────────────
    if (isTeacher && !isInsideTeacherLayout && !isInsideParentLayout && !isInsideStudentLayout) {
        return (
            <SharedShell
                bg="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900"
                mobileGradient="from-indigo-300 to-violet-300"
                sidebar={<TeacherSidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} teacherName={userName} />}
            />
        )
    }

    // ── Default (unauthenticated / already inside a role layout) ──────────
    return (
        <SidebarProvider>
            {children}
        </SidebarProvider>
    )
}

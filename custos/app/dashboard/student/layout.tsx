'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { StudentSidebar } from '@/components/StudentSidebar'
import { Menu } from 'lucide-react'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
    const [isMobileOpen, setIsMobileOpen] = useState(false)
    const [studentName, setStudentName] = useState('')

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) return
            supabase
                .from('users')
                .select('full_name')
                .eq('email', session.user.email)
                .single()
                .then(({ data }) => {
                    if (data?.full_name) setStudentName(data.full_name)
                })
        })
    }, [])

    return (
        <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900">
            {/* Persistent Sidebar */}
            <StudentSidebar
                isMobileOpen={isMobileOpen}
                setIsMobileOpen={setIsMobileOpen}
                studentName={studentName}
            />

            {/* Content area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile top bar */}
                <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-slate-900/80 backdrop-blur-xl border-b border-white/[0.07] sticky top-0 z-30">
                    <button
                        onClick={() => setIsMobileOpen(true)}
                        className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                    >
                        <Menu className="w-5 h-5 text-white" />
                    </button>
                    <h1 className="text-base font-bold bg-gradient-to-r from-teal-300 to-emerald-300 bg-clip-text text-transparent">
                        CUSTOS
                    </h1>
                </header>

                {/* Scrollable page content */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden">
                    {children}
                </main>
            </div>
        </div>
    )
}

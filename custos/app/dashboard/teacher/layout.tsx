'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { TeacherSidebar } from '@/components/TeacherSidebar'
import { Menu } from 'lucide-react'

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
    const [isMobileOpen, setIsMobileOpen] = useState(false)
    const [teacherName, setTeacherName] = useState('')

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) return
            supabase
                .from('users')
                .select('full_name')
                .eq('email', session.user.email)
                .single()
                .then(({ data }) => {
                    if (data?.full_name) setTeacherName(data.full_name)
                })
        })
    }, [])

    return (
        <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
            <TeacherSidebar
                isMobileOpen={isMobileOpen}
                setIsMobileOpen={setIsMobileOpen}
                teacherName={teacherName}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile top bar */}
                <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-slate-900/80 backdrop-blur-xl border-b border-white/[0.07] sticky top-0 z-30">
                    <button
                        onClick={() => setIsMobileOpen(true)}
                        className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                    >
                        <Menu className="w-5 h-5 text-white" />
                    </button>
                    <h1 className="text-base font-bold bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
                        CUSTOS
                    </h1>
                </header>
                <main className="flex-1 overflow-y-auto overflow-x-hidden">
                    {children}
                </main>
            </div>
        </div>
    )
}

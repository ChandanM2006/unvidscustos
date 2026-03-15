'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

interface SidebarContextType {
    isMobileMenuOpen: boolean
    setIsMobileMenuOpen: (isOpen: boolean) => void
    userRole: string | null
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [userRole, setUserRole] = useState<string | null>(null)

    useEffect(() => {
        let isMounted = true
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session && isMounted) {
                supabase
                    .from('users')
                    .select('role')
                    .eq('email', session.user.email)
                    .single()
                    .then(({ data }) => {
                        if (isMounted && data) {
                            setUserRole(data.role)
                        }
                    })
            }
        })
        return () => { isMounted = false }
    }, [])

    return (
        <SidebarContext.Provider value={{ isMobileMenuOpen, setIsMobileMenuOpen, userRole }}>
            {children}
        </SidebarContext.Provider>
    )
}

export function useSidebar() {
    const context = useContext(SidebarContext)
    if (!context) {
        throw new Error('useSidebar must be used within a SidebarProvider')
    }
    return context
}

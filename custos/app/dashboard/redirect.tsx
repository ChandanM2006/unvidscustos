'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

/**
 * This page redirects users to their role-specific dashboard
 * - super_admin, sub_admin -> /dashboard (Admin Dashboard)
 * - teacher -> /dashboard/teacher
 * - student -> /dashboard/student  
 * - parent -> /dashboard/parent
 */

export default function DashboardRedirect() {
    const router = useRouter()
    const [checking, setChecking] = useState(true)

    useEffect(() => {
        redirectToRoleDashboard()
    }, [])

    async function redirectToRoleDashboard() {
        try {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                router.push('/login')
                return
            }

            const { data: userData } = await supabase
                .from('users')
                .select('role')
                .eq('email', session.user.email)
                .single()

            if (!userData) {
                router.push('/login')
                return
            }

            // Route based on role
            switch (userData.role) {
                case 'super_admin':
                case 'sub_admin':
                    // Admins go to main dashboard (don't redirect to avoid loop)
                    setChecking(false)
                    return
                case 'teacher':
                    router.replace('/dashboard/teacher')
                    break
                case 'student':
                    router.replace('/dashboard/student')
                    break
                case 'parent':
                    router.replace('/dashboard/parent')
                    break
                default:
                    setChecking(false)
            }
        } catch (error) {
            console.error('Error:', error)
            setChecking(false)
        }
    }

    if (checking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-red-900 to-slate-900">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-red-400 animate-spin mx-auto mb-4" />
                    <p className="text-red-200">Loading your dashboard...</p>
                </div>
            </div>
        )
    }

    // If not redirecting, render nothing (will be handled by parent)
    return null
}

'use client'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { GraduationCap, BookOpen, Users, Shield, Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react'

const roleConfig: Record<string, { label: string; icon: any; gradient: string }> = {
    student: {
        label: 'Student',
        icon: GraduationCap,
        gradient: 'from-green-500 to-emerald-600'
    },
    teacher: {
        label: 'Teacher',
        icon: BookOpen,
        gradient: 'from-blue-500 to-indigo-600'
    },
    parent: {
        label: 'Parent',
        icon: Users,
        gradient: 'from-teal-500 to-cyan-600'
    },
    admin: {
        label: 'Admin',
        icon: Shield,
        gradient: 'from-red-500 to-orange-600'
    },
}

function LoginContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [selectedRole, setSelectedRole] = useState<string>('admin')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)

    useEffect(() => {
        const roleParam = searchParams.get('role')
        if (roleParam && roleConfig[roleParam]) {
            setSelectedRole(roleParam)
        }
    }, [searchParams])

    const currentRole = roleConfig[selectedRole] || roleConfig.admin
    const RoleIcon = currentRole.icon

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (authError) throw authError

            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('role, full_name, school_id')
                .eq('email', email)
                .single()

            if (userError || !userData) {
                throw new Error('User profile not found. Please contact your administrator.')
            }

            const isAdmin = selectedRole === 'admin' &&
                (userData.role === 'super_admin' || userData.role === 'sub_admin')
            const isMatchingRole = userData.role === selectedRole || isAdmin

            if (!isMatchingRole) {
                await supabase.auth.signOut()
                throw new Error(`You are not registered as a ${currentRole.label}. Your role is: ${userData.role.replace('_', ' ')}`)
            }

            switch (userData.role) {
                case 'super_admin':
                case 'sub_admin':
                    router.push('/dashboard')
                    break
                case 'teacher':
                    router.push('/dashboard/teacher')
                    break
                case 'student':
                    router.push('/dashboard/student')
                    break
                case 'parent':
                    router.push('/dashboard/parent')
                    break
                default:
                    router.push('/dashboard')
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred during login')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/30 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/30 rounded-full blur-3xl"></div>
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Back Button */}
                <button
                    onClick={() => router.push('/')}
                    className="flex items-center gap-2 text-purple-300 hover:text-white mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to role selection
                </button>

                {/* Logo */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        CUSTOS
                    </h1>
                    <p className="text-purple-300 mt-2">School Management System</p>
                </div>

                {/* Login Card */}
                <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-2xl">
                    {/* Role Badge */}
                    <div className="text-center mb-6">
                        <div className={`inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r ${currentRole.gradient} text-white`}>
                            <RoleIcon className="w-6 h-6" />
                            <span className="font-semibold text-lg">{currentRole.label} Login</span>
                        </div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        {error && (
                            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-purple-200 mb-2">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                placeholder="you@school.edu"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-purple-200 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all pr-12"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-4 px-4 bg-gradient-to-r ${currentRole.gradient} text-white font-semibold rounded-xl hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Signing in...
                                </span>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <div className="mt-6 text-center text-sm text-purple-400">
                    <p>Secure login powered by Supabase</p>
                </div>
            </div>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
                <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    )
}

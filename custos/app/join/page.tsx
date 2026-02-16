'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    GraduationCap, User, Users, CheckCircle, Mail,
    Phone, Lock, Eye, EyeOff, Loader2, AlertCircle, School
} from 'lucide-react'

interface InvitationData {
    invite_id: string
    full_name: string
    email: string | null
    phone: string | null
    role: string
    school_id: string
    status: string
    metadata: any
    schools?: { name: string }
}

function JoinPageInner() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get('token')

    const [loading, setLoading] = useState(true)
    const [invitation, setInvitation] = useState<InvitationData | null>(null)
    const [error, setError] = useState('')
    const [step, setStep] = useState<'verify' | 'password' | 'success'>('verify')

    // OTP State
    const [otp, setOtp] = useState('')
    const [otpSent, setOtpSent] = useState(false)
    const [sendingOtp, setSendingOtp] = useState(false)
    const [verifyingOtp, setVerifyingOtp] = useState(false)

    // Password State
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [creating, setCreating] = useState(false)

    useEffect(() => {
        if (token) {
            loadInvitation()
        } else {
            setLoading(false)
            setError('No invitation token provided')
        }
    }, [token])

    async function loadInvitation() {
        try {
            const { data, error } = await supabase
                .from('user_invitations')
                .select('*, schools:school_id(name)')
                .eq('invite_token', token)
                .single()

            if (error || !data) {
                setError('Invalid or expired invitation link')
                return
            }

            if (data.status === 'registered' || data.status === 'active') {
                setError('This invitation has already been used. Please login.')
                return
            }

            setInvitation(data)

            // Update status to clicked
            await supabase
                .from('user_invitations')
                .update({ status: 'clicked' })
                .eq('invite_id', data.invite_id)

        } catch (err) {
            console.error('Error:', err)
            setError('Failed to load invitation')
        } finally {
            setLoading(false)
        }
    }

    async function sendOtp() {
        if (!invitation) return

        setSendingOtp(true)
        try {
            // Send OTP via email API
            const response = await fetch('/api/email/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inviteId: invitation.invite_id })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send OTP')
            }

            alert(`✅ Verification code sent to ${invitation.email}!\n\nPlease check your email inbox (and spam folder).`)
            setOtpSent(true)
        } catch (err: any) {
            console.error('Error sending OTP:', err)
            alert('Failed to send verification code. Please try again.')
        } finally {
            setSendingOtp(false)
        }
    }

    async function verifyOtp() {
        if (!invitation || !otp) return

        setVerifyingOtp(true)
        try {
            const { data } = await supabase
                .from('user_invitations')
                .select('otp_code, otp_expires_at, otp_attempts')
                .eq('invite_id', invitation.invite_id)
                .single()

            if (!data) {
                alert('Error verifying OTP')
                return
            }

            if (data.otp_attempts >= 3) {
                alert('Too many attempts. Please request a new OTP.')
                return
            }

            if (new Date(data.otp_expires_at) < new Date()) {
                alert('OTP has expired. Please request a new one.')
                return
            }

            if (data.otp_code !== otp) {
                await supabase
                    .from('user_invitations')
                    .update({ otp_attempts: (data.otp_attempts || 0) + 1 })
                    .eq('invite_id', invitation.invite_id)

                alert('Invalid OTP. Please try again.')
                return
            }

            // OTP verified
            await supabase
                .from('user_invitations')
                .update({ status: 'registering' })
                .eq('invite_id', invitation.invite_id)

            setStep('password')

        } catch (err) {
            console.error('Error:', err)
            alert('Verification failed')
        } finally {
            setVerifyingOtp(false)
        }
    }

    async function createAccount() {
        if (!invitation) return

        if (password.length < 6) {
            alert('Password must be at least 6 characters')
            return
        }

        if (password !== confirmPassword) {
            alert('Passwords do not match')
            return
        }

        setCreating(true)
        try {
            // Create user via API
            const response = await fetch('/api/users/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: invitation.email,
                    password: password,
                    full_name: invitation.full_name,
                    role: invitation.role,
                    school_id: invitation.school_id,
                    class_id: invitation.metadata?.class_id || null,
                    section_id: invitation.metadata?.section_id || null
                })
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error)

            // Update invitation
            await supabase
                .from('user_invitations')
                .update({
                    status: 'registered',
                    user_id: data.user.id,
                    registered_at: new Date().toISOString()
                })
                .eq('invite_id', invitation.invite_id)

            // If this is a parent with student link
            if (invitation.role === 'parent' && invitation.metadata?.student_invite_id) {
                // Find the student's user_id from their invitation
                const { data: studentInvite } = await supabase
                    .from('user_invitations')
                    .select('user_id')
                    .eq('invite_id', invitation.metadata.student_invite_id)
                    .single()

                if (studentInvite?.user_id) {
                    await supabase.from('parent_student_links').insert({
                        parent_id: data.user.id,
                        student_id: studentInvite.user_id,
                        relationship: 'parent'
                    })
                }
            }

            // Send welcome email
            try {
                await fetch('/api/email/send-welcome', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: invitation.email,
                        userName: invitation.full_name,
                        role: invitation.role,
                        schoolName: invitation.schools?.name || 'Your School'
                    })
                })
            } catch (emailErr) {
                console.log('Welcome email failed (non-critical):', emailErr)
            }

            setStep('success')

        } catch (err: any) {
            console.error('Error:', err)
            alert('Error: ' + err.message)
        } finally {
            setCreating(false)
        }
    }

    // For demo: Skip OTP verification
    function skipToPassword() {
        setStep('password')
    }

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'student': return GraduationCap
            case 'teacher': return User
            case 'parent': return Users
            default: return User
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700">
                <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700 p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Invitation Error</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button
                        onClick={() => router.push('/login')}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        )
    }

    if (!invitation) return null

    const RoleIcon = getRoleIcon(invitation.role)

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <RoleIcon className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">
                        Welcome, {invitation.full_name}!
                    </h1>
                    <p className="text-blue-100 mt-1">
                        Complete your registration as {invitation.role}
                    </p>
                    {invitation.schools && (
                        <div className="flex items-center justify-center gap-2 mt-3 text-white/80">
                            <School className="w-4 h-4" />
                            <span className="text-sm">{invitation.schools.name}</span>
                        </div>
                    )}
                </div>

                {/* Step: Verify */}
                {step === 'verify' && (
                    <div className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Verify Your Identity</h2>

                        {invitation.email && (
                            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl mb-4">
                                <Mail className="w-5 h-5 text-gray-500" />
                                <div>
                                    <p className="text-sm text-gray-500">Email</p>
                                    <p className="font-medium text-gray-900">{invitation.email}</p>
                                </div>
                            </div>
                        )}

                        {invitation.phone && (
                            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl mb-4">
                                <Phone className="w-5 h-5 text-gray-500" />
                                <div>
                                    <p className="text-sm text-gray-500">Phone</p>
                                    <p className="font-medium text-gray-900">{invitation.phone}</p>
                                </div>
                            </div>
                        )}

                        {!otpSent ? (
                            <button
                                onClick={sendOtp}
                                disabled={sendingOtp}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50"
                            >
                                {sendingOtp ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                                Send Verification Code
                            </button>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Enter OTP</label>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        className="w-full p-4 border border-gray-300 rounded-xl text-center text-2xl tracking-widest font-mono text-gray-900"
                                        placeholder="000000"
                                        maxLength={6}
                                    />
                                </div>
                                <button
                                    onClick={verifyOtp}
                                    disabled={verifyingOtp || otp.length !== 6}
                                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {verifyingOtp && <Loader2 className="w-5 h-5 animate-spin" />}
                                    Verify
                                </button>
                                <button
                                    onClick={sendOtp}
                                    className="w-full py-2 text-blue-600 text-sm hover:underline"
                                >
                                    Resend Code
                                </button>
                            </div>
                        )}

                        {/* Demo skip button */}
                        <button
                            onClick={skipToPassword}
                            className="w-full mt-4 py-2 text-gray-500 text-sm hover:underline"
                        >
                            [Demo] Skip verification →
                        </button>
                    </div>
                )}

                {/* Step: Password */}
                {step === 'password' && (
                    <div className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Your Password</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-10 pr-10 p-3 border border-gray-300 rounded-xl text-gray-900"
                                        placeholder="Min. 6 characters"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full pl-10 p-3 border border-gray-300 rounded-xl text-gray-900"
                                        placeholder="Confirm password"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={createAccount}
                                disabled={creating || password.length < 6 || password !== confirmPassword}
                                className="w-full py-3 bg-green-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-50"
                            >
                                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                                Complete Registration
                            </button>
                        </div>
                    </div>
                )}

                {/* Step: Success */}
                {step === 'success' && (
                    <div className="p-8 text-center">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-10 h-10 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Complete!</h2>
                        <p className="text-gray-600 mb-6">
                            Your account has been created. You can now login with your email and password.
                        </p>
                        <button
                            onClick={() => router.push('/login')}
                            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                        >
                            Go to Login
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function JoinPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700">
                <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
        }>
            <JoinPageInner />
        </Suspense>
    )
}

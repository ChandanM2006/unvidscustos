'use client'

import { useState, useEffect } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Mail, Phone, Clock, Send, Trash2, CheckCircle,
    AlertCircle, Loader2, RefreshCw, Copy, ExternalLink, Users
} from 'lucide-react'

interface Invitation {
    invite_id: string
    full_name: string
    email: string | null
    phone: string | null
    role: string
    status: string
    invite_token: string
    invite_sent_at: string | null
    created_at: string
    parent1_name: string | null
    parent1_email: string | null
}

export default function InvitationsPage() {
    const { goBack, router } = useSmartBack('/dashboard/manage/users')
    const [loading, setLoading] = useState(true)
    const [invitations, setInvitations] = useState<Invitation[]>([])
    const [filter, setFilter] = useState<'all' | 'pending' | 'invited' | 'registered'>('all')

    useEffect(() => {
        loadInvitations()
    }, [])

    async function loadInvitations() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }

            const { data: userData } = await supabase
                .from('users')
                .select('role, school_id')
                .eq('email', session.user.email)
                .single()

            if (!userData || !['super_admin', 'sub_admin'].includes(userData.role)) {
                router.replace('/dashboard/redirect')
                return
            }

            const { data, error } = await supabase
                .from('user_invitations')
                .select('*')
                .eq('school_id', userData.school_id)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error:', error)
                // Table might not exist yet
                if (error.code === '42P01') {
                    setInvitations([])
                    return
                }
            }

            setInvitations(data || [])
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    async function resendInvitation(invite: Invitation) {
        try {
            // Send real email via API
            const response = await fetch('/api/email/send-invitation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inviteId: invite.invite_id })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send email')
            }

            alert(`✅ Invitation email sent successfully to ${invite.email}!`)
            loadInvitations()
        } catch (error: any) {
            console.error('Error:', error)
            // Fallback: Show link if email fails
            const inviteUrl = `${window.location.origin}/join?token=${invite.invite_token}`
            alert(`Email sending failed. You can manually share this link:\n\n${inviteUrl}`)
        }
    }

    async function deleteInvitation(inviteId: string) {
        if (!confirm('Delete this invitation?')) return

        try {
            await supabase
                .from('user_invitations')
                .delete()
                .eq('invite_id', inviteId)

            loadInvitations()
        } catch (error) {
            console.error('Error:', error)
            alert('Failed to delete invitation')
        }
    }

    function copyInviteLink(token: string) {
        const url = `${window.location.origin}/join?token=${token}`
        navigator.clipboard.writeText(url)
        alert('Invite link copied!')
    }

    const filteredInvitations = invitations.filter(inv => {
        if (filter === 'all') return true
        if (filter === 'pending') return inv.status === 'pending' || inv.status === 'invited'
        if (filter === 'registered') return inv.status === 'registered' || inv.status === 'active'
        return inv.status === filter
    })

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">Pending</span>
            case 'invited':
                return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">Invited</span>
            case 'clicked':
                return <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">Clicked</span>
            case 'registering':
                return <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">Registering</span>
            case 'registered':
            case 'active':
                return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Registered</span>
            default:
                return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">{status}</span>
        }
    }

    const getRoleBadge = (role: string) => {
        const colors: Record<string, string> = {
            student: 'bg-green-100 text-green-800',
            teacher: 'bg-blue-100 text-blue-800',
            parent: 'bg-purple-100 text-purple-800',
            sub_admin: 'bg-orange-100 text-orange-800'
        }
        return <span className={`px-2 py-1 rounded-full text-xs ${colors[role] || 'bg-gray-100 text-gray-800'}`}>
            {role.replace('_', ' ')}
        </span>
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/dashboard/manage/users')} className="p-2 hover:bg-gray-100 rounded-lg">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Pending Invitations</h1>
                            <p className="text-sm text-gray-500">{invitations.length} total invitations</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={loadInvitations}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => router.push('/dashboard/manage/users/add')}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                        >
                            New Invitation
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6">
                {/* Filters */}
                <div className="flex gap-2 mb-6">
                    {['all', 'pending', 'registered'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`px-4 py-2 rounded-lg font-medium ${filter === f
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-xl shadow p-4">
                        <p className="text-sm text-gray-500">Total</p>
                        <p className="text-2xl font-bold text-gray-900">{invitations.length}</p>
                    </div>
                    <div className="bg-white rounded-xl shadow p-4">
                        <p className="text-sm text-gray-500">Pending</p>
                        <p className="text-2xl font-bold text-yellow-600">
                            {invitations.filter(i => i.status === 'pending' || i.status === 'invited').length}
                        </p>
                    </div>
                    <div className="bg-white rounded-xl shadow p-4">
                        <p className="text-sm text-gray-500">Clicked</p>
                        <p className="text-2xl font-bold text-purple-600">
                            {invitations.filter(i => i.status === 'clicked' || i.status === 'registering').length}
                        </p>
                    </div>
                    <div className="bg-white rounded-xl shadow p-4">
                        <p className="text-sm text-gray-500">Registered</p>
                        <p className="text-2xl font-bold text-green-600">
                            {invitations.filter(i => i.status === 'registered' || i.status === 'active').length}
                        </p>
                    </div>
                </div>

                {/* Invitations List */}
                {filteredInvitations.length === 0 ? (
                    <div className="bg-white rounded-xl shadow p-12 text-center">
                        <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-900 mb-2">No Invitations</h3>
                        <p className="text-gray-500 mb-4">
                            {filter === 'all'
                                ? 'Add users to send invitations'
                                : `No ${filter} invitations`}
                        </p>
                        <button
                            onClick={() => router.push('/dashboard/manage/users/add')}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium"
                        >
                            Add User
                        </button>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredInvitations.map(invite => (
                                    <tr key={invite.invite_id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-medium text-gray-900">{invite.full_name}</p>
                                                {invite.parent1_name && (
                                                    <p className="text-xs text-purple-600 flex items-center gap-1 mt-1">
                                                        <Users className="w-3 h-3" />
                                                        Parent: {invite.parent1_name}
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">{getRoleBadge(invite.role)}</td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                {invite.email && (
                                                    <p className="text-sm text-gray-600 flex items-center gap-1">
                                                        <Mail className="w-3 h-3" />
                                                        {invite.email}
                                                    </p>
                                                )}
                                                {invite.phone && (
                                                    <p className="text-sm text-gray-600 flex items-center gap-1">
                                                        <Phone className="w-3 h-3" />
                                                        {invite.phone}
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">{getStatusBadge(invite.status)}</td>
                                        <td className="px-6 py-4">
                                            {invite.invite_sent_at ? (
                                                <p className="text-sm text-gray-500">
                                                    {new Date(invite.invite_sent_at).toLocaleDateString()}
                                                </p>
                                            ) : (
                                                <p className="text-sm text-gray-400">Not sent</p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => copyInviteLink(invite.invite_token)}
                                                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                                                    title="Copy invite link"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                {invite.status !== 'registered' && invite.status !== 'active' && (
                                                    <button
                                                        onClick={() => resendInvitation(invite)}
                                                        className="p-2 hover:bg-blue-50 rounded-lg text-blue-600"
                                                        title="Resend invitation"
                                                    >
                                                        <Send className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => deleteInvitation(invite.invite_id)}
                                                    className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                                                    title="Delete invitation"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    )
}

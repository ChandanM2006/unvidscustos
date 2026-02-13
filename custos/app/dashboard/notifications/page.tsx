'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Bell, Megaphone, Plus, Send,
    Check, CheckCheck, Trash2, Pin, AlertCircle,
    Clock, Users, Loader2, Eye, X
} from 'lucide-react'

interface Notification {
    notification_id: string
    title: string
    message: string
    type: string
    is_read: boolean
    created_at: string
    action_url?: string
}

interface Announcement {
    announcement_id: string
    title: string
    content: string
    priority: string
    target_audience: string
    is_published: boolean
    is_pinned: boolean
    created_at: string
    created_by: string
    users?: { full_name: string }
}

export default function NotificationsPage() {
    const router = useRouter()

    const [loading, setLoading] = useState(true)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [announcements, setAnnouncements] = useState<Announcement[]>([])
    const [activeTab, setActiveTab] = useState<'notifications' | 'announcements'>('notifications')

    // Create announcement modal
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newAnnouncement, setNewAnnouncement] = useState({
        title: '',
        content: '',
        priority: 'normal',
        target_audience: 'all'
    })
    const [publishing, setPublishing] = useState(false)

    // User role
    const [isStaff, setIsStaff] = useState(false)

    useEffect(() => {
        checkUserAndLoad()
    }, [])

    async function checkUserAndLoad() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            // Check role
            const { data: userData } = await supabase
                .from('users')
                .select('role')
                .eq('user_id', user.id)
                .single()

            setIsStaff(['super_admin', 'sub_admin', 'teacher'].includes(userData?.role))

            await Promise.all([loadNotifications(user.id), loadAnnouncements()])
        }
        setLoading(false)
    }

    async function loadNotifications(userId: string) {
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50)
        setNotifications(data || [])
    }

    async function loadAnnouncements() {
        const { data } = await supabase
            .from('announcements')
            .select('*, users:created_by(full_name)')
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(50)
        setAnnouncements(data || [])
    }

    async function markAsRead(notificationId: string) {
        await supabase
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('notification_id', notificationId)

        setNotifications(prev => prev.map(n =>
            n.notification_id === notificationId ? { ...n, is_read: true } : n
        ))
    }

    async function markAllAsRead() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabase
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .eq('is_read', false)

        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    }

    async function createAnnouncement() {
        if (!newAnnouncement.title || !newAnnouncement.content) {
            alert('Please fill in title and content')
            return
        }

        setPublishing(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()

            const { error } = await supabase
                .from('announcements')
                .insert({
                    ...newAnnouncement,
                    created_by: user?.id,
                    is_published: true,
                    publish_at: new Date().toISOString()
                })

            if (error) throw error

            setShowCreateModal(false)
            setNewAnnouncement({ title: '', content: '', priority: 'normal', target_audience: 'all' })
            loadAnnouncements()
            alert('Announcement published!')
        } catch (error: any) {
            console.error('Error creating announcement:', error)
            alert('Error: ' + error.message)
        } finally {
            setPublishing(false)
        }
    }

    async function togglePin(announcementId: string, currentlyPinned: boolean) {
        await supabase
            .from('announcements')
            .update({ is_pinned: !currentlyPinned })
            .eq('announcement_id', announcementId)

        loadAnnouncements()
    }

    const unreadCount = notifications.filter(n => !n.is_read).length

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'success': return '✅'
            case 'warning': return '⚠️'
            case 'error': return '❌'
            case 'attendance': return '📋'
            case 'marks': return '📊'
            case 'fee': return '💰'
            default: return 'ℹ️'
        }
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent': return 'bg-red-100 border-red-300 text-red-800'
            case 'high': return 'bg-orange-100 border-orange-300 text-orange-800'
            case 'normal': return 'bg-blue-100 border-blue-300 text-blue-800'
            default: return 'bg-gray-100 border-gray-300 text-gray-800'
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="p-2 hover:bg-white rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
                            <p className="text-gray-600">
                                {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {isStaff && (
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700"
                            >
                                <Megaphone className="w-5 h-5" />
                                New Announcement
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${activeTab === 'notifications'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <Bell className="w-5 h-5" />
                        My Notifications
                        {unreadCount > 0 && (
                            <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                                {unreadCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('announcements')}
                        className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${activeTab === 'announcements'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <Megaphone className="w-5 h-5" />
                        Announcements
                    </button>
                </div>

                {/* Notifications Tab */}
                {activeTab === 'notifications' && (
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h2 className="font-semibold text-gray-900">Recent Notifications</h2>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
                                >
                                    <CheckCheck className="w-4 h-4" />
                                    Mark all as read
                                </button>
                            )}
                        </div>

                        {notifications.length === 0 ? (
                            <div className="p-12 text-center">
                                <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">No notifications yet</p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {notifications.map(notification => (
                                    <div
                                        key={notification.notification_id}
                                        onClick={() => !notification.is_read && markAsRead(notification.notification_id)}
                                        className={`p-4 cursor-pointer transition-all ${notification.is_read
                                                ? 'bg-white hover:bg-gray-50'
                                                : 'bg-indigo-50 hover:bg-indigo-100'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="text-2xl">{getTypeIcon(notification.type)}</span>
                                            <div className="flex-1">
                                                <div className="flex items-start justify-between">
                                                    <h3 className={`font-medium ${notification.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
                                                        {notification.title}
                                                    </h3>
                                                    {!notification.is_read && (
                                                        <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                                                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(notification.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Announcements Tab */}
                {activeTab === 'announcements' && (
                    <div className="space-y-4">
                        {announcements.length === 0 ? (
                            <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
                                <Megaphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">No announcements yet</p>
                            </div>
                        ) : (
                            announcements.map(announcement => (
                                <div
                                    key={announcement.announcement_id}
                                    className={`bg-white rounded-xl shadow-lg p-6 border-l-4 ${announcement.is_pinned ? 'border-yellow-500' :
                                            announcement.priority === 'urgent' ? 'border-red-500' :
                                                announcement.priority === 'high' ? 'border-orange-500' :
                                                    'border-indigo-500'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                {announcement.is_pinned && (
                                                    <Pin className="w-4 h-4 text-yellow-600" />
                                                )}
                                                <h3 className="text-lg font-bold text-gray-900">{announcement.title}</h3>
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(announcement.priority)}`}>
                                                    {announcement.priority}
                                                </span>
                                            </div>
                                            <p className="text-gray-700 whitespace-pre-wrap">{announcement.content}</p>
                                            <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <Users className="w-4 h-4" />
                                                    {announcement.target_audience}
                                                </span>
                                                <span>•</span>
                                                <span>{announcement.users?.full_name || 'Admin'}</span>
                                                <span>•</span>
                                                <span>{new Date(announcement.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        {isStaff && (
                                            <button
                                                onClick={() => togglePin(announcement.announcement_id, announcement.is_pinned)}
                                                className={`p-2 rounded-lg ${announcement.is_pinned ? 'text-yellow-600 bg-yellow-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                            >
                                                <Pin className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Create Announcement Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900">New Announcement</h2>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                <input
                                    type="text"
                                    value={newAnnouncement.title}
                                    onChange={(e) => setNewAnnouncement(p => ({ ...p, title: e.target.value }))}
                                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900"
                                    placeholder="Announcement title"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                                <textarea
                                    value={newAnnouncement.content}
                                    onChange={(e) => setNewAnnouncement(p => ({ ...p, content: e.target.value }))}
                                    className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 h-32"
                                    placeholder="Write your announcement..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                                    <select
                                        value={newAnnouncement.priority}
                                        onChange={(e) => setNewAnnouncement(p => ({ ...p, priority: e.target.value }))}
                                        className="w-full p-3 border border-gray-300 rounded-lg text-gray-900"
                                    >
                                        <option value="low">Low</option>
                                        <option value="normal">Normal</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
                                    <select
                                        value={newAnnouncement.target_audience}
                                        onChange={(e) => setNewAnnouncement(p => ({ ...p, target_audience: e.target.value }))}
                                        className="w-full p-3 border border-gray-300 rounded-lg text-gray-900"
                                    >
                                        <option value="all">Everyone</option>
                                        <option value="students">Students Only</option>
                                        <option value="teachers">Teachers Only</option>
                                        <option value="parents">Parents Only</option>
                                        <option value="staff">Staff Only</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t flex justify-end gap-3">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createAnnouncement}
                                disabled={publishing}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {publishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                Publish
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

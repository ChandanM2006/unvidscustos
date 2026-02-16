'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Bell, X, Check, ExternalLink, Loader2 } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────

interface Notification {
    notification_id: string
    title: string
    message: string
    type: string
    action_url: string | null
    action_label: string | null
    is_read: boolean
    created_at: string
}

interface NotificationBellProps {
    userId: string
}

// ─── Component ──────────────────────────────────────────

export function NotificationBell({ userId }: NotificationBellProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // ─── Load notifications ─────────────────────────────

    const loadNotifications = useCallback(async () => {
        if (!userId) return

        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(20)

            if (error) {
                console.error('[Notifications] Load error:', error)
                return
            }

            setNotifications(data || [])
            setUnreadCount((data || []).filter(n => !n.is_read).length)
        } catch (err) {
            console.error('[Notifications] Error:', err)
        }
    }, [userId])

    useEffect(() => {
        loadNotifications()
    }, [loadNotifications])

    // ─── Real-time subscription ─────────────────────────

    useEffect(() => {
        if (!userId) return

        const channel = supabase
            .channel(`notifications_${userId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userId}`,
            }, (payload) => {
                const newNotif = payload.new as Notification
                setNotifications(prev => [newNotif, ...prev])
                setUnreadCount(prev => prev + 1)
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userId])

    // ─── Close on outside click ─────────────────────────

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // ─── Mark as read ───────────────────────────────────

    async function markAsRead(notifId: string) {
        await supabase
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('notification_id', notifId)

        setNotifications(prev =>
            prev.map(n => n.notification_id === notifId ? { ...n, is_read: true } : n)
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
    }

    async function markAllAsRead() {
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.notification_id)
        if (unreadIds.length === 0) return

        await supabase
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .in('notification_id', unreadIds)

        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        setUnreadCount(0)
    }

    // ─── Format time ────────────────────────────────────

    function formatTimeAgo(dateStr: string): string {
        const diff = Date.now() - new Date(dateStr).getTime()
        const minutes = Math.floor(diff / 60000)
        if (minutes < 1) return 'Just now'
        if (minutes < 60) return `${minutes}m ago`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours}h ago`
        const days = Math.floor(hours / 24)
        if (days === 1) return 'Yesterday'
        return `${days}d ago`
    }

    // ─── Icon for notification type ─────────────────────

    function getTypeEmoji(type: string): string {
        switch (type) {
            case 'success': return '✅'
            case 'warning': return '⚠️'
            case 'error': return '❌'
            case 'alert': return '🚨'
            case 'attendance': return '📋'
            case 'marks': return '📊'
            case 'fee': return '💰'
            case 'homework': return '📝'
            default: return '🔔'
        }
    }

    // ─── Render ─────────────────────────────────────────

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 hover:bg-white/10 rounded-xl transition-all group"
                aria-label="Notifications"
            >
                <Bell className={`w-5 h-5 transition-colors ${unreadCount > 0 ? 'text-cyan-400' : 'text-blue-300/60 group-hover:text-blue-300'
                    }`} />

                {/* Unread badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <h3 className="text-sm font-bold text-white">Notifications</h3>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
                                >
                                    Mark all read
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-white/10 rounded-lg"
                            >
                                <X className="w-4 h-4 text-blue-300/60" />
                            </button>
                        </div>
                    </div>

                    {/* Notification List */}
                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <Bell className="w-8 h-8 text-blue-300/20 mx-auto mb-2" />
                                <p className="text-sm text-blue-300/40">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map(notif => (
                                <div
                                    key={notif.notification_id}
                                    className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${!notif.is_read ? 'bg-indigo-500/5' : ''
                                        }`}
                                    onClick={() => {
                                        markAsRead(notif.notification_id)
                                        if (notif.action_url) {
                                            window.location.href = notif.action_url
                                        }
                                    }}
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Type icon */}
                                        <span className="text-lg shrink-0">{getTypeEmoji(notif.type)}</span>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className={`text-sm font-medium truncate ${notif.is_read ? 'text-white/70' : 'text-white'
                                                    }`}>
                                                    {notif.title}
                                                </p>
                                                {!notif.is_read && (
                                                    <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                                                )}
                                            </div>
                                            <p className="text-xs text-blue-300/50 mt-0.5 line-clamp-2">
                                                {notif.message}
                                            </p>
                                            <p className="text-[10px] text-blue-300/30 mt-1">
                                                {formatTimeAgo(notif.created_at)}
                                            </p>
                                        </div>

                                        {/* Action */}
                                        {notif.action_url && (
                                            <ExternalLink className="w-3.5 h-3.5 text-blue-300/30 shrink-0 mt-1" />
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

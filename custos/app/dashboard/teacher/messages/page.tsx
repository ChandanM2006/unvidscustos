'use client'

import { useState, useEffect, useRef } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, MessageCircle, Send, User, Search,
    Loader2, Users, Clock, Check, CheckCheck, Bell
} from 'lucide-react'

interface Parent {
    user_id: string
    full_name: string
    email: string
}

interface Student {
    user_id: string
    full_name: string
    class_name?: string
}

interface Message {
    message_id: string
    parent_id: string
    teacher_id: string
    student_id: string
    sender_id: string
    sender_role: 'parent' | 'teacher'
    message: string
    is_read: boolean
    created_at: string
}

interface Conversation {
    parent: Parent
    student: Student
    lastMessage?: Message
    unreadCount: number
}

export default function TeacherMessagesPage() {
    const { goBack, router } = useSmartBack('/dashboard/teacher')
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [teacherId, setTeacherId] = useState('')

    // Data
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [messages, setMessages] = useState<Message[]>([])

    // Selection
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
    const [newMessage, setNewMessage] = useState('')

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        if (selectedConversation && teacherId) {
            loadMessages()
        }
    }, [selectedConversation, teacherId])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    async function loadData() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }

            const { data: userData } = await supabase
                .from('users')
                .select('user_id, role')
                .eq('email', session.user.email)
                .single()

            if (!userData || userData.role !== 'teacher') {
                router.push('/login')
                return
            }

            setTeacherId(userData.user_id)

            // Load all messages for this teacher
            const { data: messagesData } = await supabase
                .from('parent_teacher_messages')
                .select('*')
                .eq('teacher_id', userData.user_id)
                .order('created_at', { ascending: false })

            if (!messagesData || messagesData.length === 0) {
                setLoading(false)
                return
            }

            // Get unique parent and student IDs
            const parentIds = [...new Set(messagesData.map(m => m.parent_id))]
            const studentIds = [...new Set(messagesData.map(m => m.student_id))]

            // Load parent details
            const { data: parentsData } = await supabase
                .from('users')
                .select('user_id, full_name, email')
                .in('user_id', parentIds)

            // Load student details
            const { data: studentsData } = await supabase
                .from('users')
                .select('user_id, full_name, class_id, classes(name)')
                .in('user_id', studentIds)

            const parentsMap = new Map((parentsData || []).map(p => [p.user_id, p]))
            const studentsMap = new Map((studentsData || []).map((s: any) => [
                s.user_id,
                { ...s, class_name: s.classes?.name }
            ]))

            // Group messages by parent + student
            const conversationMap = new Map<string, Conversation>()

            messagesData.forEach((msg: Message) => {
                const key = `${msg.parent_id}-${msg.student_id}`

                if (!conversationMap.has(key)) {
                    const parent = parentsMap.get(msg.parent_id)
                    const student = studentsMap.get(msg.student_id)

                    if (parent && student) {
                        conversationMap.set(key, {
                            parent,
                            student,
                            lastMessage: msg,
                            unreadCount: (!msg.is_read && msg.sender_role === 'parent') ? 1 : 0
                        })
                    }
                } else {
                    const conv = conversationMap.get(key)!
                    if (!msg.is_read && msg.sender_role === 'parent') {
                        conv.unreadCount++
                    }
                }
            })

            setConversations(Array.from(conversationMap.values()))
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadMessages() {
        if (!selectedConversation || !teacherId) return

        const { data } = await supabase
            .from('parent_teacher_messages')
            .select('*')
            .eq('teacher_id', teacherId)
            .eq('parent_id', selectedConversation.parent.user_id)
            .eq('student_id', selectedConversation.student.user_id)
            .order('created_at', { ascending: true })

        setMessages(data || [])

        // Mark parent's messages as read
        if (data && data.length > 0) {
            const unreadIds = data
                .filter(m => m.sender_role === 'parent' && !m.is_read)
                .map(m => m.message_id)

            if (unreadIds.length > 0) {
                await supabase
                    .from('parent_teacher_messages')
                    .update({ is_read: true, read_at: new Date().toISOString() })
                    .in('message_id', unreadIds)

                // Update conversation unread count
                setConversations(prev => prev.map(c => {
                    if (c.parent.user_id === selectedConversation.parent.user_id &&
                        c.student.user_id === selectedConversation.student.user_id) {
                        return { ...c, unreadCount: 0 }
                    }
                    return c
                }))
            }
        }
    }

    async function sendMessage() {
        if (!newMessage.trim() || !selectedConversation) return

        setSending(true)
        try {
            const { error } = await supabase
                .from('parent_teacher_messages')
                .insert({
                    parent_id: selectedConversation.parent.user_id,
                    teacher_id: teacherId,
                    student_id: selectedConversation.student.user_id,
                    sender_id: teacherId,
                    sender_role: 'teacher',
                    message: newMessage.trim()
                })

            if (error) throw error

            setNewMessage('')
            await loadMessages()
        } catch (error: any) {
            console.error('Error sending:', error)
            alert('Error: ' + error.message)
        } finally {
            setSending(false)
        }
    }

    function formatTime(dateStr: string) {
        const date = new Date(dateStr)
        const now = new Date()
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

        if (diffDays === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        } else if (diffDays === 1) {
            return 'Yesterday'
        } else {
            return date.toLocaleDateString()
        }
    }

    const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
                <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
            {/* Header */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={goBack} className="p-2 hover:bg-white/10 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-blue-300" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-white flex items-center gap-2">
                                <MessageCircle className="w-6 h-6 text-blue-400" />
                                Parent Messages
                            </h1>
                            <p className="text-sm text-blue-300/70">Communicate with parents about their children</p>
                        </div>
                    </div>

                    {totalUnread > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 rounded-full">
                            <Bell className="w-4 h-4 text-red-400" />
                            <span className="text-red-400 font-medium">{totalUnread} unread</span>
                        </div>
                    )}
                </div>
            </header>

            <div className="max-w-7xl mx-auto flex h-[calc(100vh-80px)]">
                {/* Sidebar - Conversations */}
                <div className="w-80 bg-white/5 border-r border-white/10 flex flex-col">
                    <div className="p-4 border-b border-white/10">
                        <h2 className="font-semibold text-white">Conversations</h2>
                        <p className="text-xs text-blue-300/70">{conversations.length} parent chats</p>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {conversations.length === 0 ? (
                            <div className="p-6 text-center">
                                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-blue-300/30" />
                                <p className="text-blue-300/70 text-sm">No messages yet</p>
                                <p className="text-blue-300/50 text-xs mt-1">Parents can message you</p>
                            </div>
                        ) : (
                            conversations.map((conv, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedConversation(conv)}
                                    className={`w-full p-4 text-left hover:bg-white/10 border-b border-white/10 ${selectedConversation?.parent.user_id === conv.parent.user_id &&
                                        selectedConversation?.student.user_id === conv.student.user_id
                                        ? 'bg-white/10'
                                        : ''
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                                                {conv.parent.full_name.charAt(0)}
                                            </div>
                                            {conv.unreadCount > 0 && (
                                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                                                    {conv.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-white truncate">{conv.parent.full_name}</p>
                                            <div className="flex items-center gap-1 text-xs text-blue-300/70">
                                                <Users className="w-3 h-3" />
                                                <span>About: {conv.student.full_name}</span>
                                            </div>
                                            {conv.student.class_name && (
                                                <span className="text-xs text-blue-400/70">{conv.student.class_name}</span>
                                            )}
                                            {conv.lastMessage && (
                                                <p className="text-sm text-blue-300/50 truncate mt-1">
                                                    {conv.lastMessage.sender_role === 'teacher' ? 'You: ' : ''}
                                                    {conv.lastMessage.message}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col">
                    {selectedConversation ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 bg-white/5 border-b border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                                        {selectedConversation.parent.full_name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-medium text-white">{selectedConversation.parent.full_name}</p>
                                        <div className="flex items-center gap-2 text-xs text-blue-300/70">
                                            <Users className="w-3 h-3" />
                                            <span>Parent of {selectedConversation.student.full_name}</span>
                                            {selectedConversation.student.class_name && (
                                                <>
                                                    <span>•</span>
                                                    <span>{selectedConversation.student.class_name}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {messages.length === 0 ? (
                                    <div className="text-center py-12">
                                        <MessageCircle className="w-12 h-12 mx-auto mb-3 text-blue-300/30" />
                                        <p className="text-blue-300/70">No messages yet</p>
                                    </div>
                                ) : (
                                    messages.map(msg => (
                                        <div
                                            key={msg.message_id}
                                            className={`flex ${msg.sender_role === 'teacher' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[70%] p-3 rounded-2xl ${msg.sender_role === 'teacher'
                                                    ? 'bg-blue-600 text-white rounded-br-sm'
                                                    : 'bg-white/10 text-white rounded-bl-sm'
                                                    }`}
                                            >
                                                <p className="whitespace-pre-wrap">{msg.message}</p>
                                                <div className={`flex items-center gap-1 mt-1 text-xs ${msg.sender_role === 'teacher' ? 'text-blue-200' : 'text-blue-300/70'
                                                    }`}>
                                                    <Clock className="w-3 h-3" />
                                                    {formatTime(msg.created_at)}
                                                    {msg.sender_role === 'teacher' && (
                                                        msg.is_read
                                                            ? <CheckCheck className="w-3 h-3 ml-1" />
                                                            : <Check className="w-3 h-3 ml-1" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message Input */}
                            <div className="p-4 bg-white/5 border-t border-white/10">
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        placeholder="Type a message..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                        className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300/50"
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={sending || !newMessage.trim()}
                                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* No chat selected */
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <MessageCircle className="w-20 h-20 mx-auto mb-4 text-blue-300/30" />
                                <h3 className="text-xl font-bold text-white mb-2">Select a conversation</h3>
                                <p className="text-blue-300/70">Choose a parent message to respond</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

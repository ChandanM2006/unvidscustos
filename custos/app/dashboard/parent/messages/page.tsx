'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, MessageCircle, Send, User, Search,
    Loader2, ChevronDown, Users, Clock, Check, CheckCheck
} from 'lucide-react'

interface Child {
    user_id: string
    full_name: string
    class_name?: string
}

interface Teacher {
    user_id: string
    full_name: string
    email: string
    subjects?: string[]
}

interface Message {
    message_id: string
    parent_id: string
    teacher_id: string
    student_id: string
    sender_id: string
    sender_role: 'parent' | 'teacher'
    subject?: string
    message: string
    is_read: boolean
    created_at: string
}

interface Conversation {
    teacher: Teacher
    child: Child
    lastMessage?: Message
    unreadCount: number
}

export default function ParentMessagesPage() {
    const router = useRouter()
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [parentId, setParentId] = useState('')

    // Data
    const [children, setChildren] = useState<Child[]>([])
    const [teachers, setTeachers] = useState<Teacher[]>([])
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [messages, setMessages] = useState<Message[]>([])

    // Selection
    const [selectedChild, setSelectedChild] = useState<Child | null>(null)
    const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
    const [newMessage, setNewMessage] = useState('')

    // New conversation mode
    const [showNewChat, setShowNewChat] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        if (selectedChild && selectedTeacher && parentId) {
            loadMessages()
        }
    }, [selectedChild, selectedTeacher, parentId])

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
                .select('user_id, role, school_id')
                .eq('email', session.user.email)
                .single()

            if (!userData || userData.role !== 'parent') {
                router.push('/login')
                return
            }

            setParentId(userData.user_id)

            // Load linked children
            const { data: linksData } = await supabase
                .from('parent_student_links')
                .select('student_id')
                .eq('parent_id', userData.user_id)

            if (linksData && linksData.length > 0) {
                const studentIds = linksData.map(l => l.student_id)

                const { data: childrenData } = await supabase
                    .from('users')
                    .select('user_id, full_name, class_id, classes(name)')
                    .in('user_id', studentIds)

                const formattedChildren = (childrenData || []).map((c: any) => ({
                    user_id: c.user_id,
                    full_name: c.full_name,
                    class_name: c.classes?.name
                }))

                setChildren(formattedChildren)
                if (formattedChildren.length > 0) {
                    setSelectedChild(formattedChildren[0])
                }
            }

            // Load all teachers
            const { data: teachersData } = await supabase
                .from('users')
                .select('user_id, full_name, email')
                .eq('role', 'teacher')
                .eq('school_id', userData.school_id)
                .order('full_name')

            setTeachers(teachersData || [])

            // Load existing conversations (messages grouped by teacher+child)
            await loadConversations(userData.user_id)

        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadConversations(pId: string) {
        const { data: messagesData } = await supabase
            .from('parent_teacher_messages')
            .select('*')
            .eq('parent_id', pId)
            .order('created_at', { ascending: false })

        if (!messagesData || messagesData.length === 0) return

        // Group by teacher + child
        const conversationMap = new Map<string, Conversation>()

        messagesData.forEach((msg: Message) => {
            const key = `${msg.teacher_id}-${msg.student_id}`

            if (!conversationMap.has(key)) {
                const teacher = teachers.find(t => t.user_id === msg.teacher_id)
                const child = children.find(c => c.user_id === msg.student_id)

                if (teacher && child) {
                    conversationMap.set(key, {
                        teacher,
                        child,
                        lastMessage: msg,
                        unreadCount: (!msg.is_read && msg.sender_role === 'teacher') ? 1 : 0
                    })
                }
            } else {
                const conv = conversationMap.get(key)!
                if (!msg.is_read && msg.sender_role === 'teacher') {
                    conv.unreadCount++
                }
            }
        })

        setConversations(Array.from(conversationMap.values()))
    }

    async function loadMessages() {
        if (!selectedChild || !selectedTeacher || !parentId) return

        const { data } = await supabase
            .from('parent_teacher_messages')
            .select('*')
            .eq('parent_id', parentId)
            .eq('teacher_id', selectedTeacher.user_id)
            .eq('student_id', selectedChild.user_id)
            .order('created_at', { ascending: true })

        setMessages(data || [])

        // Mark teacher's messages as read
        if (data && data.length > 0) {
            const unreadIds = data
                .filter(m => m.sender_role === 'teacher' && !m.is_read)
                .map(m => m.message_id)

            if (unreadIds.length > 0) {
                await supabase
                    .from('parent_teacher_messages')
                    .update({ is_read: true, read_at: new Date().toISOString() })
                    .in('message_id', unreadIds)
            }
        }
    }

    async function sendMessage() {
        if (!newMessage.trim() || !selectedTeacher || !selectedChild) return

        setSending(true)
        try {
            const { error } = await supabase
                .from('parent_teacher_messages')
                .insert({
                    parent_id: parentId,
                    teacher_id: selectedTeacher.user_id,
                    student_id: selectedChild.user_id,
                    sender_id: parentId,
                    sender_role: 'parent',
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

    function selectConversation(conv: Conversation) {
        setSelectedTeacher(conv.teacher)
        setSelectedChild(conv.child)
        setShowNewChat(false)
    }

    function startNewChat() {
        setShowNewChat(true)
        setSelectedTeacher(null)
        setMessages([])
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

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
                <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Header */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/dashboard/parent')} className="p-2 hover:bg-white/10 rounded-lg">
                            <ArrowLeft className="w-5 h-5 text-purple-300" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-white flex items-center gap-2">
                                <MessageCircle className="w-6 h-6 text-purple-400" />
                                Messages
                            </h1>
                            <p className="text-sm text-purple-300/70">Chat with your child's teachers</p>
                        </div>
                    </div>

                    {/* Child Selector */}
                    {children.length > 1 && selectedChild && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-purple-300/70">About:</span>
                            <select
                                value={selectedChild.user_id}
                                onChange={(e) => {
                                    const child = children.find(c => c.user_id === e.target.value)
                                    setSelectedChild(child || null)
                                }}
                                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                            >
                                {children.map(child => (
                                    <option key={child.user_id} value={child.user_id} className="bg-slate-800">
                                        {child.full_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </header>

            <div className="max-w-7xl mx-auto flex h-[calc(100vh-80px)]">
                {/* Sidebar - Conversations */}
                <div className="w-80 bg-white/5 border-r border-white/10 flex flex-col">
                    <div className="p-4 border-b border-white/10">
                        <button
                            onClick={startNewChat}
                            className="w-full py-3 bg-purple-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-purple-700"
                        >
                            <MessageCircle className="w-5 h-5" />
                            New Message
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {conversations.length === 0 ? (
                            <div className="p-6 text-center">
                                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-purple-300/30" />
                                <p className="text-purple-300/70 text-sm">No conversations yet</p>
                                <p className="text-purple-300/50 text-xs mt-1">Start a chat with a teacher</p>
                            </div>
                        ) : (
                            conversations.map((conv, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => selectConversation(conv)}
                                    className={`w-full p-4 text-left hover:bg-white/10 border-b border-white/10 ${selectedTeacher?.user_id === conv.teacher.user_id &&
                                            selectedChild?.user_id === conv.child.user_id
                                            ? 'bg-white/10'
                                            : ''
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                                            {conv.teacher.full_name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="font-medium text-white truncate">{conv.teacher.full_name}</p>
                                                {conv.unreadCount > 0 && (
                                                    <span className="w-5 h-5 bg-purple-500 rounded-full text-xs text-white flex items-center justify-center">
                                                        {conv.unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-purple-300/70">
                                                Re: {conv.child.full_name}
                                            </p>
                                            {conv.lastMessage && (
                                                <p className="text-sm text-purple-300/50 truncate mt-1">
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
                    {showNewChat ? (
                        /* New Chat Mode */
                        <div className="p-6">
                            <h2 className="text-lg font-bold text-white mb-4">Start a new conversation</h2>

                            {!selectedChild ? (
                                <div className="mb-4">
                                    <label className="block text-sm text-purple-300/70 mb-2">Select Child</label>
                                    <div className="space-y-2">
                                        {children.map(child => (
                                            <button
                                                key={child.user_id}
                                                onClick={() => setSelectedChild(child)}
                                                className="w-full p-3 bg-white/10 rounded-lg text-left hover:bg-white/20"
                                            >
                                                <p className="font-medium text-white">{child.full_name}</p>
                                                <p className="text-sm text-purple-300/70">{child.class_name}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-4 p-3 bg-white/10 rounded-lg">
                                    <p className="text-sm text-purple-300/70">Regarding:</p>
                                    <p className="font-medium text-white">{selectedChild.full_name}</p>
                                </div>
                            )}

                            {selectedChild && (
                                <>
                                    <label className="block text-sm text-purple-300/70 mb-2">Select Teacher</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {teachers.map(teacher => (
                                            <button
                                                key={teacher.user_id}
                                                onClick={() => {
                                                    setSelectedTeacher(teacher)
                                                    setShowNewChat(false)
                                                }}
                                                className="p-4 bg-white/10 rounded-xl text-left hover:bg-white/20"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                                                        {teacher.full_name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-white">{teacher.full_name}</p>
                                                        <p className="text-xs text-purple-300/70">{teacher.email}</p>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    ) : selectedTeacher && selectedChild ? (
                        /* Chat conversation */
                        <>
                            {/* Chat Header */}
                            <div className="p-4 bg-white/5 border-b border-white/10 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                                    {selectedTeacher.full_name.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-medium text-white">{selectedTeacher.full_name}</p>
                                    <p className="text-xs text-purple-300/70">About: {selectedChild.full_name}</p>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {messages.length === 0 ? (
                                    <div className="text-center py-12">
                                        <MessageCircle className="w-12 h-12 mx-auto mb-3 text-purple-300/30" />
                                        <p className="text-purple-300/70">No messages yet</p>
                                        <p className="text-purple-300/50 text-sm mt-1">Start the conversation</p>
                                    </div>
                                ) : (
                                    messages.map(msg => (
                                        <div
                                            key={msg.message_id}
                                            className={`flex ${msg.sender_role === 'parent' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[70%] p-3 rounded-2xl ${msg.sender_role === 'parent'
                                                        ? 'bg-purple-600 text-white rounded-br-sm'
                                                        : 'bg-white/10 text-white rounded-bl-sm'
                                                    }`}
                                            >
                                                <p className="whitespace-pre-wrap">{msg.message}</p>
                                                <div className={`flex items-center gap-1 mt-1 text-xs ${msg.sender_role === 'parent' ? 'text-purple-200' : 'text-purple-300/70'
                                                    }`}>
                                                    <Clock className="w-3 h-3" />
                                                    {formatTime(msg.created_at)}
                                                    {msg.sender_role === 'parent' && (
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
                                        className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50"
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={sending || !newMessage.trim()}
                                        className="px-6 py-3 bg-purple-600 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-purple-700 disabled:opacity-50"
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
                                <MessageCircle className="w-20 h-20 mx-auto mb-4 text-purple-300/30" />
                                <h3 className="text-xl font-bold text-white mb-2">Select a conversation</h3>
                                <p className="text-purple-300/70">or start a new one</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

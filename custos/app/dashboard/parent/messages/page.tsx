'use client'

import { useState, useEffect, useRef } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, MessageCircle, Send, Loader2,
    Clock, Check, CheckCheck, BookOpen, ChevronDown
} from 'lucide-react'

interface Child {
    user_id: string
    full_name: string
    class_id?: string
    class_name?: string
}

interface Teacher {
    user_id: string
    full_name: string
    email: string
    subjects: string[]   // subject names this teacher teaches
    is_class_teacher: boolean  // true if this teacher is assigned as class teacher for the child's class
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
    teacher: Teacher
    child: Child
    lastMessage?: Message
    unreadCount: number
}

export default function ParentMessagesPage() {
    const { goBack, router } = useSmartBack('/dashboard/parent')
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [parentId, setParentId] = useState('')

    const [children, setChildren] = useState<Child[]>([])
    const [teachers, setTeachers] = useState<Teacher[]>([])
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [messages, setMessages] = useState<Message[]>([])

    // Auto-selected child (first linked child by default)
    const [selectedChild, setSelectedChild] = useState<Child | null>(null)
    const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
    const [newMessage, setNewMessage] = useState('')
    const [showNewChat, setShowNewChat] = useState(false)

    useEffect(() => { loadData() }, [])

    useEffect(() => {
        if (selectedChild && selectedTeacher && parentId) loadMessages()
    }, [selectedChild, selectedTeacher, parentId])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    async function loadData() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return }

            const { data: userData } = await supabase
                .from('users')
                .select('user_id, role, school_id')
                .eq('email', session.user.email)
                .single()

            if (!userData || userData.role !== 'parent') { router.push('/login'); return }

            setParentId(userData.user_id)

            // ── 1. Load linked children via API (bypasses RLS) ────────────────
            const childrenRes = await fetch(`/api/parent/children?parentId=${userData.user_id}`)
            let loadedChildren: Child[] = []
            if (childrenRes.ok) {
                const childrenJson = await childrenRes.json()
                loadedChildren = (childrenJson.children || []).map((c: any) => ({
                    user_id: c.student_id,
                    full_name: c.full_name,
                    class_id: c.class_id || '',
                    class_name: c.class_name || ''
                }))
            }

            // Fallback: direct DB query if API didn't return data
            if (loadedChildren.length === 0) {
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

                    loadedChildren = (childrenData || []).map((c: any) => ({
                        user_id: c.user_id,
                        full_name: c.full_name,
                        class_id: c.class_id,
                        class_name: c.classes?.name || ''
                    }))
                }
            }

            setChildren(loadedChildren)
            if (loadedChildren.length > 0) setSelectedChild(loadedChildren[0])

            // ── 2. Load teachers with their subjects ─────────────────────────
            // Also fetch class_id to identify class teachers
            const { data: teachersData } = await supabase
                .from('users')
                .select('user_id, full_name, email, class_id, section_id')
                .eq('role', 'teacher')
                .eq('school_id', userData.school_id)
                .order('full_name')

            const teacherIds = (teachersData || []).map((t: any) => t.user_id)

            // Determine child's class for class teacher matching
            const childClassId = loadedChildren.length > 0 ? loadedChildren[0].class_id : null

            // Fetch teacher → subject mappings via timetable_entries
            let subjectMap: Record<string, string[]> = {}
            if (teacherIds.length > 0) {
                let query = supabase
                    .from('timetable_entries')
                    .select('teacher_id, subject_id')
                    .in('teacher_id', teacherIds)
                    
                if (childClassId) {
                    query = query.eq('class_id', childClassId)
                }
                
                const { data: ttData } = await query

                if (ttData && ttData.length > 0) {
                    const subjectIds = [...new Set(ttData.map(t => t.subject_id).filter(Boolean))]
                    
                    if (subjectIds.length > 0) {
                        const { data: subjectsData } = await supabase
                            .from('subjects')
                            .select('subject_id, name')
                            .in('subject_id', subjectIds)
                            
                        const subNameMap = new Map((subjectsData || []).map((s: any) => [s.subject_id, s.name]))
                        
                        ttData.forEach((tt: any) => {
                            if (tt.teacher_id && tt.subject_id) {
                                const subjectName = subNameMap.get(tt.subject_id)
                                if (subjectName) {
                                    if (!subjectMap[tt.teacher_id]) subjectMap[tt.teacher_id] = []
                                    if (!subjectMap[tt.teacher_id].includes(subjectName)) {
                                        subjectMap[tt.teacher_id].push(subjectName)
                                    }
                                }
                            }
                        })
                    }
                }
            }
            const enrichedTeachers: Teacher[] = (teachersData || []).map((t: any) => ({
                user_id: t.user_id,
                full_name: t.full_name,
                email: t.email,
                subjects: subjectMap[t.user_id] || [],
                is_class_teacher: !!(childClassId && t.class_id === childClassId)
            }))

            // Sort: class teachers first
            enrichedTeachers.sort((a, b) => {
                if (a.is_class_teacher && !b.is_class_teacher) return -1
                if (!a.is_class_teacher && b.is_class_teacher) return 1
                return 0
            })

            setTeachers(enrichedTeachers)

            // ── 3. Load existing conversations ───────────────────────────────
            await loadConversations(userData.user_id, loadedChildren, enrichedTeachers)

            // ── 4. Check URL for direct teacher link (e.g. ?teacherId=xxx) ──
            const urlParams = new URLSearchParams(window.location.search)
            const directTeacherId = urlParams.get('teacherId')
            if (directTeacherId && loadedChildren.length > 0) {
                const targetTeacher = enrichedTeachers.find(t => t.user_id === directTeacherId)
                if (targetTeacher) {
                    setSelectedTeacher(targetTeacher)
                    setShowNewChat(false)
                    // Clean up URL so refreshing doesn't re-trigger
                    window.history.replaceState({}, '', '/dashboard/parent/messages')
                }
            }

        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadConversations(pId: string, kids: Child[], tchrs: Teacher[]) {
        const { data: messagesData } = await supabase
            .from('parent_teacher_messages')
            .select('*')
            .eq('parent_id', pId)
            .order('created_at', { ascending: false })

        if (!messagesData || messagesData.length === 0) return

        const conversationMap = new Map<string, Conversation>()
        messagesData.forEach((msg: Message) => {
            const key = `${msg.teacher_id}-${msg.student_id}`
            if (!conversationMap.has(key)) {
                const teacher = tchrs.find(t => t.user_id === msg.teacher_id)
                const child = kids.find(c => c.user_id === msg.student_id)
                if (teacher && child) {
                    conversationMap.set(key, {
                        teacher, child, lastMessage: msg,
                        unreadCount: (!msg.is_read && msg.sender_role === 'teacher') ? 1 : 0
                    })
                }
            } else {
                const conv = conversationMap.get(key)!
                if (!msg.is_read && msg.sender_role === 'teacher') conv.unreadCount++
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

        // Mark teacher messages as read
        const unreadIds = (data || [])
            .filter(m => m.sender_role === 'teacher' && !m.is_read)
            .map(m => m.message_id)
        if (unreadIds.length > 0) {
            await supabase
                .from('parent_teacher_messages')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .in('message_id', unreadIds)
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
        const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        if (diffDays === 1) return 'Yesterday'
        return date.toLocaleDateString()
    }

    console.log('[MSG] RENDER:', { showNewChat, selectedTeacher: selectedTeacher?.full_name || null, selectedChild: selectedChild?.full_name || null, loading })

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
                <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">

            {/* ── Header ───────────────────────────────────────────────────── */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={goBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
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

                    {/* Child switcher — only shown when parent has multiple children */}
                    {children.length > 1 && selectedChild && (
                        <div className="flex items-center gap-2 bg-white/10 rounded-xl px-1 py-1">
                            {children.map(child => (
                                <button
                                    key={child.user_id}
                                    onClick={() => setSelectedChild(child)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedChild.user_id === child.user_id
                                        ? 'bg-purple-600 text-white shadow'
                                        : 'text-purple-300/70 hover:text-white'
                                        }`}
                                >
                                    {child.full_name.split(' ')[0]}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </header>

            <div className="max-w-7xl mx-auto flex h-[calc(100vh-80px)]">

                {/* ── Sidebar ──────────────────────────────────────────────── */}
                <div className="w-80 bg-white/5 border-r border-white/10 flex flex-col">
                    <div className="p-4 border-b border-white/10">
                        <button
                            onClick={startNewChat}
                            className="w-full py-3 bg-purple-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors"
                        >
                            <MessageCircle className="w-5 h-5" />
                            New Message
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {conversations.length === 0 ? (
                            <div className="p-6 text-center mt-8">
                                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-purple-300/20" />
                                <p className="text-purple-300/60 text-sm">No conversations yet</p>
                                <p className="text-purple-300/40 text-xs mt-1">Start a chat with a teacher</p>
                            </div>
                        ) : (
                            conversations.map((conv, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => selectConversation(conv)}
                                    className={`w-full p-4 text-left hover:bg-white/10 border-b border-white/5 transition-colors ${selectedTeacher?.user_id === conv.teacher.user_id &&
                                        selectedChild?.user_id === conv.child.user_id
                                        ? 'bg-white/10 border-l-2 border-l-purple-500'
                                        : ''
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                            {conv.teacher.full_name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <p className="font-medium text-white truncate text-sm">{conv.teacher.full_name}</p>
                                                {conv.unreadCount > 0 && (
                                                    <span className="w-5 h-5 bg-purple-500 rounded-full text-[10px] text-white flex items-center justify-center flex-shrink-0">
                                                        {conv.unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                            {conv.teacher.subjects.length > 0 && (
                                                <p className="text-[10px] text-purple-400/70 mb-0.5">
                                                    {conv.teacher.subjects.slice(0, 2).join(' • ')}
                                                </p>
                                            )}
                                            {conv.lastMessage && (
                                                <p className="text-xs text-purple-300/50 truncate">{conv.lastMessage.message}</p>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* ── Main Area ─────────────────────────────────────────────── */}
                <div className="flex-1 flex flex-col">

                    {showNewChat ? (
                        /* ── New Chat: Pick a Teacher ──────────────────────── */
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="max-w-2xl mx-auto">
                                {/* Regarding child pill */}
                                {selectedChild && (
                                    <div className="mb-6 flex items-center gap-3 bg-white/10 border border-white/10 rounded-xl px-4 py-3">
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                            {selectedChild.full_name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-xs text-purple-300/60">Messaging about</p>
                                            <p className="font-semibold text-white">{selectedChild.full_name}</p>
                                            {selectedChild.class_name && (
                                                <p className="text-xs text-purple-300/50">{selectedChild.class_name}</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <h2 className="text-base font-semibold text-white mb-1">Choose a teacher to message</h2>
                                <p className="text-sm text-purple-300/60 mb-4">Your child&apos;s class teacher is shown first</p>

                                {teachers.length === 0 ? (
                                    <div className="text-center py-12">
                                        <p className="text-purple-300/50">No teachers found in this school.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {teachers.map(teacher => (
                                            <button
                                                key={teacher.user_id}
                                                onClick={() => {
                                                    setSelectedTeacher(teacher)
                                                    setShowNewChat(false)
                                                }}
                                                className={`p-4 ${teacher.is_class_teacher ? 'bg-fuchsia-500/10 border-fuchsia-500/30' : 'bg-white/[0.07] border-white/10'} hover:bg-white/[0.13] border hover:border-purple-500/40 rounded-2xl text-left transition-all group`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                                                        {teacher.full_name.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-semibold text-white">{teacher.full_name}</p>
                                                            {teacher.is_class_teacher && (
                                                                <span className="px-2 py-0.5 bg-fuchsia-500/30 border border-fuchsia-500/40 rounded-full text-[10px] font-bold text-fuchsia-300">
                                                                    Class Teacher
                                                                </span>
                                                            )}
                                                        </div>
                                                        {teacher.subjects.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                                {teacher.subjects.map(sub => (
                                                                    <span
                                                                        key={sub}
                                                                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-[10px] font-medium text-purple-300"
                                                                    >
                                                                        <BookOpen className="w-2.5 h-2.5" />
                                                                        {sub}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-purple-300/40 mt-1">{teacher.is_class_teacher ? 'Class Teacher' : 'Teacher'}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                    ) : selectedTeacher && selectedChild ? (
                        /* ── Active Chat ──────────────────────────────────── */
                        <>
                            {/* Chat Header */}
                            <div className="p-4 bg-white/5 border-b border-white/10 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                                    {selectedTeacher.full_name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-white">{selectedTeacher.full_name}</p>
                                    <div className="flex items-center gap-2">
                                        {selectedTeacher.subjects.length > 0 && (
                                            <div className="flex gap-1">
                                                {selectedTeacher.subjects.slice(0, 3).map(sub => (
                                                    <span key={sub} className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded-full">
                                                        {sub}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <span className="text-xs text-purple-300/40">
                                            Re: {selectedChild.full_name}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {messages.length === 0 ? (
                                    <div className="text-center py-16">
                                        <MessageCircle className="w-12 h-12 mx-auto mb-3 text-purple-300/20" />
                                        <p className="text-purple-300/60">Start the conversation</p>
                                        <p className="text-purple-300/40 text-sm mt-1">
                                            Ask {selectedTeacher.full_name} about {selectedChild.full_name}'s progress
                                        </p>
                                    </div>
                                ) : (
                                    messages.map(msg => (
                                        <div
                                            key={msg.message_id}
                                            className={`flex ${msg.sender_role === 'parent' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${msg.sender_role === 'parent'
                                                ? 'bg-purple-600 text-white rounded-br-sm'
                                                : 'bg-white/10 text-white rounded-bl-sm'
                                                }`}>
                                                <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                                                <div className={`flex items-center gap-1 mt-1 text-[10px] ${msg.sender_role === 'parent' ? 'text-purple-200/70 justify-end' : 'text-purple-300/50'
                                                    }`}>
                                                    <Clock className="w-2.5 h-2.5" />
                                                    {formatTime(msg.created_at)}
                                                    {msg.sender_role === 'parent' && (
                                                        msg.is_read
                                                            ? <CheckCheck className="w-3 h-3 ml-1 text-cyan-300" />
                                                            : <Check className="w-3 h-3 ml-1 opacity-50" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <div className="p-4 bg-white/5 border-t border-white/10">
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        placeholder={`Message ${selectedTeacher.full_name}...`}
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                        className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/40 focus:outline-none focus:border-purple-500/50 focus:bg-white/15 transition-all"
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={sending || !newMessage.trim()}
                                        className="px-5 py-3 bg-purple-600 text-white rounded-xl flex items-center gap-2 hover:bg-purple-700 disabled:opacity-40 transition-colors"
                                    >
                                        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                        </>

                    ) : (
                        /* ── Empty state ──────────────────────────────────── */
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-24 h-24 mx-auto mb-5 rounded-full bg-white/5 flex items-center justify-center">
                                    <MessageCircle className="w-12 h-12 text-purple-300/20" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Your conversations</h3>
                                <p className="text-purple-300/60 mb-6 max-w-xs mx-auto">
                                    Click <strong className="text-purple-300">New Message</strong> to contact a subject teacher about {selectedChild?.full_name || 'your child'}.
                                </p>
                                <button
                                    onClick={startNewChat}
                                    className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors inline-flex items-center gap-2"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    New Message
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

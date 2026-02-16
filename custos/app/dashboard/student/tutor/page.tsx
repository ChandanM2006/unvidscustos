'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Send, Loader2, Camera, Mic, Bot, User,
    Brain, Sparkles, AlertTriangle, BookOpen, ChevronDown, X,
    MessageSquare, Plus, Clock
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────

interface ChatMessage {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    photo_url?: string
    timestamp: Date
    isStreaming?: boolean
}

interface ChatSession {
    session_id: string
    topic_id: string | null
    title: string
    created_at: string
}

interface TopicOption {
    topic_id: string
    topic_name: string
}

// ─── Component ──────────────────────────────────────────

function TutorPageInner() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const initialDoubtId = searchParams.get('doubt_id')

    const [loading, setLoading] = useState(true)
    const [studentId, setStudentId] = useState('')
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [inputText, setInputText] = useState('')
    const [isStreaming, setIsStreaming] = useState(false)
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
    const [topics, setTopics] = useState<TopicOption[]>([])
    const [showTopicPicker, setShowTopicPicker] = useState(false)
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [showSessions, setShowSessions] = useState(false)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // ─── Init ───────────────────────────────────────────

    useEffect(() => {
        initStudent()
    }, [])

    async function initStudent() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return }

            const { data: user } = await supabase
                .from('users')
                .select('user_id, role, class_id')
                .eq('email', session.user.email)
                .single()

            if (!user || user.role !== 'student') {
                router.push('/login')
                return
            }

            setStudentId(user.user_id)

            // Load topics for this student's class
            if (user.class_id) {
                const { data: subjects } = await supabase
                    .from('subjects')
                    .select('subject_id')
                    .eq('class_id', user.class_id)

                if (subjects && subjects.length > 0) {
                    const { data: docs } = await supabase
                        .from('syllabus_documents')
                        .select('document_id')
                        .in('subject_id', subjects.map(s => s.subject_id))

                    if (docs && docs.length > 0) {
                        const { data: topicData } = await supabase
                            .from('lesson_topics')
                            .select('topic_id, topic_name')
                            .in('document_id', docs.map(d => d.document_id))
                            .order('topic_name')
                            .limit(50)

                        setTopics(topicData || [])
                    }
                }
            }

            // Load recent sessions
            const { data: sessionData } = await supabase
                .from('chat_sessions')
                .select('session_id, topic_id, title, created_at')
                .eq('student_id', user.user_id)
                .order('created_at', { ascending: false })
                .limit(10)

            setSessions(sessionData || [])

            // Load doubt if specified
            if (initialDoubtId) {
                const { data: doubt } = await supabase
                    .from('student_doubts')
                    .select('*, lesson_topics(topic_name)')
                    .eq('doubt_id', initialDoubtId)
                    .single()

                if (doubt) {
                    setMessages([
                        {
                            id: '1',
                            role: 'user',
                            content: doubt.doubt_text,
                            timestamp: new Date(doubt.created_at),
                        },
                        ...(doubt.ai_response ? [{
                            id: '2',
                            role: 'assistant' as const,
                            content: doubt.ai_response,
                            timestamp: new Date(doubt.created_at),
                        }] : []),
                        ...(doubt.teacher_response ? [{
                            id: '3',
                            role: 'assistant' as const,
                            content: `👨‍🏫 **Teacher Response:**\n\n${doubt.teacher_response}`,
                            timestamp: new Date(doubt.updated_at || doubt.created_at),
                        }] : []),
                    ])
                }
            } else {
                // Welcome message
                setMessages([{
                    id: 'welcome',
                    role: 'assistant',
                    content: `Hi there! 👋 I'm your AI tutor. Ask me anything about your subjects!\n\n💡 **Tips:**\n- Select a topic for better answers\n- Take a photo of a problem\n- I'll walk you through step by step\n\nWhat would you like to learn today?`,
                    timestamp: new Date(),
                }])
            }

            setLoading(false)
        } catch (err) {
            console.error('[Tutor] Init error:', err)
            setLoading(false)
        }
    }

    // ─── Scroll to bottom ───────────────────────────────

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // ─── Send message ───────────────────────────────────

    const sendMessage = useCallback(async () => {
        const text = inputText.trim()
        if (!text && !photoPreview) return
        if (isStreaming) return

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: text || 'What does this problem say?',
            photo_url: photoPreview || undefined,
            timestamp: new Date(),
        }

        setMessages(prev => [...prev, userMsg])
        setInputText('')
        setIsStreaming(true)

        // Add streaming placeholder
        const aiMsgId = (Date.now() + 1).toString()
        setMessages(prev => [...prev, {
            id: aiMsgId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isStreaming: true,
        }])

        try {
            const res = await fetch('/api/student/tutor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    session_id: currentSessionId,
                    topic_id: selectedTopic,
                    photo_data: photoPreview,
                    student_id: studentId,
                }),
            })

            if (!res.ok) throw new Error('Failed to get AI response')

            // Read SSE stream
            const reader = res.body!.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let fullText = ''
            let newSessionId = currentSessionId

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6))

                            if (data.done) {
                                if (data.session_id) {
                                    newSessionId = data.session_id
                                    setCurrentSessionId(data.session_id)
                                }
                                continue
                            }

                            if (data.text) {
                                fullText += data.text
                                if (data.session_id && !currentSessionId) {
                                    newSessionId = data.session_id
                                    setCurrentSessionId(data.session_id)
                                }

                                setMessages(prev => prev.map(m =>
                                    m.id === aiMsgId
                                        ? { ...m, content: fullText }
                                        : m
                                ))
                            }
                        } catch {
                            // Skip
                        }
                    }
                }
            }

            // Finalize message
            setMessages(prev => prev.map(m =>
                m.id === aiMsgId
                    ? { ...m, isStreaming: false }
                    : m
            ))

            setPhotoPreview(null)
        } catch (err) {
            console.error('[Tutor] Send error:', err)
            setMessages(prev => prev.map(m =>
                m.id === aiMsgId
                    ? { ...m, content: 'Sorry, I had trouble thinking. Please try again! 🤔', isStreaming: false }
                    : m
            ))
        } finally {
            setIsStreaming(false)
            inputRef.current?.focus()
        }
    }, [inputText, photoPreview, isStreaming, currentSessionId, selectedTopic, studentId])

    // ─── Photo upload ───────────────────────────────────

    function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1]
            setPhotoPreview(base64)
        }
        reader.readAsDataURL(file)
    }

    // ─── Load session ───────────────────────────────────

    async function loadSession(sessionId: string) {
        setShowSessions(false)
        setCurrentSessionId(sessionId)

        const { data: msgs } = await supabase
            .from('chat_messages')
            .select('message_id, role, content, photo_url, created_at')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true })

        if (msgs) {
            setMessages(msgs.map(m => ({
                id: m.message_id,
                role: m.role as 'user' | 'assistant',
                content: m.content,
                photo_url: m.photo_url || undefined,
                timestamp: new Date(m.created_at),
            })))
        }
    }

    // ─── New chat ───────────────────────────────────────

    function startNewChat() {
        setCurrentSessionId(null)
        setSelectedTopic(null)
        setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: `Hi again! 👋 Ready for a new question?\n\n💡 Pick a topic or just ask away!`,
            timestamp: new Date(),
        }])
        setShowSessions(false)
        inputRef.current?.focus()
    }

    // ─── Keyboard ───────────────────────────────────────

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    // ─── Format time ────────────────────────────────────

    function formatTime(date: Date): string {
        return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    }

    // ─── Loading ────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900">
                <div className="text-center">
                    <Bot className="w-12 h-12 text-indigo-400 animate-bounce mx-auto mb-4" />
                    <p className="text-indigo-300/70">Loading AI Tutor...</p>
                </div>
            </div>
        )
    }

    // ─── Render ─────────────────────────────────────────

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex flex-col">
            {/* Header */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-4 py-3 flex items-center justify-between z-20">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push('/dashboard/student')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-indigo-300" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-white">AI Tutor</h1>
                            <p className="text-[10px] text-indigo-300/60">
                                {isStreaming ? '✨ Thinking...' : '🟢 Online'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Topic selector */}
                    <button
                        onClick={() => setShowTopicPicker(!showTopicPicker)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-all ${selectedTopic
                            ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/50'
                            : 'bg-white/5 text-indigo-300/60 border border-white/10'
                            }`}
                    >
                        <BookOpen className="w-3 h-3" />
                        {selectedTopic
                            ? topics.find(t => t.topic_id === selectedTopic)?.topic_name?.substring(0, 12) || 'Topic'
                            : 'Topic'
                        }
                    </button>

                    {/* History / New chat */}
                    <button
                        onClick={() => setShowSessions(!showSessions)}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <Clock className="w-4 h-4 text-indigo-300/60" />
                    </button>
                    <button
                        onClick={startNewChat}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <Plus className="w-4 h-4 text-indigo-300/60" />
                    </button>
                </div>
            </header>

            {/* Topic Picker Dropdown */}
            {showTopicPicker && (
                <div className="absolute top-14 right-4 z-30 bg-slate-800/95 backdrop-blur-lg border border-white/10 rounded-xl shadow-2xl w-72 max-h-64 overflow-y-auto">
                    <div className="p-2 border-b border-white/10">
                        <button
                            onClick={() => { setSelectedTopic(null); setShowTopicPicker(false) }}
                            className="w-full text-left px-3 py-2 text-xs text-indigo-300/70 hover:bg-white/10 rounded-lg"
                        >
                            🌐 All Topics (General Help)
                        </button>
                    </div>
                    <div className="p-2 space-y-0.5">
                        {topics.map(t => (
                            <button
                                key={t.topic_id}
                                onClick={() => { setSelectedTopic(t.topic_id); setShowTopicPicker(false) }}
                                className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-all ${selectedTopic === t.topic_id
                                    ? 'bg-indigo-500/30 text-indigo-300'
                                    : 'text-white/80 hover:bg-white/10'
                                    }`}
                            >
                                📚 {t.topic_name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Session History Dropdown */}
            {showSessions && (
                <div className="absolute top-14 right-4 z-30 bg-slate-800/95 backdrop-blur-lg border border-white/10 rounded-xl shadow-2xl w-72 max-h-64 overflow-y-auto">
                    <div className="p-3 border-b border-white/10">
                        <p className="text-xs font-semibold text-indigo-300">Recent Chats</p>
                    </div>
                    <div className="p-2 space-y-0.5">
                        {sessions.length === 0 ? (
                            <p className="text-xs text-indigo-300/40 text-center py-4">No previous chats</p>
                        ) : (
                            sessions.map(s => (
                                <button
                                    key={s.session_id}
                                    onClick={() => loadSession(s.session_id)}
                                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-white/10 transition-all"
                                >
                                    <p className="text-white/80 truncate">{s.title}</p>
                                    <p className="text-indigo-300/40 text-[10px]">
                                        {new Date(s.created_at).toLocaleDateString('en-IN', {
                                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </p>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* ─── Messages ──────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messages.map(msg => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                            {/* Avatar */}
                            <div className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${msg.role === 'user'
                                    ? 'bg-gradient-to-br from-cyan-500 to-blue-600'
                                    : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                                    }`}>
                                    {msg.role === 'user'
                                        ? <User className="w-3.5 h-3.5 text-white" />
                                        : <Bot className="w-3.5 h-3.5 text-white" />
                                    }
                                </div>

                                <div className={`rounded-2xl px-4 py-3 ${msg.role === 'user'
                                    ? 'bg-gradient-to-br from-cyan-600/40 to-blue-600/40 border border-cyan-500/20'
                                    : 'bg-white/10 border border-white/10'
                                    }`}>
                                    {/* Photo preview */}
                                    {msg.photo_url && (
                                        <div className="mb-2">
                                            <div className="bg-white/5 rounded-lg p-2 text-center">
                                                <Camera className="w-6 h-6 text-indigo-300/50 mx-auto mb-1" />
                                                <span className="text-[10px] text-indigo-300/50">Photo attached</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Message content with markdown-lite formatting */}
                                    <div className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed chat-content">
                                        {formatContent(msg.content)}
                                    </div>

                                    {/* Streaming indicator */}
                                    {msg.isStreaming && (
                                        <div className="flex items-center gap-1 mt-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse delay-100" />
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse delay-200" />
                                        </div>
                                    )}

                                    {/* Timestamp */}
                                    <p className={`text-[9px] mt-1 ${msg.role === 'user' ? 'text-cyan-300/40' : 'text-indigo-300/40'
                                        }`}>
                                        {formatTime(msg.timestamp)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                <div ref={messagesEndRef} />
            </div>

            {/* ─── Photo Preview ──────────────────────── */}
            {photoPreview && (
                <div className="px-4 py-2 bg-white/5 border-t border-white/10">
                    <div className="flex items-center gap-2">
                        <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                            <Camera className="w-5 h-5 text-indigo-300" />
                        </div>
                        <span className="text-xs text-indigo-300/70 flex-1">Photo ready to send</span>
                        <button
                            onClick={() => setPhotoPreview(null)}
                            className="p-1 hover:bg-white/10 rounded-lg"
                        >
                            <X className="w-4 h-4 text-red-400" />
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Teacher escalation notice ──────────── */}
            <div className="px-4 py-1.5 bg-amber-500/5 text-center">
                <p className="text-[10px] text-amber-300/50">
                    ⚠️ If you need more help, your teacher will be notified automatically
                </p>
            </div>

            {/* ─── Input Bar ─────────────────────────── */}
            <div className="bg-white/5 backdrop-blur-lg border-t border-white/10 px-4 py-3">
                <div className="flex items-end gap-2">
                    {/* Photo button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors shrink-0"
                    >
                        <Camera className="w-5 h-5 text-indigo-300/60" />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoUpload}
                        className="hidden"
                    />

                    {/* Text input */}
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask a question..."
                            rows={1}
                            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-indigo-300/40 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 max-h-24"
                            style={{ minHeight: '40px' }}
                        />
                    </div>

                    {/* Send button */}
                    <button
                        onClick={sendMessage}
                        disabled={isStreaming || (!inputText.trim() && !photoPreview)}
                        className={`p-2.5 rounded-xl shrink-0 transition-all ${isStreaming || (!inputText.trim() && !photoPreview)
                            ? 'bg-white/5 text-indigo-300/30'
                            : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50'
                            }`}
                    >
                        {isStreaming ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Content Formatter ──────────────────────────────────

function formatContent(text: string): React.ReactNode {
    if (!text) return null

    // Split by lines and format
    const lines = text.split('\n')
    return lines.map((line, i) => {
        // Bold: **text**
        let formatted: React.ReactNode = line
        const boldParts = line.split(/\*\*(.*?)\*\*/g)
        if (boldParts.length > 1) {
            formatted = boldParts.map((part, j) =>
                j % 2 === 1 ? <strong key={j} className="text-white font-semibold">{part}</strong> : part
            )
        }

        return (
            <span key={i}>
                {formatted}
                {i < lines.length - 1 && <br />}
            </span>
        )
    })
}

export default function TutorPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900">
                <Bot className="w-12 h-12 text-indigo-400 animate-bounce" />
            </div>
        }>
            <TutorPageInner />
        </Suspense>
    )
}

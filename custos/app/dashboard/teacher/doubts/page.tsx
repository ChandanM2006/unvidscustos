'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, MessageCircle, Send, Clock, AlertTriangle,
    CheckCircle, User, Loader2, ChevronDown, ChevronUp, Filter
} from 'lucide-react'

interface Doubt {
    doubt_id: string
    student_id: string
    student_name: string
    topic_name: string | null
    doubt_text: string
    ai_response: string | null
    teacher_response: string | null
    status: string
    flagged_for_teacher: boolean
    created_at: string
}

export default function TeacherDoubtsPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [doubts, setDoubts] = useState<Doubt[]>([])
    const [filter, setFilter] = useState<'all' | 'flagged' | 'pending' | 'answered'>('all')
    const [expandedDoubt, setExpandedDoubt] = useState<string | null>(null)
    const [responseText, setResponseText] = useState('')
    const [responding, setResponding] = useState(false)
    const [teacherId, setTeacherId] = useState('')

    const loadDoubts = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return }

            const { data: userData } = await supabase
                .from('users')
                .select('user_id, role')
                .eq('email', session.user.email)
                .single()

            if (!userData || userData.role !== 'teacher') { router.push('/dashboard'); return }
            setTeacherId(userData.user_id)

            // Fetch doubts with student names
            const { data: doubtData, error } = await supabase
                .from('student_doubts')
                .select(`
                    doubt_id, student_id, doubt_text, ai_response, teacher_response,
                    status, flagged_for_teacher, created_at,
                    users!student_doubts_student_id_fkey(full_name),
                    lesson_topics(topic_name)
                `)
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) {
                console.error('[Doubts] Load error:', error)
                // Fallback: try without join names
                const { data: fallbackData } = await supabase
                    .from('student_doubts')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50)

                if (fallbackData) {
                    setDoubts(fallbackData.map((d: any) => ({
                        doubt_id: d.doubt_id,
                        student_id: d.student_id,
                        student_name: 'Student',
                        topic_name: null,
                        doubt_text: d.doubt_text,
                        ai_response: d.ai_response,
                        teacher_response: d.teacher_response,
                        status: d.status,
                        flagged_for_teacher: d.flagged_for_teacher || false,
                        created_at: d.created_at,
                    })))
                }
            } else if (doubtData) {
                setDoubts(doubtData.map((d: any) => ({
                    doubt_id: d.doubt_id,
                    student_id: d.student_id,
                    student_name: d.users?.full_name || 'Unknown Student',
                    topic_name: d.lesson_topics?.topic_name || null,
                    doubt_text: d.doubt_text,
                    ai_response: d.ai_response,
                    teacher_response: d.teacher_response,
                    status: d.status,
                    flagged_for_teacher: d.flagged_for_teacher || false,
                    created_at: d.created_at,
                })))
            }
        } catch (error) {
            console.error('[Doubts] Error:', error)
        } finally {
            setLoading(false)
        }
    }, [router])

    useEffect(() => { loadDoubts() }, [loadDoubts])

    // ─── Respond to a doubt ─────────────────────────────

    async function handleRespond(doubtId: string) {
        if (!responseText.trim()) return
        setResponding(true)

        try {
            const res = await fetch('/api/teacher/doubts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    doubt_id: doubtId,
                    response_text: responseText.trim(),
                    teacher_id: teacherId,
                }),
            })

            if (res.ok) {
                setDoubts(prev => prev.map(d =>
                    d.doubt_id === doubtId
                        ? { ...d, teacher_response: responseText.trim(), status: 'teacher_answered' }
                        : d
                ))
                setResponseText('')
                setExpandedDoubt(null)
            }
        } catch (err) {
            console.error('[Doubts] Respond error:', err)
        } finally {
            setResponding(false)
        }
    }

    // ─── Filter ─────────────────────────────────────────

    const filteredDoubts = doubts.filter(d => {
        if (filter === 'flagged') return d.flagged_for_teacher
        if (filter === 'pending') return !d.teacher_response
        if (filter === 'answered') return !!d.teacher_response
        return true
    })

    const flaggedCount = doubts.filter(d => d.flagged_for_teacher).length
    const pendingCount = doubts.filter(d => !d.teacher_response).length

    // ─── Helpers ────────────────────────────────────────

    function formatTime(dateStr: string): string {
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

    function getStatusBadge(doubt: Doubt) {
        if (doubt.flagged_for_teacher && !doubt.teacher_response) {
            return <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Needs Help
            </span>
        }
        if (doubt.teacher_response) {
            return <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Answered
            </span>
        }
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full flex items-center gap-1">
            <MessageCircle className="w-3 h-3" /> AI Answered
        </span>
    }

    // ─── Render ─────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            {/* Header */}
            <header className="bg-white border-b shadow-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Student Doubts</h1>
                        <p className="text-sm text-gray-500">
                            {flaggedCount > 0 && <span className="text-red-600 font-medium">{flaggedCount} need attention • </span>}
                            {pendingCount} pending • {doubts.length} total
                        </p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6 space-y-4">
                {/* Filter Tabs */}
                <div className="flex gap-2">
                    {([
                        { key: 'all', label: 'All' },
                        { key: 'flagged', label: `🚨 Flagged (${flaggedCount})` },
                        { key: 'pending', label: `Pending (${pendingCount})` },
                        { key: 'answered', label: 'Answered' },
                    ] as const).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filter === tab.key
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Doubts List */}
                {filteredDoubts.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                        <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No doubts found for this filter</p>
                    </div>
                ) : (
                    filteredDoubts.map(doubt => (
                        <div key={doubt.doubt_id} className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-all ${doubt.flagged_for_teacher && !doubt.teacher_response
                                ? 'ring-2 ring-red-200'
                                : ''
                            }`}>
                            {/* Doubt Header */}
                            <button
                                onClick={() => setExpandedDoubt(
                                    expandedDoubt === doubt.doubt_id ? null : doubt.doubt_id
                                )}
                                className="w-full p-5 text-left hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1">
                                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                            <User className="w-5 h-5 text-indigo-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-semibold text-gray-900 text-sm">
                                                    {doubt.student_name}
                                                </p>
                                                {getStatusBadge(doubt)}
                                            </div>
                                            <p className="text-gray-700 line-clamp-2">{doubt.doubt_text}</p>
                                            <div className="flex items-center gap-3 mt-2">
                                                {doubt.topic_name && (
                                                    <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                                        {doubt.topic_name}
                                                    </span>
                                                )}
                                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatTime(doubt.created_at)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {expandedDoubt === doubt.doubt_id
                                        ? <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
                                        : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                                    }
                                </div>
                            </button>

                            {/* Expanded Content */}
                            {expandedDoubt === doubt.doubt_id && (
                                <div className="border-t">
                                    {/* AI Response */}
                                    {doubt.ai_response && (
                                        <div className="p-5 bg-blue-50/50">
                                            <p className="text-xs font-semibold text-blue-600 mb-2">🤖 AI Response</p>
                                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{doubt.ai_response}</p>
                                        </div>
                                    )}

                                    {/* Teacher Response */}
                                    {doubt.teacher_response ? (
                                        <div className="p-5 bg-green-50/50">
                                            <p className="text-xs font-semibold text-green-600 mb-2">👨‍🏫 Your Response</p>
                                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{doubt.teacher_response}</p>
                                        </div>
                                    ) : (
                                        <div className="p-5 border-t">
                                            <p className="text-xs font-semibold text-gray-500 mb-2">Write your response</p>
                                            <div className="flex gap-3">
                                                <input
                                                    type="text"
                                                    value={responseText}
                                                    onChange={e => setResponseText(e.target.value)}
                                                    placeholder="Type your response to the student..."
                                                    className="flex-1 px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                                                    onKeyDown={e => e.key === 'Enter' && handleRespond(doubt.doubt_id)}
                                                />
                                                <button
                                                    onClick={() => handleRespond(doubt.doubt_id)}
                                                    disabled={responding || !responseText.trim()}
                                                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    {responding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                    Send
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* View Student Profile */}
                                    <div className="p-3 bg-gray-50 border-t">
                                        <button
                                            onClick={() => router.push(`/dashboard/teacher/students/${doubt.student_id}`)}
                                            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                        >
                                            View Student Profile →
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </main>
        </div>
    )
}

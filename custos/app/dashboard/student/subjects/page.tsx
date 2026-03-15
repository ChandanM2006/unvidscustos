'use client'

import { useState, useEffect } from 'react'
import { supabase, type User } from '@/lib/supabase'
import { useSmartBack } from '@/lib/navigation'
import {
    BookOpen, ArrowLeft, FileText, Target, Loader2, Play
} from 'lucide-react'

interface Subject {
    subject_id: string
    name: string
    code: string
    description?: string
}

interface SyllabusDoc {
    document_id: string
    chapter_number: number
    chapter_title: string
}

export default function StudentSubjectsPage() {
    const { goBack, router } = useSmartBack('/dashboard/student')
    const [user, setUser] = useState<User | null>(null)
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [syllabusDocs, setSyllabusDocs] = useState<Record<string, SyllabusDoc[]>>({})
    const [loading, setLoading] = useState(true)
    const [expandedSubject, setExpandedSubject] = useState<string | null>(null)

    useEffect(() => {
        checkAuth()
    }, [])

    const checkAuth = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }

            const { data: userData } = await supabase
                .from('users')
                .select('*')
                .eq('email', session.user.email)
                .single()

            if (!userData || userData.role !== 'student') {
                router.push('/login')
                return
            }

            setUser(userData)
            await loadSubjects(userData)
        } catch (error) {
            console.error('Auth error:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadSubjects = async (userData: User) => {
        if (!userData.class_id) return

        try {
            // Load subjects for student's class
            const { data: subjectsData } = await supabase
                .from('subjects')
                .select('*')
                .eq('class_id', userData.class_id)
                .order('name')

            if (subjectsData) {
                setSubjects(subjectsData)

                // Load syllabus docs for each subject
                for (const subject of subjectsData) {
                    const { data: docs } = await supabase
                        .from('syllabus_documents')
                        .select('document_id, chapter_number, chapter_title')
                        .eq('subject_id', subject.subject_id)
                        .order('chapter_number')

                    if (docs) {
                        setSyllabusDocs(prev => ({
                            ...prev,
                            [subject.subject_id]: docs
                        }))
                    }
                }
            }
        } catch (error) {
            console.error('Error loading subjects:', error)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-green-900 to-slate-900">
                <Loader2 className="w-12 h-12 text-green-400 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900 to-slate-900">
            {/* Header */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                <div className="max-w-4xl mx-auto flex items-center gap-4">
                    <button
                        onClick={goBack}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-green-300" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <BookOpen className="w-6 h-6 text-green-400" />
                            My Subjects
                        </h1>
                        <p className="text-sm text-green-300/70">Explore your course content</p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6">
                {subjects.length === 0 ? (
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-12 text-center">
                        <BookOpen className="w-16 h-16 mx-auto mb-4 text-green-300/50" />
                        <h3 className="text-xl font-bold text-white mb-2">No Subjects Assigned</h3>
                        <p className="text-green-300/70">Your class hasn't been assigned any subjects yet.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {subjects.map((subject) => (
                            <div
                                key={subject.subject_id}
                                className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden"
                            >
                                {/* Subject Header */}
                                <button
                                    onClick={() => setExpandedSubject(
                                        expandedSubject === subject.subject_id ? null : subject.subject_id
                                    )}
                                    className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                                            <BookOpen className="w-6 h-6 text-white" />
                                            New
                                        </div>
                                        <div className="text-left">
                                            <h3 className="text-lg font-bold text-white">{subject.name}</h3>
                                            <p className="text-sm text-green-300/70">{subject.code}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm text-green-300/70">
                                            {syllabusDocs[subject.subject_id]?.length || 0} chapters
                                        </span>
                                        <div className={`transform transition-transform ${expandedSubject === subject.subject_id ? 'rotate-90' : ''}`}>
                                            <Play className="w-5 h-5 text-green-400 fill-green-400" />
                                        </div>
                                    </div>
                                </button>

                                {/* Expanded Content */}
                                {expandedSubject === subject.subject_id && (
                                    <div className="border-t border-white/10 p-5">
                                        {subject.description && (
                                            <p className="text-green-300/70 mb-4">{subject.description}</p>
                                        )}

                                        {syllabusDocs[subject.subject_id]?.length > 0 ? (
                                            <div className="space-y-2">
                                                <h4 className="text-sm font-medium text-green-200 mb-3">Chapters</h4>
                                                {syllabusDocs[subject.subject_id].map((doc) => (
                                                    <div
                                                        key={doc.document_id}
                                                        className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                                                    >
                                                        <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center text-green-400 font-bold text-sm">
                                                            {doc.chapter_number}
                                                        </div>
                                                        <span className="text-white">{doc.chapter_title}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-green-300/50 text-sm">No chapters uploaded for this subject yet.</p>
                                        )}

                                        {/* Actions */}
                                        <div className="flex gap-3 mt-4">
                                            <button
                                                onClick={() => router.push('/dashboard/resources')}
                                                className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 flex items-center gap-2"
                                            >
                                                <FileText className="w-4 h-4" />
                                                Study Materials
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}

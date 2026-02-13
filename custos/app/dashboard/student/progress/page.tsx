'use client'

import { useEffect, useState } from 'react'
import { supabase, type User } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
    Trophy, ArrowLeft, Loader2, Target, CheckCircle, Star, Calendar
} from 'lucide-react'

export default function StudentProgressPage() {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        mcqAttempts: 0,
        avgScore: 0,
        totalQuestions: 0,
        attendancePercent: 0,
        totalDays: 0,
        presentDays: 0
    })

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
            await loadProgress(userData)
        } catch (error) {
            console.error('Auth error:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadProgress = async (userData: User) => {
        try {
            // MCQ stats
            const { data: mcqData } = await supabase
                .from('student_mcq_attempts')
                .select('score, total_questions')
                .eq('student_id', userData.user_id)

            let mcqAttempts = 0, avgScore = 0, totalQuestions = 0
            if (mcqData && mcqData.length > 0) {
                mcqAttempts = mcqData.length
                totalQuestions = mcqData.reduce((sum, a) => sum + a.total_questions, 0)
                avgScore = Math.round(mcqData.reduce((sum, a) => sum + (a.score / a.total_questions * 100), 0) / mcqData.length)
            }

            // Attendance stats
            const { data: attendanceData } = await supabase
                .from('attendance_records')
                .select('status')
                .eq('student_id', userData.user_id)

            let totalDays = 0, presentDays = 0, attendancePercent = 0
            if (attendanceData && attendanceData.length > 0) {
                totalDays = attendanceData.length
                presentDays = attendanceData.filter(a => a.status === 'present' || a.status === 'late').length
                attendancePercent = Math.round((presentDays / totalDays) * 100)
            }

            setStats({ mcqAttempts, avgScore, totalQuestions, attendancePercent, totalDays, presentDays })
        } catch (error) {
            console.error('Error loading progress:', error)
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
                        onClick={() => router.push('/dashboard/student')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-green-300" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <Trophy className="w-6 h-6 text-yellow-400" />
                            My Progress
                        </h1>
                        <p className="text-sm text-green-300/70">Track your achievements</p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6">
                {/* Overall Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* MCQ Performance */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Target className="w-5 h-5 text-purple-400" />
                            MCQ Performance
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center">
                                <p className="text-3xl font-bold text-purple-400">{stats.mcqAttempts}</p>
                                <p className="text-sm text-green-300/70">Attempts</p>
                            </div>
                            <div className="text-center">
                                <p className="text-3xl font-bold text-white">{stats.avgScore}%</p>
                                <p className="text-sm text-green-300/70">Avg Score</p>
                            </div>
                            <div className="text-center">
                                <p className="text-3xl font-bold text-green-400">{stats.totalQuestions}</p>
                                <p className="text-sm text-green-300/70">Questions</p>
                            </div>
                        </div>
                    </div>

                    {/* Attendance */}
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-cyan-400" />
                            Attendance
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center">
                                <p className="text-3xl font-bold text-green-400">{stats.presentDays}</p>
                                <p className="text-sm text-green-300/70">Present</p>
                            </div>
                            <div className="text-center">
                                <p className="text-3xl font-bold text-white">{stats.totalDays}</p>
                                <p className="text-sm text-green-300/70">Total Days</p>
                            </div>
                            <div className="text-center">
                                <p className="text-3xl font-bold text-cyan-400">{stats.attendancePercent}%</p>
                                <p className="text-sm text-green-300/70">Percentage</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Achievements */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Star className="w-5 h-5 text-yellow-400" />
                        Achievements
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className={`p-4 rounded-xl text-center ${stats.mcqAttempts >= 1 ? 'bg-green-500/20 border border-green-500/30' : 'bg-white/5 border border-white/10 opacity-50'}`}>
                            <div className="text-3xl mb-2">🎯</div>
                            <p className="text-sm font-medium text-white">First MCQ</p>
                            <p className="text-xs text-green-300/70">Complete 1 MCQ</p>
                        </div>
                        <div className={`p-4 rounded-xl text-center ${stats.mcqAttempts >= 10 ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-white/5 border border-white/10 opacity-50'}`}>
                            <div className="text-3xl mb-2">🏆</div>
                            <p className="text-sm font-medium text-white">Practice Pro</p>
                            <p className="text-xs text-green-300/70">Complete 10 MCQs</p>
                        </div>
                        <div className={`p-4 rounded-xl text-center ${stats.avgScore >= 80 ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-white/5 border border-white/10 opacity-50'}`}>
                            <div className="text-3xl mb-2">⭐</div>
                            <p className="text-sm font-medium text-white">High Scorer</p>
                            <p className="text-xs text-green-300/70">80%+ avg score</p>
                        </div>
                        <div className={`p-4 rounded-xl text-center ${stats.attendancePercent >= 90 ? 'bg-cyan-500/20 border border-cyan-500/30' : 'bg-white/5 border border-white/10 opacity-50'}`}>
                            <div className="text-3xl mb-2">📅</div>
                            <p className="text-sm font-medium text-white">Regular</p>
                            <p className="text-xs text-green-300/70">90%+ attendance</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}

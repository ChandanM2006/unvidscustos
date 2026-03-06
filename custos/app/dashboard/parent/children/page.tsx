'use client'

import { useEffect, useState } from 'react'
import { supabase, type User } from '@/lib/supabase'
import { useSmartBack } from '@/lib/navigation'
import {
    Users, ArrowLeft, Loader2, Calendar, Target, Award, BookOpen
} from 'lucide-react'

interface Child {
    user_id: string
    full_name: string
    email: string
    class_name?: string
    grade_level?: number
    attendance_percent?: number
    mcq_avg?: number
}

export default function ParentChildrenPage() {
    const { goBack, router } = useSmartBack('/dashboard/parent')
    const [loading, setLoading] = useState(true)
    const [children, setChildren] = useState<Child[]>([])

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

            if (!userData || userData.role !== 'parent') {
                router.push('/login')
                return
            }

            await loadChildren(userData)
        } catch (error) {
            console.error('Auth error:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadChildren = async (userData: User) => {
        try {
            // Try parent_student_links first
            const { data: linksData } = await supabase
                .from('parent_student_links')
                .select('student_id')
                .eq('parent_id', userData.user_id)

            let childIds: string[] = []

            if (linksData && linksData.length > 0) {
                childIds = linksData.map(l => l.student_id)
            } else {
                // Demo: show first 2 students
                const { data: studentsData } = await supabase
                    .from('users')
                    .select('user_id')
                    .eq('school_id', userData.school_id)
                    .eq('role', 'student')
                    .limit(2)
                if (studentsData) childIds = studentsData.map(s => s.user_id)
            }

            if (childIds.length > 0) {
                const { data: childrenData } = await supabase
                    .from('users')
                    .select('user_id, full_name, email, class_id')
                    .in('user_id', childIds)

                if (childrenData) {
                    const enriched = await Promise.all(childrenData.map(async (child) => {
                        let className = 'N/A', gradeLevel = 0
                        if (child.class_id) {
                            const { data: classData } = await supabase
                                .from('classes')
                                .select('name, grade_level')
                                .eq('class_id', child.class_id)
                                .single()
                            if (classData) {
                                className = classData.name
                                gradeLevel = classData.grade_level
                            }
                        }

                        // Attendance
                        const { data: attendance } = await supabase
                            .from('attendance_records')
                            .select('status')
                            .eq('student_id', child.user_id)

                        let attendancePercent = 0
                        if (attendance && attendance.length > 0) {
                            const present = attendance.filter(a => a.status === 'present' || a.status === 'late').length
                            attendancePercent = Math.round((present / attendance.length) * 100)
                        }

                        // MCQ avg
                        const { data: mcqs } = await supabase
                            .from('student_mcq_attempts')
                            .select('score, total_questions')
                            .eq('student_id', child.user_id)

                        let mcqAvg = 0
                        if (mcqs && mcqs.length > 0) {
                            mcqAvg = Math.round(mcqs.reduce((sum, m) => sum + (m.score / m.total_questions * 100), 0) / mcqs.length)
                        }

                        return { ...child, class_name: className, grade_level: gradeLevel, attendance_percent: attendancePercent, mcq_avg: mcqAvg }
                    }))
                    setChildren(enriched)
                }
            }
        } catch (error) {
            console.error('Error loading children:', error)
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
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                <div className="max-w-4xl mx-auto flex items-center gap-4">
                    <button onClick={goBack} className="p-2 hover:bg-white/10 rounded-lg">
                        <ArrowLeft className="w-5 h-5 text-purple-300" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <Users className="w-6 h-6 text-purple-400" />
                            My Children
                        </h1>
                        <p className="text-sm text-purple-300/70">View your children's details</p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6">
                {children.length === 0 ? (
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-12 text-center">
                        <Users className="w-16 h-16 mx-auto mb-4 text-purple-300/50" />
                        <h3 className="text-xl font-bold text-white mb-2">No Children Linked</h3>
                        <p className="text-purple-300/70">Contact your school admin to link your children</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {children.map((child) => (
                            <div key={child.user_id} className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                                        {child.full_name.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">{child.full_name}</h3>
                                        <p className="text-purple-300/70">{child.class_name} • Grade {child.grade_level}</p>
                                        <p className="text-sm text-purple-300/50">{child.email}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-xl text-center">
                                        <Calendar className="w-6 h-6 mx-auto mb-2 text-green-400" />
                                        <p className="text-2xl font-bold text-green-400">{child.attendance_percent}%</p>
                                        <p className="text-xs text-purple-300/70">Attendance</p>
                                    </div>
                                    <div className="p-4 bg-purple-500/20 border border-purple-500/30 rounded-xl text-center">
                                        <Target className="w-6 h-6 mx-auto mb-2 text-purple-400" />
                                        <p className="text-2xl font-bold text-purple-400">{child.mcq_avg}%</p>
                                        <p className="text-xs text-purple-300/70">MCQ Avg</p>
                                    </div>
                                    <div className="p-4 bg-blue-500/20 border border-blue-500/30 rounded-xl text-center">
                                        <Award className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                                        <p className="text-2xl font-bold text-blue-400">N/A</p>
                                        <p className="text-xs text-purple-300/70">Grade</p>
                                    </div>
                                    <div className="p-4 bg-orange-500/20 border border-orange-500/30 rounded-xl text-center">
                                        <BookOpen className="w-6 h-6 mx-auto mb-2 text-orange-400" />
                                        <p className="text-2xl font-bold text-orange-400">5</p>
                                        <p className="text-xs text-purple-300/70">Subjects</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}

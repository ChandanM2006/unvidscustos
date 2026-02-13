'use client'

import { useEffect, useState } from 'react'
import { supabase, type User } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
    Award, ArrowLeft, Loader2, BookOpen, Download
} from 'lucide-react'

interface ChildReport {
    child_name: string
    class_name: string
    subjects: { name: string, marks: number, grade: string }[]
    overall_grade: string
    attendance_percent: number
}

export default function ParentReportsPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [reports, setReports] = useState<ChildReport[]>([])

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

            await loadReports(userData)
        } catch (error) {
            console.error('Auth error:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadReports = async (userData: User) => {
        try {
            // Get linked children
            const { data: linksData } = await supabase
                .from('parent_student_links')
                .select('student_id')
                .eq('parent_id', userData.user_id)

            let childIds: string[] = []
            if (linksData && linksData.length > 0) {
                childIds = linksData.map(l => l.student_id)
            } else {
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
                    .select('user_id, full_name, class_id')
                    .in('user_id', childIds)

                if (childrenData) {
                    const reportsData = await Promise.all(childrenData.map(async (child) => {
                        let className = 'N/A'
                        let subjects: { name: string, marks: number, grade: string }[] = []

                        if (child.class_id) {
                            const { data: classData } = await supabase
                                .from('classes')
                                .select('name')
                                .eq('class_id', child.class_id)
                                .single()
                            if (classData) className = classData.name

                            const { data: subjectsData } = await supabase
                                .from('subjects')
                                .select('name')
                                .eq('class_id', child.class_id)

                            if (subjectsData) {
                                // Demo: Generate random marks (in real app, fetch from exam_results table)
                                subjects = subjectsData.map(s => {
                                    const marks = Math.floor(Math.random() * 40) + 60 // 60-100
                                    return {
                                        name: s.name,
                                        marks,
                                        grade: marks >= 90 ? 'A+' : marks >= 80 ? 'A' : marks >= 70 ? 'B' : marks >= 60 ? 'C' : 'D'
                                    }
                                })
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

                        // Calculate overall
                        const avgMarks = subjects.length > 0
                            ? subjects.reduce((sum, s) => sum + s.marks, 0) / subjects.length
                            : 0
                        const overallGrade = avgMarks >= 90 ? 'A+' : avgMarks >= 80 ? 'A' : avgMarks >= 70 ? 'B' : avgMarks >= 60 ? 'C' : 'D'

                        return {
                            child_name: child.full_name,
                            class_name: className,
                            subjects,
                            overall_grade: overallGrade,
                            attendance_percent: attendancePercent
                        }
                    }))
                    setReports(reportsData)
                }
            }
        } catch (error) {
            console.error('Error:', error)
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
                    <button onClick={() => router.push('/dashboard/parent')} className="p-2 hover:bg-white/10 rounded-lg">
                        <ArrowLeft className="w-5 h-5 text-purple-300" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <Award className="w-6 h-6 text-blue-400" />
                            Report Cards
                        </h1>
                        <p className="text-sm text-purple-300/70">View your children's academic performance</p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6">
                {reports.length === 0 ? (
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-12 text-center">
                        <Award className="w-16 h-16 mx-auto mb-4 text-purple-300/50" />
                        <h3 className="text-xl font-bold text-white mb-2">No Report Cards</h3>
                        <p className="text-purple-300/70">Report cards will appear here after exams</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {reports.map((report, i) => (
                            <div key={i} className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                                {/* Header */}
                                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-xl font-bold text-white">{report.child_name}</h3>
                                        <p className="text-purple-300/70">{report.class_name} • Attendance: {report.attendance_percent}%</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                                            {report.overall_grade}
                                        </p>
                                        <p className="text-sm text-purple-300/70">Overall Grade</p>
                                    </div>
                                </div>

                                {/* Subjects */}
                                <div className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {report.subjects.map((subject, j) => (
                                            <div key={j} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <BookOpen className="w-5 h-5 text-purple-400" />
                                                    <span className="text-white">{subject.name}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-purple-300">{subject.marks}/100</span>
                                                    <span className={`px-2 py-1 rounded text-sm font-medium ${subject.grade.includes('A') ? 'bg-green-500/20 text-green-400' :
                                                            subject.grade === 'B' ? 'bg-blue-500/20 text-blue-400' :
                                                                'bg-yellow-500/20 text-yellow-400'
                                                        }`}>
                                                        {subject.grade}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Download */}
                                <div className="p-4 border-t border-white/10">
                                    <button className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-medium hover:opacity-90 flex items-center justify-center gap-2">
                                        <Download className="w-5 h-5" />
                                        Download Report Card (Coming Soon)
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}

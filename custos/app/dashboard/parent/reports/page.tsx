'use client'

import { useEffect, useState } from 'react'
import { supabase, type User } from '@/lib/supabase'
import { useSmartBack } from '@/lib/navigation'
import {
    Award, ArrowLeft, Loader2, BookOpen, BarChart3
} from 'lucide-react'

interface SubjectMark {
    name: string
    marks_obtained: number
    max_marks: number
    grade: string
    percentage: number
}

interface ExamReport {
    exam_name: string
    exam_type: string
    subjects: SubjectMark[]
    total_obtained: number
    total_max: number
    percentage: number
    overall_grade: string
}

interface ChildReport {
    child_name: string
    class_name: string
    attendance_percent: number
    exams: ExamReport[]
}

function getGrade(pct: number): string {
    if (pct >= 90) return 'A+'
    if (pct >= 80) return 'A'
    if (pct >= 70) return 'B+'
    if (pct >= 60) return 'B'
    if (pct >= 50) return 'C+'
    if (pct >= 40) return 'C'
    if (pct >= 33) return 'D'
    return 'F'
}

export default function ParentReportsPage() {
    const { goBack, router } = useSmartBack('/dashboard/parent')
    const [loading, setLoading] = useState(true)
    const [reports, setReports] = useState<ChildReport[]>([])
    const [selectedExamIndex, setSelectedExamIndex] = useState<Record<number, number>>({})

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
                // Fallback: get students from same school
                const { data: studentsData } = await supabase
                    .from('users')
                    .select('user_id')
                    .eq('school_id', userData.school_id)
                    .eq('role', 'student')
                    .limit(2)
                if (studentsData) childIds = studentsData.map(s => s.user_id)
            }

            if (childIds.length === 0) return

            // Get published exams only
            const { data: publishedExams } = await supabase
                .from('exams')
                .select('exam_id')
                .eq('status', 'completed')

            const publishedExamIds = (publishedExams || []).map((e: any) => e.exam_id)

            const { data: childrenData } = await supabase
                .from('users')
                .select('user_id, full_name, class_id')
                .in('user_id', childIds)

            if (!childrenData) return

            const reportsData = await Promise.all(childrenData.map(async (child) => {
                let className = 'N/A'

                if (child.class_id) {
                    const { data: classData } = await supabase
                        .from('classes')
                        .select('name')
                        .eq('class_id', child.class_id)
                        .single()
                    if (classData) className = classData.name
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

                // Get marks only from published exams
                const exams: ExamReport[] = []
                if (publishedExamIds.length > 0) {
                    const { data: marksData } = await supabase
                        .from('student_marks')
                        .select(`
                            marks_obtained, max_marks, grade,
                            exams (exam_id, name, exam_type_id, exam_types (name)),
                            subjects (name)
                        `)
                        .eq('student_id', child.user_id)
                        .in('exam_id', publishedExamIds)

                    if (marksData && marksData.length > 0) {
                        // Group by exam
                        const examMap = new Map<string, ExamReport>()
                        for (const mark of marksData as any[]) {
                            const exam = mark.exams
                            if (!exam) continue
                            const examId = exam.exam_id
                            if (!examMap.has(examId)) {
                                examMap.set(examId, {
                                    exam_name: exam.name,
                                    exam_type: exam.exam_types?.name || 'Exam',
                                    subjects: [],
                                    total_obtained: 0,
                                    total_max: 0,
                                    percentage: 0,
                                    overall_grade: ''
                                })
                            }
                            const result = examMap.get(examId)!
                            result.subjects.push({
                                name: mark.subjects?.name || 'Unknown',
                                marks_obtained: mark.marks_obtained,
                                max_marks: mark.max_marks,
                                grade: mark.grade || getGrade(mark.max_marks > 0 ? (mark.marks_obtained / mark.max_marks) * 100 : 0),
                                percentage: mark.max_marks > 0 ? Math.round((mark.marks_obtained / mark.max_marks) * 100) : 0
                            })
                            result.total_obtained += mark.marks_obtained
                            result.total_max += mark.max_marks
                        }

                        for (const result of examMap.values()) {
                            result.percentage = result.total_max > 0
                                ? Math.round((result.total_obtained / result.total_max) * 100)
                                : 0
                            result.overall_grade = getGrade(result.percentage)
                            result.subjects.sort((a, b) => a.name.localeCompare(b.name))
                            exams.push(result)
                        }
                    }
                }

                return {
                    child_name: child.full_name,
                    class_name: className,
                    attendance_percent: attendancePercent,
                    exams
                }
            }))

            setReports(reportsData)
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
                    <button onClick={goBack} className="p-2 hover:bg-white/10 rounded-lg">
                        <ArrowLeft className="w-5 h-5 text-purple-300" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <Award className="w-6 h-6 text-blue-400" />
                            Report Cards
                        </h1>
                        <p className="text-sm text-purple-300/70">View your children&apos;s academic performance</p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6">
                {reports.length === 0 || reports.every(r => r.exams.length === 0) ? (
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-12 text-center">
                        <Award className="w-16 h-16 mx-auto mb-4 text-purple-300/50" />
                        <h3 className="text-xl font-bold text-white mb-2">No Report Cards Published</h3>
                        <p className="text-purple-300/70">Report cards will appear here once the school publishes exam results.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {reports.map((report, i) => (
                            report.exams.length > 0 && (
                                <div key={i} className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                                    {/* Child Header */}
                                    <div className="p-6 border-b border-white/10">
                                        <h3 className="text-xl font-bold text-white">{report.child_name}</h3>
                                        <p className="text-purple-300/70">{report.class_name} • Attendance: {report.attendance_percent}%</p>
                                    </div>

                                    {/* Exam Selector */}
                                    {report.exams.length > 1 && (
                                        <div className="px-6 pt-4 flex gap-2 overflow-x-auto">
                                            {report.exams.map((exam, j) => (
                                                <button
                                                    key={j}
                                                    onClick={() => setSelectedExamIndex(prev => ({ ...prev, [i]: j }))}
                                                    className={`px-4 py-2 rounded-xl whitespace-nowrap font-medium text-sm transition-all ${(selectedExamIndex[i] || 0) === j
                                                        ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                                                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                                                        }`}
                                                >
                                                    {exam.exam_name}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Exam Result */}
                                    {(() => {
                                        const exam = report.exams[selectedExamIndex[i] || 0]
                                        if (!exam) return null
                                        return (
                                            <>
                                                {/* Summary */}
                                                <div className="p-6 flex items-center justify-between">
                                                    <div>
                                                        <h4 className="text-lg font-semibold text-white">{exam.exam_name}</h4>
                                                        <p className="text-sm text-purple-300/60">{exam.exam_type}</p>
                                                    </div>
                                                        <div className="text-right">
                                                            <p className="text-3xl font-bold text-purple-400">
                                                                {exam.overall_grade}
                                                        </p>
                                                        <p className="text-sm text-purple-300/70">{exam.percentage}%</p>
                                                    </div>
                                                </div>

                                                {/* Subjects */}
                                                <div className="px-6 pb-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {exam.subjects.map((subject, j) => (
                                                            <div key={j} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                                                                <div className="flex items-center gap-3">
                                                                    <BookOpen className="w-5 h-5 text-purple-400" />
                                                                    <span className="text-white">{subject.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-purple-300">{subject.marks_obtained}/{subject.max_marks}</span>
                                                                    <span className={`px-2 py-1 rounded text-sm font-medium ${subject.grade.includes('A') ? 'bg-green-500/20 text-green-400' :
                                                                        subject.grade.includes('B') ? 'bg-blue-500/20 text-blue-400' :
                                                                            subject.grade.includes('C') ? 'bg-yellow-500/20 text-yellow-400' :
                                                                                'bg-red-500/20 text-red-400'
                                                                        }`}>
                                                                        {subject.grade}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Total */}
                                                    <div className="mt-4 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20 flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <BarChart3 className="w-5 h-5 text-purple-400" />
                                                            <span className="font-semibold text-white">Total</span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-purple-300 font-medium">{exam.total_obtained}/{exam.total_max}</span>
                                                            <span className="text-white font-bold">{exam.percentage}%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )
                                    })()}
                                </div>
                            )
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}

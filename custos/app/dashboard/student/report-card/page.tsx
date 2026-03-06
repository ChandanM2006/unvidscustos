'use client'

import { useState, useEffect } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Loader2, Award, TrendingUp, BookOpen,
    ChevronRight, Download, Star, BarChart3
} from 'lucide-react'

interface SubjectMark {
    subject_name: string
    marks_obtained: number
    max_marks: number
    grade: string
    percentage: number
}

interface ExamResult {
    exam_id: string
    exam_name: string
    exam_type: string
    marks: SubjectMark[]
    total_obtained: number
    total_max: number
    percentage: number
    overall_grade: string
}

interface ReportCard {
    report_id: string
    academic_year: string
    percentage: number
    overall_grade: string
    rank_in_class: number | null
    attendance_percentage: number | null
    class_teacher_remarks: string | null
    principal_remarks: string | null
    ai_summary: any
    status: string
}

const GRADE_COLORS: Record<string, string> = {
    'A+': 'text-green-400 bg-green-500/20 border-green-500/30',
    'A': 'text-green-400 bg-green-500/20 border-green-500/30',
    'B+': 'text-blue-400 bg-blue-500/20 border-blue-500/30',
    'B': 'text-blue-400 bg-blue-500/20 border-blue-500/30',
    'C+': 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
    'C': 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
    'D': 'text-orange-400 bg-orange-500/20 border-orange-500/30',
    'F': 'text-red-400 bg-red-500/20 border-red-500/30',
}

export default function StudentReportCardPage() {
    const { goBack, router } = useSmartBack('/dashboard/student')
    const [loading, setLoading] = useState(true)
    const [studentName, setStudentName] = useState('')
    const [className, setClassName] = useState('')
    const [examResults, setExamResults] = useState<ExamResult[]>([])
    const [reportCard, setReportCard] = useState<ReportCard | null>(null)
    const [selectedExam, setSelectedExam] = useState<string | null>(null)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push('/login'); return }

            const { data: userData } = await supabase
                .from('users')
                .select('user_id, role, full_name, class_id, section_id')
                .eq('email', session.user.email)
                .single()

            if (!userData || userData.role !== 'student') {
                router.push('/login')
                return
            }

            setStudentName(userData.full_name)

            // Get class name
            if (userData.class_id) {
                const { data: cls } = await supabase.from('classes').select('name').eq('class_id', userData.class_id).single()
                const { data: sec } = userData.section_id
                    ? await supabase.from('sections').select('name').eq('section_id', userData.section_id).single()
                    : { data: null }
                setClassName(`${cls?.name || ''} ${sec?.name || ''}`.trim())
            }

            // Load student marks with exam and subject info
            const { data: marksData } = await supabase
                .from('student_marks')
                .select(`
                    mark_id, marks_obtained, max_marks, grade,
                    exams (exam_id, name, exam_type_id, exam_types (name)),
                    subjects (name)
                `)
                .eq('student_id', userData.user_id)
                .order('entered_at', { ascending: false })

            if (marksData && marksData.length > 0) {
                // Group marks by exam
                const examMap = new Map<string, ExamResult>()
                for (const mark of marksData as any[]) {
                    const exam = mark.exams
                    if (!exam) continue
                    const examId = exam.exam_id
                    if (!examMap.has(examId)) {
                        examMap.set(examId, {
                            exam_id: examId,
                            exam_name: exam.name,
                            exam_type: exam.exam_types?.name || 'Exam',
                            marks: [],
                            total_obtained: 0,
                            total_max: 0,
                            percentage: 0,
                            overall_grade: ''
                        })
                    }
                    const result = examMap.get(examId)!
                    const subjectMark: SubjectMark = {
                        subject_name: mark.subjects?.name || 'Unknown',
                        marks_obtained: mark.marks_obtained,
                        max_marks: mark.max_marks,
                        grade: mark.grade || '',
                        percentage: mark.max_marks > 0 ? Math.round((mark.marks_obtained / mark.max_marks) * 100) : 0
                    }
                    result.marks.push(subjectMark)
                    result.total_obtained += mark.marks_obtained
                    result.total_max += mark.max_marks
                }

                // Calculate percentages and grades
                for (const result of examMap.values()) {
                    result.percentage = result.total_max > 0
                        ? Math.round((result.total_obtained / result.total_max) * 100)
                        : 0
                    result.overall_grade = getGrade(result.percentage)
                    result.marks.sort((a, b) => a.subject_name.localeCompare(b.subject_name))
                }

                const results = Array.from(examMap.values())
                setExamResults(results)
                if (results.length > 0) setSelectedExam(results[0].exam_id)
            }

            // Load published report card
            const { data: rcData } = await supabase
                .from('report_cards')
                .select(`
                    report_id, percentage, overall_grade, rank_in_class,
                    attendance_percentage, class_teacher_remarks, principal_remarks,
                    ai_summary, status, academic_years (name)
                `)
                .eq('student_id', userData.user_id)
                .eq('status', 'published')
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (rcData) {
                setReportCard({
                    report_id: rcData.report_id,
                    academic_year: (rcData as any).academic_years?.name || '',
                    percentage: rcData.percentage || 0,
                    overall_grade: rcData.overall_grade || '',
                    rank_in_class: rcData.rank_in_class,
                    attendance_percentage: rcData.attendance_percentage,
                    class_teacher_remarks: rcData.class_teacher_remarks,
                    principal_remarks: rcData.principal_remarks,
                    ai_summary: rcData.ai_summary,
                    status: rcData.status
                })
            }

        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
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

    function getGradeColor(grade: string): string {
        return GRADE_COLORS[grade] || 'text-gray-400 bg-gray-500/20 border-gray-500/30'
    }

    const currentExam = examResults.find(e => e.exam_id === selectedExam)

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-green-900 to-slate-900">
                <Loader2 className="w-12 h-12 text-green-400 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900 to-slate-900 text-white">
            {/* Header */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto flex items-center gap-4">
                    <button
                        onClick={goBack}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-green-300" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Award className="w-6 h-6 text-yellow-400" />
                            Report Card
                        </h1>
                        <p className="text-sm text-green-300/70">{studentName} • {className}</p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6 space-y-6">
                {/* Published Report Card */}
                {reportCard && (
                    <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-2xl border border-yellow-500/20 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Star className="w-5 h-5 text-yellow-400" />
                                    Official Report Card
                                </h3>
                                <p className="text-sm text-yellow-300/70">{reportCard.academic_year}</p>
                            </div>
                            <div className={`px-4 py-2 rounded-xl text-2xl font-bold border ${getGradeColor(reportCard.overall_grade)}`}>
                                {reportCard.overall_grade}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-white">{reportCard.percentage}%</p>
                                <p className="text-xs text-yellow-300/70">Percentage</p>
                            </div>
                            {reportCard.rank_in_class && (
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-cyan-400">#{reportCard.rank_in_class}</p>
                                    <p className="text-xs text-yellow-300/70">Class Rank</p>
                                </div>
                            )}
                            {reportCard.attendance_percentage !== null && (
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-green-400">{reportCard.attendance_percentage}%</p>
                                    <p className="text-xs text-yellow-300/70">Attendance</p>
                                </div>
                            )}
                        </div>

                        {reportCard.class_teacher_remarks && (
                            <div className="bg-white/5 rounded-lg p-3 mb-2">
                                <p className="text-xs text-yellow-300/70 mb-1">Class Teacher</p>
                                <p className="text-sm">{reportCard.class_teacher_remarks}</p>
                            </div>
                        )}
                        {reportCard.principal_remarks && (
                            <div className="bg-white/5 rounded-lg p-3">
                                <p className="text-xs text-yellow-300/70 mb-1">Principal</p>
                                <p className="text-sm">{reportCard.principal_remarks}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Exam Results */}
                {examResults.length > 0 ? (
                    <>
                        {/* Exam Selector */}
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {examResults.map(exam => (
                                <button
                                    key={exam.exam_id}
                                    onClick={() => setSelectedExam(exam.exam_id)}
                                    className={`px-4 py-2 rounded-xl whitespace-nowrap font-medium transition-all ${selectedExam === exam.exam_id
                                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                                        }`}
                                >
                                    {exam.exam_name}
                                </button>
                            ))}
                        </div>

                        {/* Selected Exam Details */}
                        {currentExam && (
                            <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                                {/* Summary */}
                                <div className="p-5 border-b border-white/10 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold">{currentExam.exam_name}</h3>
                                        <p className="text-sm text-green-300/70">{currentExam.exam_type}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-2xl font-bold text-cyan-400">{currentExam.percentage}%</p>
                                            <p className="text-xs text-green-300/70">
                                                {currentExam.total_obtained} / {currentExam.total_max}
                                            </p>
                                        </div>
                                        <div className={`px-3 py-1 rounded-lg text-sm font-bold border ${getGradeColor(currentExam.overall_grade)}`}>
                                            {currentExam.overall_grade}
                                        </div>
                                    </div>
                                </div>

                                {/* Subject-wise marks */}
                                <div className="divide-y divide-white/10">
                                    {currentExam.marks.map((mark, idx) => (
                                        <div key={idx} className="p-4 flex items-center gap-4">
                                            <div className="flex-1">
                                                <p className="font-medium text-white">{mark.subject_name}</p>
                                                <div className="mt-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${mark.percentage >= 80 ? 'bg-green-500' :
                                                            mark.percentage >= 60 ? 'bg-blue-500' :
                                                                mark.percentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                                            }`}
                                                        style={{ width: `${mark.percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="text-right min-w-[80px]">
                                                <p className="font-bold text-white">
                                                    {mark.marks_obtained}/{mark.max_marks}
                                                </p>
                                                <p className="text-xs text-green-300/70">{mark.percentage}%</p>
                                            </div>
                                            <div className={`px-2 py-0.5 rounded text-xs font-bold border ${getGradeColor(mark.grade || getGrade(mark.percentage))}`}>
                                                {mark.grade || getGrade(mark.percentage)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-12 text-center">
                        <BarChart3 className="w-16 h-16 mx-auto mb-4 text-green-300/30" />
                        <h3 className="text-xl font-bold mb-2">No Results Yet</h3>
                        <p className="text-green-300/70">
                            Your exam results will appear here once your teachers enter them.
                        </p>
                    </div>
                )}
            </main>
        </div>
    )
}

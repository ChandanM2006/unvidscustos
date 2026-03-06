'use client'

import { useEffect, useState } from 'react'
import { supabase, type User } from '@/lib/supabase'
import { useSmartBack } from '@/lib/navigation'
import {
    ArrowLeft, Check, X, Clock, Save, Loader2,
    Calendar, Users
} from 'lucide-react'

interface Student {
    user_id: string
    full_name: string
    email: string
}

export default function TeacherAttendancePage() {
    const { goBack, router } = useSmartBack('/dashboard/teacher')
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [classes, setClasses] = useState<any[]>([])
    const [sections, setSections] = useState<any[]>([])
    const [students, setStudents] = useState<Student[]>([])

    const [selectedClass, setSelectedClass] = useState('')
    const [selectedSection, setSelectedSection] = useState('')
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

    const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent' | 'late'>>({})
    const [existingRecords, setExistingRecords] = useState(false)

    useEffect(() => {
        checkAuth()
    }, [])

    useEffect(() => {
        if (selectedClass) {
            loadStudents()
        }
    }, [selectedClass, selectedSection, selectedDate])

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

            if (!userData || userData.role !== 'teacher') {
                router.push('/login')
                return
            }

            setUser(userData)
            await loadClasses(userData.school_id)
        } catch (error) {
            console.error('Auth error:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadClasses = async (schoolId: string) => {
        const { data: classesData } = await supabase
            .from('classes')
            .select('*')
            .eq('school_id', schoolId)
            .order('grade_level')

        if (classesData) setClasses(classesData)

        // Filter sections to only this school's classes
        const classIds = (classesData || []).map((c: any) => c.class_id)
        if (classIds.length > 0) {
            const { data: sectionsData } = await supabase
                .from('sections')
                .select('*')
                .in('class_id', classIds)

            if (sectionsData) setSections(sectionsData)
        }
    }

    const loadStudents = async () => {
        if (!selectedClass) return

        setLoading(true)
        try {
            let query = supabase
                .from('users')
                .select('user_id, full_name, email')
                .eq('role', 'student')
                .eq('class_id', selectedClass)

            if (selectedSection) {
                query = query.eq('section_id', selectedSection)
            }

            const { data: studentsData } = await query.order('full_name')
            if (studentsData) {
                setStudents(studentsData)

                const initialAttendance: Record<string, 'present' | 'absent' | 'late'> = {}
                studentsData.forEach(s => {
                    initialAttendance[s.user_id] = 'present'
                })
                setAttendance(initialAttendance)
            }

            const { data: existingData } = await supabase
                .from('attendance_records')
                .select('student_id, status')
                .eq('date', selectedDate)
                .eq('class_id', selectedClass)

            if (existingData && existingData.length > 0) {
                setExistingRecords(true)
                const existingAttendance: Record<string, 'present' | 'absent' | 'late'> = {}
                existingData.forEach(record => {
                    existingAttendance[record.student_id] = record.status
                })
                setAttendance(prev => ({ ...prev, ...existingAttendance }))
            } else {
                setExistingRecords(false)
            }

        } catch (error) {
            console.error('Error loading students:', error)
        } finally {
            setLoading(false)
        }
    }

    const toggleAttendance = (studentId: string) => {
        setAttendance(prev => {
            const current = prev[studentId]
            let next: 'present' | 'absent' | 'late' = 'present'
            if (current === 'present') next = 'absent'
            else if (current === 'absent') next = 'late'
            else next = 'present'
            return { ...prev, [studentId]: next }
        })
    }

    const markAllPresent = () => {
        const all: Record<string, 'present' | 'absent' | 'late'> = {}
        students.forEach(s => {
            all[s.user_id] = 'present'
        })
        setAttendance(all)
    }

    const handleSave = async () => {
        if (!user || !selectedClass) return

        setSaving(true)
        try {
            await supabase
                .from('attendance_records')
                .delete()
                .eq('date', selectedDate)
                .eq('class_id', selectedClass)

            const records = students.map(student => ({
                student_id: student.user_id,
                class_id: selectedClass,
                section_id: selectedSection || null,
                date: selectedDate,
                status: attendance[student.user_id] || 'present',
                marked_by: user.user_id,
                school_id: user.school_id
            }))

            const { error } = await supabase
                .from('attendance_records')
                .insert(records)

            if (error) throw error

            alert('Attendance saved successfully!')
            setExistingRecords(true)
        } catch (error: any) {
            console.error('Error saving attendance:', error)
            alert('Error: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    const presentCount = Object.values(attendance).filter(s => s === 'present').length
    const absentCount = Object.values(attendance).filter(s => s === 'absent').length
    const lateCount = Object.values(attendance).filter(s => s === 'late').length

    if (loading && !selectedClass) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
                <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
            {/* Header */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                <div className="flex items-center justify-between max-w-4xl mx-auto">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={goBack}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-blue-300" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-white">Mark Attendance</h1>
                            <p className="text-sm text-blue-300/70">Select class and mark student attendance</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6">
                {/* Filters */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-blue-200 mb-2">Class</label>
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="" className="bg-slate-800">Select class</option>
                                {classes.map(cls => (
                                    <option key={cls.class_id} value={cls.class_id} className="bg-slate-800">
                                        {cls.name} (Grade {cls.grade_level})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-blue-200 mb-2">Section</label>
                            <select
                                value={selectedSection}
                                onChange={(e) => setSelectedSection(e.target.value)}
                                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="" className="bg-slate-800">All sections</option>
                                {sections.filter(s => s.class_id === selectedClass).map(section => (
                                    <option key={section.section_id} value={section.section_id} className="bg-slate-800">
                                        {section.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-blue-200 mb-2">Date</label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {selectedClass && (
                    <>
                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 text-center">
                                <p className="text-3xl font-bold text-green-400">{presentCount}</p>
                                <p className="text-sm text-green-300/70">Present</p>
                            </div>
                            <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 text-center">
                                <p className="text-3xl font-bold text-red-400">{absentCount}</p>
                                <p className="text-sm text-red-300/70">Absent</p>
                            </div>
                            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-4 text-center">
                                <p className="text-3xl font-bold text-yellow-400">{lateCount}</p>
                                <p className="text-sm text-yellow-300/70">Late</p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-between items-center mb-4">
                            <button
                                onClick={markAllPresent}
                                className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg font-medium hover:bg-green-500/30 transition-colors"
                            >
                                Mark All Present
                            </button>
                            {existingRecords && (
                                <span className="text-sm text-orange-400 bg-orange-500/20 px-3 py-1 rounded-full border border-orange-500/30">
                                    Existing records will be updated
                                </span>
                            )}
                        </div>

                        {/* Student List */}
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden mb-6">
                            {loading ? (
                                <div className="p-8 text-center">
                                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-400" />
                                </div>
                            ) : students.length === 0 ? (
                                <div className="p-8 text-center">
                                    <Users className="w-12 h-12 mx-auto mb-3 text-blue-300/50" />
                                    <p className="text-blue-300/70">No students found in this class</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/10">
                                    {students.map((student, index) => (
                                        <div
                                            key={student.user_id}
                                            className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                                        >
                                            <div className="flex items-center gap-4">
                                                <span className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-sm font-medium text-blue-200">
                                                    {index + 1}
                                                </span>
                                                <div>
                                                    <p className="font-medium text-white">{student.full_name}</p>
                                                    <p className="text-sm text-blue-300/50">{student.email}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => toggleAttendance(student.user_id)}
                                                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${attendance[student.user_id] === 'present'
                                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                    : attendance[student.user_id] === 'absent'
                                                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                        : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                                    }`}
                                            >
                                                {attendance[student.user_id] === 'present' && <Check className="w-4 h-4" />}
                                                {attendance[student.user_id] === 'absent' && <X className="w-4 h-4" />}
                                                {attendance[student.user_id] === 'late' && <Clock className="w-4 h-4" />}
                                                {attendance[student.user_id]?.charAt(0).toUpperCase() + attendance[student.user_id]?.slice(1)}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Save Button */}
                        {students.length > 0 && (
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        Save Attendance
                                    </>
                                )}
                            </button>
                        )}
                    </>
                )}
            </main>
        </div>
    )
}

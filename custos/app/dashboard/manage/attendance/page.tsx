'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Calendar, Users, CheckCircle, XCircle,
    Clock, AlertCircle, ChevronLeft, ChevronRight,
    Loader2, Download, Filter
} from 'lucide-react'

interface Student {
    user_id: string
    full_name: string
    email: string
}

interface AttendanceRecord {
    attendance_id?: string
    student_id: string
    status: 'present' | 'absent' | 'late' | 'excused' | 'half_day'
    remarks?: string
}

interface ClassItem {
    class_id: string
    name: string
    grade_level: number
}

interface Section {
    section_id: string
    name: string
}

export default function AttendancePage() {
    const router = useRouter()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Data
    const [classes, setClasses] = useState<ClassItem[]>([])
    const [sections, setSections] = useState<Section[]>([])
    const [students, setStudents] = useState<Student[]>([])
    const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({})

    // Selection
    const [selectedClassId, setSelectedClassId] = useState('')
    const [selectedSectionId, setSelectedSectionId] = useState('')
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

    // Stats
    const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, late: 0 })

    useEffect(() => {
        loadClasses()
    }, [])

    useEffect(() => {
        if (selectedClassId) {
            loadSections()
        }
    }, [selectedClassId])

    useEffect(() => {
        if (selectedClassId && selectedDate) {
            loadStudentsAndAttendance()
        }
    }, [selectedClassId, selectedSectionId, selectedDate])

    useEffect(() => {
        // Calculate stats
        const records = Object.values(attendance)
        const present = records.filter(r => r.status === 'present').length
        const absent = records.filter(r => r.status === 'absent').length
        const late = records.filter(r => r.status === 'late').length
        setStats({ total: students.length, present, absent, late })
    }, [attendance, students])

    async function loadClasses() {
        try {
            const { data } = await supabase
                .from('classes')
                .select('*')
                .order('grade_level', { ascending: true })
            setClasses(data || [])
        } catch (error) {
            console.error('Error loading classes:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadSections() {
        try {
            const { data } = await supabase
                .from('sections')
                .select('*')
                .eq('class_id', selectedClassId)
                .order('name', { ascending: true })
            setSections(data || [])
        } catch (error) {
            console.error('Error loading sections:', error)
        }
    }

    async function loadStudentsAndAttendance() {
        try {
            // Build query for students
            let query = supabase
                .from('users')
                .select('user_id, full_name, email')
                .eq('role', 'student')
                .eq('class_id', selectedClassId)

            if (selectedSectionId) {
                query = query.eq('section_id', selectedSectionId)
            }

            const { data: studentData } = await query.order('full_name', { ascending: true })
            setStudents(studentData || [])

            // Load existing attendance for this date
            const { data: attendanceData } = await supabase
                .from('attendance_records')
                .select('*')
                .eq('attendance_date', selectedDate)
                .eq('class_id', selectedClassId)

            // Map attendance to student IDs
            const attendanceMap: Record<string, AttendanceRecord> = {}
            studentData?.forEach(student => {
                const record = attendanceData?.find(a => a.student_id === student.user_id)
                attendanceMap[student.user_id] = record || {
                    student_id: student.user_id,
                    status: 'present' // Default to present
                }
            })
            setAttendance(attendanceMap)

        } catch (error) {
            console.error('Error loading data:', error)
        }
    }

    function setStudentStatus(studentId: string, status: AttendanceRecord['status']) {
        setAttendance(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], student_id: studentId, status }
        }))
    }

    function markAllAs(status: AttendanceRecord['status']) {
        const newAttendance: Record<string, AttendanceRecord> = {}
        students.forEach(s => {
            newAttendance[s.user_id] = {
                student_id: s.user_id,
                status
            }
        })
        setAttendance(newAttendance)
    }

    async function saveAttendance() {
        if (!selectedClassId) {
            alert('Please select a class')
            return
        }

        setSaving(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()

            const records = Object.values(attendance).map(a => ({
                student_id: a.student_id,
                class_id: selectedClassId,
                section_id: selectedSectionId || null,
                attendance_date: selectedDate,
                status: a.status,
                remarks: a.remarks || null,
                marked_by: user?.id
            }))

            // Upsert attendance records
            const { error } = await supabase
                .from('attendance_records')
                .upsert(records, {
                    onConflict: 'student_id,attendance_date',
                    ignoreDuplicates: false
                })

            if (error) throw error

            alert(`Attendance saved successfully!\n• Present: ${stats.present}\n• Absent: ${stats.absent}\n• Late: ${stats.late}`)

        } catch (error: any) {
            console.error('Error saving attendance:', error)
            alert('Error saving attendance: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    function navigateDate(days: number) {
        const date = new Date(selectedDate)
        date.setDate(date.getDate() + days)
        setSelectedDate(date.toISOString().split('T')[0])
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'present': return <CheckCircle className="w-5 h-5 text-green-500" />
            case 'absent': return <XCircle className="w-5 h-5 text-red-500" />
            case 'late': return <Clock className="w-5 h-5 text-yellow-500" />
            case 'excused': return <AlertCircle className="w-5 h-5 text-blue-500" />
            default: return <CheckCircle className="w-5 h-5 text-gray-300" />
        }
    }

    const getStatusButtonClass = (status: string, current: string) => {
        const base = "px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        if (status === current) {
            switch (status) {
                case 'present': return `${base} bg-green-600 text-white`
                case 'absent': return `${base} bg-red-600 text-white`
                case 'late': return `${base} bg-yellow-500 text-white`
                case 'excused': return `${base} bg-blue-600 text-white`
                default: return `${base} bg-gray-600 text-white`
            }
        }
        return `${base} bg-gray-100 text-gray-600 hover:bg-gray-200`
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/dashboard/manage')}
                            className="p-2 hover:bg-white rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Attendance</h1>
                            <p className="text-gray-600">Mark daily attendance for students</p>
                        </div>
                    </div>
                    <Calendar className="w-12 h-12 text-green-600" />
                </div>

                {/* Filters */}
                <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Class Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                            <select
                                value={selectedClassId}
                                onChange={(e) => setSelectedClassId(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white"
                            >
                                <option value="">Select Class</option>
                                {classes.map(c => (
                                    <option key={c.class_id} value={c.class_id}>
                                        {c.name} (Grade {c.grade_level})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Section Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                            <select
                                value={selectedSectionId}
                                onChange={(e) => setSelectedSectionId(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white"
                                disabled={!selectedClassId}
                            >
                                <option value="">All Sections</option>
                                {sections.map(s => (
                                    <option key={s.section_id} value={s.section_id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Date Navigation */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => navigateDate(-1)}
                                    className="p-3 bg-gray-100 rounded-lg hover:bg-gray-200"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="flex-1 p-3 border border-gray-300 rounded-lg text-gray-900 bg-white text-center"
                                />
                                <button
                                    onClick={() => navigateDate(1)}
                                    className="p-3 bg-gray-100 rounded-lg hover:bg-gray-200"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                                    className="px-4 py-3 bg-green-100 text-green-700 rounded-lg font-medium hover:bg-green-200"
                                >
                                    Today
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-xl shadow-lg p-4 text-center">
                        <Users className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                        <p className="text-xs text-gray-500">Total</p>
                    </div>
                    <div className="bg-green-50 rounded-xl shadow-lg p-4 text-center border-2 border-green-200">
                        <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-green-700">{stats.present}</p>
                        <p className="text-xs text-green-600">Present</p>
                    </div>
                    <div className="bg-red-50 rounded-xl shadow-lg p-4 text-center border-2 border-red-200">
                        <XCircle className="w-6 h-6 text-red-600 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-red-700">{stats.absent}</p>
                        <p className="text-xs text-red-600">Absent</p>
                    </div>
                    <div className="bg-yellow-50 rounded-xl shadow-lg p-4 text-center border-2 border-yellow-200">
                        <Clock className="w-6 h-6 text-yellow-600 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-yellow-700">{stats.late}</p>
                        <p className="text-xs text-yellow-600">Late</p>
                    </div>
                </div>

                {/* Student List */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-900">
                            Students ({new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })})
                        </h2>
                        <div className="flex gap-2">
                            <button
                                onClick={() => markAllAs('present')}
                                className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200"
                            >
                                All Present
                            </button>
                            <button
                                onClick={() => markAllAs('absent')}
                                className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
                            >
                                All Absent
                            </button>
                        </div>
                    </div>

                    {students.length === 0 ? (
                        <div className="p-12 text-center">
                            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">No students found</p>
                            <p className="text-sm text-gray-400">Select a class to view students</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                            {students.map((student, idx) => {
                                const record = attendance[student.user_id]
                                return (
                                    <div key={student.user_id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                        <div className="flex items-center gap-4">
                                            <span className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                                                {idx + 1}
                                            </span>
                                            <div className="flex items-center gap-3">
                                                {getStatusIcon(record?.status || 'present')}
                                                <div>
                                                    <p className="font-medium text-gray-900">{student.full_name}</p>
                                                    <p className="text-xs text-gray-500">{student.email}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            {(['present', 'absent', 'late', 'excused'] as const).map(status => (
                                                <button
                                                    key={status}
                                                    onClick={() => setStudentStatus(student.user_id, status)}
                                                    className={getStatusButtonClass(status, record?.status || '')}
                                                >
                                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Save Footer */}
                    <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                        <p className="text-sm text-gray-500">
                            {stats.present} present • {stats.absent} absent • {stats.late} late
                        </p>
                        <button
                            onClick={saveAttendance}
                            disabled={saving || students.length === 0}
                            className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold flex items-center gap-2 hover:shadow-lg disabled:opacity-50"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-5 h-5" />
                                    Save Attendance
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

'use client'

import { useState, useEffect } from 'react'
import { useSmartBack } from '@/lib/navigation'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Loader2, Calendar, CheckCircle, XCircle,
    Clock, AlertCircle, TrendingUp, ChevronLeft, ChevronRight
} from 'lucide-react'

interface AttendanceRecord {
    attendance_id: string
    attendance_date: string
    status: 'present' | 'absent' | 'late' | 'excused' | 'half_day'
    check_in_time?: string
    remarks?: string
}

interface MonthlySummary {
    month: number
    year: number
    total_days: number
    present_days: number
    absent_days: number
    late_days: number
    excused_days: number
    percentage: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    present: { label: 'Present', color: 'text-green-400', bg: 'bg-green-500/20 border-green-500/30', icon: '✅' },
    absent: { label: 'Absent', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30', icon: '❌' },
    late: { label: 'Late', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/30', icon: '⏰' },
    excused: { label: 'Excused', color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/30', icon: '📋' },
    half_day: { label: 'Half Day', color: 'text-orange-400', bg: 'bg-orange-500/20 border-orange-500/30', icon: '🌗' },
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

export default function StudentAttendancePage() {
    const { goBack, router } = useSmartBack('/dashboard/student')
    const [loading, setLoading] = useState(true)
    const [studentId, setStudentId] = useState('')
    const [studentName, setStudentName] = useState('')
    const [className, setClassName] = useState('')
    const [records, setRecords] = useState<AttendanceRecord[]>([])
    const [summaries, setSummaries] = useState<MonthlySummary[]>([])
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        if (studentId) loadMonthRecords()
    }, [studentId, selectedMonth, selectedYear])

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

            setStudentId(userData.user_id)
            setStudentName(userData.full_name)

            // Get class name
            if (userData.class_id) {
                const { data: cls } = await supabase.from('classes').select('name').eq('class_id', userData.class_id).single()
                const { data: sec } = userData.section_id
                    ? await supabase.from('sections').select('name').eq('section_id', userData.section_id).single()
                    : { data: null }
                setClassName(`${cls?.name || ''} ${sec?.name || ''}`.trim())
            }

            // Load monthly summaries
            const { data: sumData } = await supabase
                .from('attendance_summary')
                .select('*')
                .eq('student_id', userData.user_id)
                .order('year', { ascending: false })
                .order('month', { ascending: false })

            if (sumData) setSummaries(sumData)
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadMonthRecords() {
        const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
        const endDate = new Date(selectedYear, selectedMonth + 1, 0)
        const endDateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

        const { data } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('student_id', studentId)
            .gte('attendance_date', startDate)
            .lte('attendance_date', endDateStr)
            .order('attendance_date', { ascending: true })

        setRecords(data || [])
    }

    function getRecordForDate(date: number): AttendanceRecord | undefined {
        const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`
        return records.find(r => r.attendance_date === dateStr)
    }

    function navigateMonth(delta: number) {
        let newMonth = selectedMonth + delta
        let newYear = selectedYear
        if (newMonth < 0) { newMonth = 11; newYear-- }
        if (newMonth > 11) { newMonth = 0; newYear++ }
        setSelectedMonth(newMonth)
        setSelectedYear(newYear)
    }

    // Calculate current month stats from records
    const monthStats = {
        present: records.filter(r => r.status === 'present').length,
        absent: records.filter(r => r.status === 'absent').length,
        late: records.filter(r => r.status === 'late').length,
        excused: records.filter(r => r.status === 'excused').length,
        halfDay: records.filter(r => r.status === 'half_day').length,
        total: records.length,
        percentage: records.length > 0
            ? Math.round((records.filter(r => ['present', 'late'].includes(r.status)).length / records.length) * 100)
            : 0
    }

    // Overall attendance from summaries
    const overallStats = summaries.reduce((acc, s) => ({
        totalDays: acc.totalDays + s.total_days,
        presentDays: acc.presentDays + s.present_days,
        absentDays: acc.absentDays + s.absent_days,
        lateDays: acc.lateDays + s.late_days,
    }), { totalDays: 0, presentDays: 0, absentDays: 0, lateDays: 0 })
    const overallPercentage = overallStats.totalDays > 0
        ? Math.round((overallStats.presentDays / overallStats.totalDays) * 100)
        : 0

    // Calendar grid
    const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1).getDay()
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()

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
                            <Calendar className="w-6 h-6 text-cyan-400" />
                            My Attendance
                        </h1>
                        <p className="text-sm text-green-300/70">{studentName} • {className}</p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6 space-y-6">
                {/* Overall Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/10 text-center">
                        <p className="text-3xl font-bold text-green-400">{overallPercentage}%</p>
                        <p className="text-xs text-green-300/70 mt-1">Overall</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/10 text-center">
                        <p className="text-3xl font-bold text-white">{overallStats.presentDays}</p>
                        <p className="text-xs text-green-300/70 mt-1">Days Present</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/10 text-center">
                        <p className="text-3xl font-bold text-red-400">{overallStats.absentDays}</p>
                        <p className="text-xs text-green-300/70 mt-1">Days Absent</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/10 text-center">
                        <p className="text-3xl font-bold text-yellow-400">{overallStats.lateDays}</p>
                        <p className="text-xs text-green-300/70 mt-1">Late</p>
                    </div>
                </div>

                {/* Attendance Warning */}
                {overallPercentage > 0 && overallPercentage < 75 && (
                    <div className="bg-red-500/20 border border-red-400/40 rounded-xl p-4 flex items-center gap-3">
                        <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
                        <div>
                            <p className="font-bold text-red-200">⚠️ Low Attendance Warning</p>
                            <p className="text-sm text-red-300/80">
                                Your attendance is below 75%. Please maintain regular attendance to avoid academic consequences.
                            </p>
                        </div>
                    </div>
                )}

                {/* Calendar View */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                    <div className="p-5 border-b border-white/10 flex items-center justify-between">
                        <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-white/10 rounded-lg">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <h3 className="text-lg font-bold">{MONTHS[selectedMonth]} {selectedYear}</h3>
                        <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-white/10 rounded-lg">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-4">
                        {/* Day headers */}
                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="text-center text-xs font-medium text-green-300/70 py-1">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar grid */}
                        <div className="grid grid-cols-7 gap-1">
                            {/* Empty cells for days before month starts */}
                            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                                <div key={`empty-${i}`} className="aspect-square" />
                            ))}

                            {/* Day cells */}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const date = i + 1
                                const record = getRecordForDate(date)
                                const isToday = date === new Date().getDate() &&
                                    selectedMonth === new Date().getMonth() &&
                                    selectedYear === new Date().getFullYear()
                                const isSunday = new Date(selectedYear, selectedMonth, date).getDay() === 0

                                return (
                                    <div
                                        key={date}
                                        className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all ${isToday ? 'ring-2 ring-cyan-400' : ''
                                            } ${record
                                                ? STATUS_CONFIG[record.status]?.bg || 'bg-white/5'
                                                : isSunday
                                                    ? 'bg-white/5'
                                                    : 'bg-white/[0.02]'
                                            } border ${record ? '' : 'border-transparent'}`}
                                        title={record ? `${STATUS_CONFIG[record.status]?.label}${record.remarks ? ` - ${record.remarks}` : ''}` : ''}
                                    >
                                        <span className={`font-medium ${record ? STATUS_CONFIG[record.status]?.color || 'text-white' :
                                            isSunday ? 'text-gray-600' : 'text-white/40'
                                            }`}>
                                            {date}
                                        </span>
                                        {record && (
                                            <span className="text-[9px] mt-0.5">
                                                {STATUS_CONFIG[record.status]?.icon}
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Month summary bar */}
                    <div className="px-5 pb-4">
                        <div className="flex items-center gap-4 text-xs flex-wrap">
                            <span className="text-green-300/70">This month:</span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                Present: {monthStats.present}
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                Absent: {monthStats.absent}
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                Late: {monthStats.late}
                            </span>
                            {monthStats.excused > 0 && (
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    Excused: {monthStats.excused}
                                </span>
                            )}
                            <span className="ml-auto font-bold text-cyan-400">{monthStats.percentage}%</span>
                        </div>
                    </div>
                </div>

                {/* Detailed Records */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                    <div className="p-5 border-b border-white/10">
                        <h3 className="text-lg font-bold">Day-by-Day Records</h3>
                    </div>

                    {records.length === 0 ? (
                        <div className="p-12 text-center">
                            <Calendar className="w-12 h-12 mx-auto mb-3 text-green-300/30" />
                            <p className="text-green-300/70">No attendance records for {MONTHS[selectedMonth]}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/10 max-h-[400px] overflow-y-auto">
                            {records.map(record => {
                                const d = new Date(record.attendance_date + 'T00:00:00')
                                const config = STATUS_CONFIG[record.status]
                                return (
                                    <div key={record.attendance_id} className="p-4 flex items-center gap-4 hover:bg-white/5">
                                        <div className="text-center min-w-[50px]">
                                            <p className="text-lg font-bold">{d.getDate()}</p>
                                            <p className="text-[10px] text-green-300/70">
                                                {d.toLocaleDateString('en-US', { weekday: 'short' })}
                                            </p>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${config?.bg || ''} ${config?.color || ''}`}>
                                            {config?.icon} {config?.label}
                                        </div>
                                        {record.check_in_time && (
                                            <div className="flex items-center gap-1 text-xs text-gray-400">
                                                <Clock className="w-3 h-3" />
                                                {record.check_in_time.slice(0, 5)}
                                            </div>
                                        )}
                                        {record.remarks && (
                                            <p className="text-xs text-gray-500 ml-auto italic">"{record.remarks}"</p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 justify-center flex-wrap text-xs text-green-300/70">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <span key={key} className="flex items-center gap-1">
                            <span>{cfg.icon}</span> {cfg.label}
                        </span>
                    ))}
                </div>
            </main>
        </div>
    )
}

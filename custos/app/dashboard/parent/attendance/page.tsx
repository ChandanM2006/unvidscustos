'use client'

import { useEffect, useState } from 'react'
import { supabase, type User } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
    CheckCircle, ArrowLeft, Loader2, Calendar, XCircle, Clock
} from 'lucide-react'

interface AttendanceRecord {
    date: string
    status: 'present' | 'absent' | 'late'
    child_name: string
}

export default function ParentAttendancePage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [records, setRecords] = useState<AttendanceRecord[]>([])
    const [selectedChild, setSelectedChild] = useState<string>('all')
    const [children, setChildren] = useState<{ id: string, name: string }[]>([])

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

            await loadData(userData)
        } catch (error) {
            console.error('Auth error:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadData = async (userData: User) => {
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
                // Get children names
                const { data: childrenData } = await supabase
                    .from('users')
                    .select('user_id, full_name')
                    .in('user_id', childIds)

                if (childrenData) {
                    setChildren(childrenData.map(c => ({ id: c.user_id, name: c.full_name })))
                }

                // Get attendance
                const { data: attendanceData } = await supabase
                    .from('attendance_records')
                    .select('date, status, student_id')
                    .in('student_id', childIds)
                    .order('date', { ascending: false })
                    .limit(50)

                if (attendanceData && childrenData) {
                    const enriched = attendanceData.map(a => ({
                        date: a.date,
                        status: a.status,
                        child_name: childrenData.find(c => c.user_id === a.student_id)?.full_name || 'Unknown'
                    }))
                    setRecords(enriched)
                }
            }
        } catch (error) {
            console.error('Error:', error)
        }
    }

    const filteredRecords = selectedChild === 'all'
        ? records
        : records.filter(r => r.child_name === children.find(c => c.id === selectedChild)?.name)

    const stats = {
        present: filteredRecords.filter(r => r.status === 'present').length,
        absent: filteredRecords.filter(r => r.status === 'absent').length,
        late: filteredRecords.filter(r => r.status === 'late').length
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
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <Calendar className="w-6 h-6 text-green-400" />
                            Attendance History
                        </h1>
                        <p className="text-sm text-purple-300/70">View your children's attendance</p>
                    </div>
                    {children.length > 1 && (
                        <select
                            value={selectedChild}
                            onChange={(e) => setSelectedChild(e.target.value)}
                            className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white"
                        >
                            <option value="all" className="bg-slate-800">All Children</option>
                            {children.map(c => (
                                <option key={c.id} value={c.id} className="bg-slate-800">{c.name}</option>
                            ))}
                        </select>
                    )}
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-green-400">{stats.present}</p>
                        <p className="text-sm text-purple-300/70">Present</p>
                    </div>
                    <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-red-400">{stats.absent}</p>
                        <p className="text-sm text-purple-300/70">Absent</p>
                    </div>
                    <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-yellow-400">{stats.late}</p>
                        <p className="text-sm text-purple-300/70">Late</p>
                    </div>
                </div>

                {/* Records */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                    <div className="p-5 border-b border-white/10">
                        <h3 className="text-lg font-bold text-white">Recent Records</h3>
                    </div>
                    {filteredRecords.length === 0 ? (
                        <div className="p-12 text-center">
                            <Calendar className="w-16 h-16 mx-auto mb-4 text-purple-300/50" />
                            <p className="text-purple-300/70">No attendance records yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/10">
                            {filteredRecords.map((record, i) => (
                                <div key={i} className="p-4 flex items-center justify-between hover:bg-white/5">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${record.status === 'present' ? 'bg-green-500/20' :
                                                record.status === 'absent' ? 'bg-red-500/20' : 'bg-yellow-500/20'
                                            }`}>
                                            {record.status === 'present' && <CheckCircle className="w-5 h-5 text-green-400" />}
                                            {record.status === 'absent' && <XCircle className="w-5 h-5 text-red-400" />}
                                            {record.status === 'late' && <Clock className="w-5 h-5 text-yellow-400" />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-white">{record.child_name}</p>
                                            <p className="text-sm text-purple-300/70">{new Date(record.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${record.status === 'present' ? 'bg-green-500/20 text-green-400' :
                                            record.status === 'absent' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}

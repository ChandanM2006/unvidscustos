'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
    Bell, User, CheckCircle, Calendar, BarChart3, Clock,
    ChevronRight, Loader2, Users, BookOpen, AlertCircle, Heart
} from 'lucide-react'

interface Child {
    user_id: string
    full_name: string
    class_name: string
    section_name: string
    attendance_percent: number
    last_grade: string
}

export default function ParentDashboard() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [parent, setParent] = useState<any>(null)
    const [children, setChildren] = useState<Child[]>([])
    const [selectedChild, setSelectedChild] = useState<Child | null>(null)
    const [currentTime] = useState(new Date())

    useEffect(() => {
        loadParentData()
    }, [])

    async function loadParentData() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
                return
            }

            // Get parent data
            const { data: userData } = await supabase
                .from('users')
                .select('*')
                .eq('email', session.user.email)
                .single()

            if (!userData || userData.role !== 'parent') {
                router.push('/dashboard')
                return
            }

            setParent(userData)

            // Get linked children
            const { data: links } = await supabase
                .from('parent_student_links')
                .select(`
                    student:student_id (
                        user_id,
                        full_name,
                        classes (name),
                        sections (name)
                    )
                `)
                .eq('parent_id', userData.user_id)

            if (links && links.length > 0) {
                const childrenData: Child[] = links.map((link: any) => ({
                    user_id: link.student?.user_id,
                    full_name: link.student?.full_name || 'Unknown',
                    class_name: link.student?.classes?.name || '',
                    section_name: link.student?.sections?.name || '',
                    attendance_percent: 85, // TODO: Calculate from attendance_summary
                    last_grade: 'A'
                }))
                setChildren(childrenData)
                setSelectedChild(childrenData[0])
            }

        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100">
                <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100">
            {/* Header */}
            <header className="bg-white border-b shadow-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                            {parent?.full_name?.charAt(0) || 'P'}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">
                                Welcome, {parent?.full_name?.split(' ')[0]}
                            </h1>
                            <p className="text-sm text-gray-500">
                                {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => router.push('/dashboard/notifications')}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <Bell className="w-6 h-6 text-gray-600" />
                    </button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6 space-y-6">
                {/* Children Selector */}
                {children.length > 1 && (
                    <div className="flex gap-3 overflow-x-auto pb-2">
                        {children.map(child => (
                            <button
                                key={child.user_id}
                                onClick={() => setSelectedChild(child)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl whitespace-nowrap transition-all ${selectedChild?.user_id === child.user_id
                                        ? 'bg-purple-600 text-white shadow-lg'
                                        : 'bg-white text-gray-700 shadow-sm hover:shadow-md'
                                    }`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${selectedChild?.user_id === child.user_id
                                        ? 'bg-white/20'
                                        : 'bg-purple-100 text-purple-600'
                                    }`}>
                                    {child.full_name.charAt(0)}
                                </div>
                                <span className="font-medium">{child.full_name.split(' ')[0]}</span>
                            </button>
                        ))}
                    </div>
                )}

                {selectedChild ? (
                    <>
                        {/* Child Overview Card */}
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                        {selectedChild.full_name.charAt(0)}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">{selectedChild.full_name}</h2>
                                        <p className="text-gray-500">
                                            {selectedChild.class_name} {selectedChild.section_name}
                                        </p>
                                    </div>
                                </div>
                                <Heart className="w-6 h-6 text-pink-400" />
                            </div>

                            {/* Quick Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-50 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                        <span className="text-sm text-green-700">Attendance</span>
                                    </div>
                                    <p className="text-2xl font-bold text-green-700">{selectedChild.attendance_percent}%</p>
                                </div>
                                <div className="bg-blue-50 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <BarChart3 className="w-5 h-5 text-blue-600" />
                                        <span className="text-sm text-blue-700">Last Grade</span>
                                    </div>
                                    <p className="text-2xl font-bold text-blue-700">{selectedChild.last_grade}</p>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="space-y-3">
                            <button
                                onClick={() => router.push(`/dashboard/parent/attendance/${selectedChild.user_id}`)}
                                className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                                        <CheckCircle className="w-6 h-6 text-green-600" />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-semibold text-gray-900">Attendance History</p>
                                        <p className="text-sm text-gray-500">View daily attendance record</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                            </button>

                            <button
                                onClick={() => router.push(`/dashboard/parent/grades/${selectedChild.user_id}`)}
                                className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                        <BarChart3 className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-semibold text-gray-900">Report Cards</p>
                                        <p className="text-sm text-gray-500">View grades and performance</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                            </button>

                            <button
                                onClick={() => router.push(`/dashboard/parent/timetable/${selectedChild.user_id}`)}
                                className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                                        <Calendar className="w-6 h-6 text-purple-600" />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-semibold text-gray-900">Class Schedule</p>
                                        <p className="text-sm text-gray-500">View weekly timetable</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                            </button>

                            <button
                                onClick={() => router.push(`/dashboard/parent/resources/${selectedChild.user_id}`)}
                                className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                                        <BookOpen className="w-6 h-6 text-orange-600" />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-semibold text-gray-900">Study Materials</p>
                                        <p className="text-sm text-gray-500">Access learning resources</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        {/* Contact Teacher */}
                        <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl p-6 text-white">
                            <h3 className="font-bold text-lg mb-2">Need to Contact School?</h3>
                            <p className="text-purple-100 text-sm mb-4">
                                Reach out to your child's class teacher or the school administration.
                            </p>
                            <button className="px-6 py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition-colors">
                                Contact Teacher
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                        <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No Children Linked</h3>
                        <p className="text-gray-500 mb-4">
                            Your account hasn't been linked to any students yet.
                            Please contact the school administration.
                        </p>
                    </div>
                )}
            </main>
        </div>
    )
}

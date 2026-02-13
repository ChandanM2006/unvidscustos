'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, School, Users, Grid, Palette, BookOpen, Upload, Calendar, ClipboardList, Layers, GraduationCap, CalendarCheck, Clock, Award } from 'lucide-react'

export default function ManagePage() {
    const router = useRouter()

    const modules = [
        {
            title: 'Classes',
            description: 'Manage school classes and grade levels',
            icon: <Grid className="w-8 h-8" />,
            path: '/dashboard/manage/classes',
            color: 'from-blue-500 to-cyan-500'
        },
        {
            title: 'Sections',
            description: 'Create sections within classes',
            icon: <School className="w-8 h-8" />,
            path: '/dashboard/manage/sections',
            color: 'from-orange-500 to-red-500'
        },
        {
            title: 'Subjects',
            description: 'Manage curriculum subjects and assignments',
            icon: <BookOpen className="w-8 h-8" />,
            path: '/dashboard/manage/subjects',
            color: 'from-indigo-500 to-purple-500'
        },
        {
            title: 'Syllabus',
            description: 'Manage syllabus documents and AI extraction',
            icon: <Upload className="w-8 h-8" />,
            path: '/dashboard/manage/syllabus',
            color: 'from-purple-500 to-fuchsia-500'
        },
        {
            title: 'Academic Years',
            description: 'Manage academic sessions and calendars',
            icon: <Calendar className="w-8 h-8" />,
            path: '/dashboard/manage/academic-years',
            color: 'from-blue-500 to-indigo-500'
        },
        {
            title: 'Users',
            description: 'Manage students, teachers, and admins',
            icon: <Users className="w-8 h-8" />,
            path: '/dashboard/manage/users',
            color: 'from-purple-500 to-pink-500'
        },
        {
            title: 'School Branding',
            description: 'Customize logo, colors, and appearance',
            icon: <Palette className="w-8 h-8" />,
            path: '/dashboard/manage/branding',
            color: 'from-green-500 to-teal-500'
        },
        {
            title: 'Lesson Plans',
            description: 'AI-generated schedules and curriculum',
            icon: <ClipboardList className="w-8 h-8" />,
            path: '/dashboard/manage/lesson-plans',
            color: 'from-pink-500 to-rose-500'
        },
        {
            title: 'Topics & Resources',
            description: 'AI-powered study materials and MCQs',
            icon: <Layers className="w-8 h-8" />,
            path: '/dashboard/manage/topics',
            color: 'from-cyan-500 to-blue-500'
        },
        {
            title: 'Student Promotions',
            description: 'Promote students to next academic year',
            icon: <GraduationCap className="w-8 h-8" />,
            path: '/dashboard/manage/promotions',
            color: 'from-emerald-500 to-green-500'
        },
        {
            title: 'Attendance',
            description: 'Mark and track daily attendance',
            icon: <CalendarCheck className="w-8 h-8" />,
            path: '/dashboard/manage/attendance',
            color: 'from-teal-500 to-cyan-500'
        },
        {
            title: 'Timetable',
            description: 'Weekly class schedules',
            icon: <Clock className="w-8 h-8" />,
            path: '/dashboard/manage/timetable',
            color: 'from-orange-500 to-amber-500'
        },
        {
            title: 'Report Cards',
            description: 'Exam marks and grade reports',
            icon: <Award className="w-8 h-8" />,
            path: '/dashboard/manage/report-cards',
            color: 'from-rose-500 to-pink-500'
        }
    ]

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>Back to Dashboard</span>
                        </button>
                        <h1 className="text-xl font-semibold text-gray-800">Manage</h1>
                        <div className="w-32"></div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">School Management</h2>
                    <p className="text-gray-600">Manage your school's structure, users, and branding</p>
                </div>

                {/* Module Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {modules.map((module) => (
                        <button
                            key={module.path}
                            onClick={() => router.push(module.path)}
                            className="p-8 bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all hover:scale-105 text-left group"
                        >
                            <div
                                className={`w-16 h-16 rounded-xl bg-gradient-to-br ${module.color} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}
                            >
                                {module.icon}
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{module.title}</h3>
                            <p className="text-gray-600 text-sm">{module.description}</p>
                            <div className="mt-4 text-blue-600 text-sm font-medium flex items-center">
                                Open →
                            </div>
                        </button>
                    ))}
                </div>

                {/* Info Card */}
                <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-xl">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">💡 Getting Started</h3>
                    <ul className="space-y-2 text-gray-700">
                        <li>• <strong>Classes:</strong> Create your school's class structure first</li>
                        <li>• <strong>Sections:</strong> Add sections (A, B, C) to each class</li>
                        <li>• <strong>Users:</strong> Add teachers, students, and admins</li>
                        <li>• <strong>Branding:</strong> Customize your school's appearance</li>
                    </ul>
                </div>
            </main>
        </div>
    )
}

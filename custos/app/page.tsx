'use client'

import { useRouter } from 'next/navigation'
import { Shield, UserCog, BookOpen, GraduationCap, Users } from 'lucide-react'

const roleCards = [
  {
    title: 'Super Admin',
    desc: 'Full system control & analytics',
    icon: Shield,
    gradient: 'from-red-500 to-orange-500',
    path: '/login?role=admin',
  },
  {
    title: 'Sub Admin',
    desc: 'Manage daily operations',
    icon: UserCog,
    gradient: 'from-purple-500 to-pink-500',
    path: '/login?role=subadmin',
  },
  {
    title: 'Teacher',
    desc: 'Lessons, work & reports',
    icon: BookOpen,
    gradient: 'from-blue-500 to-indigo-500',
    path: '/login?role=teacher',
  },
  {
    title: 'Student',
    desc: 'Learn, practice & grow',
    icon: GraduationCap,
    gradient: 'from-green-500 to-emerald-500',
    path: '/login?role=student',
  },
  {
    title: 'Parent',
    desc: 'Track child progress',
    icon: Users,
    gradient: 'from-teal-500 to-cyan-500',
    path: '/login?role=parent',
  },
]

export default function HomePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-6">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/30 rounded-full blur-3xl"></div>
      </div>

      {/* Logo */}
      <div className="text-center mb-12 relative z-10">
        <h1 className="text-6xl font-bold text-white mb-4">
          CUSTOS 1.0
        </h1>
        <h2 className="text-2xl font-semibold text-white mb-2">
          School Management System
        </h2>
        <p className="text-purple-300 max-w-md mx-auto">
          AI-powered platform for managing students, teachers, and parents with comprehensive analytics
        </p>
      </div>

      {/* Role Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl w-full relative z-10">
        {roleCards.map((role) => (
          <button
            key={role.title}
            onClick={() => router.push(role.path)}
            className="group bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 hover:bg-white/20 transition-all hover:scale-105 hover:border-white/40 text-left"
          >
            {/* Icon */}
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${role.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
              <role.icon className="w-7 h-7 text-white" />
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-white mb-1">{role.title}</h3>

            {/* Description */}
            <p className="text-purple-300 text-sm mb-4">{role.desc}</p>

            {/* CTA Button */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r ${role.gradient} text-white text-sm font-medium group-hover:shadow-lg transition-all`}>
              Open Dashboard →
            </div>
          </button>
        ))}
      </div>

      {/* Platform Owner Link */}
      <div className="mt-12 relative z-10">
        <button
          onClick={() => router.push('/platform')}
          className="text-purple-400 hover:text-white underline text-sm transition-colors"
        >
          Platform Owner? Access Command Center →
        </button>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-purple-400/60 text-xs relative z-10">
        <p>© 2026 CUSTOS School Management System</p>
        <p className="mt-1">Powered by AI • Secure • Scalable</p>
      </div>
    </div>
  )
}

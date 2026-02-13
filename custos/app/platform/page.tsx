'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Shield, AlertTriangle, Activity, Database, Zap, Users, School, TrendingUp, CheckCircle, XCircle, Clock, Building2 } from 'lucide-react'

interface ErrorLog {
    error_id: string
    error_type: string
    feature_name: string
    error_message: string
    severity: string
    user_impacted: boolean
    created_at: string
    school_id: string | null
    resolved: boolean
}

interface SystemHealth {
    overall_status: string
    db_status: string
    api_status: string
    ai_service_status: string
}

export default function PlatformDashboard() {
    const router = useRouter()
    const [errors, setErrors] = useState<ErrorLog[]>([])
    const [loading, setLoading] = useState(true)
    const [mounted, setMounted] = useState(false)
    const [currentTime, setCurrentTime] = useState('')
    const [systemHealth, setSystemHealth] = useState<SystemHealth>({
        overall_status: 'operational',
        db_status: 'healthy',
        api_status: 'healthy',
        ai_service_status: 'healthy'
    })

    useEffect(() => {
        setMounted(true)
        updateTime()
        loadDashboard()

        // Update time every second
        const timeInterval = setInterval(updateTime, 1000)

        // Refresh data every 10 seconds
        const dataInterval = setInterval(loadDashboard, 10000)

        return () => {
            clearInterval(timeInterval)
            clearInterval(dataInterval)
        }
    }, [])

    function updateTime() {
        setCurrentTime(new Date().toLocaleTimeString())
    }

    async function loadDashboard() {
        try {
            // Load recent errors (last 24 hours)
            const { data: errorsData, error: errorsError } = await supabase
                .from('error_logs')
                .select('*')
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .order('created_at', { ascending: false })
                .limit(50)

            if (!errorsError && errorsData) {
                setErrors(errorsData)
            }

            // Load latest system health
            const { data: healthData, error: healthError } = await supabase
                .from('system_health_metrics')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (!healthError && healthData) {
                setSystemHealth({
                    overall_status: healthData.overall_status || 'operational',
                    db_status: healthData.db_status || 'healthy',
                    api_status: healthData.api_status || 'healthy',
                    ai_service_status: healthData.ai_service_status || 'healthy'
                })
            }

            setLoading(false)
        } catch (error) {
            console.error('Error loading dashboard:', error)
            setLoading(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'healthy':
            case 'operational':
                return 'text-green-600 bg-green-100'
            case 'degraded':
                return 'text-yellow-600 bg-yellow-100'
            case 'down':
            case 'major_outage':
                return 'text-red-600 bg-red-100'
            default:
                return 'text-gray-600 bg-gray-100'
        }
    }

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'text-red-600 bg-red-100 border-red-300'
            case 'high': return 'text-orange-600 bg-orange-100 border-orange-300'
            case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-300'
            case 'low': return 'text-blue-600 bg-blue-100 border-blue-300'
            default: return 'text-gray-600 bg-gray-100 border-gray-300'
        }
    }

    const criticalErrors = errors.filter(e => e.severity === 'critical' && !e.resolved)
    const unresolvedErrors = errors.filter(e => !e.resolved)
    const errorsByType = errors.reduce((acc, err) => {
        acc[err.error_type] = (acc[err.error_type] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl">
                            <Shield className="w-10 h-10 text-white" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold text-white">
                                CUSTOS Platform Command Center
                            </h1>
                            <p className="text-purple-300 mt-1">
                                Real-time monitoring • System health • Error tracking
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/platform/schools')}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 transition-all"
                        >
                            <Building2 className="w-5 h-5" />
                            Manage Schools
                        </button>
                        <div className="text-right">
                            <div className="text-sm text-purple-300">Last updated</div>
                            <div className="text-white font-mono">
                                {mounted ? currentTime : '--:--:--'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* System Status Banner */}
                <div className={`p-6 rounded-2xl mb-8 ${systemHealth.overall_status === 'operational'
                    ? 'bg-green-500/20 border-2 border-green-500'
                    : 'bg-red-500/20 border-2 border-red-500'
                    }`}>
                    <div className="flex items-center gap-3">
                        {systemHealth.overall_status === 'operational' ? (
                            <CheckCircle className="w-8 h-8 text-green-400" />
                        ) : (
                            <XCircle className="w-8 h-8 text-red-400" />
                        )}
                        <div>
                            <div className="text-2xl font-bold text-white">
                                {systemHealth.overall_status === 'operational'
                                    ? '🟢 All Systems Operational'
                                    : '🔴 System Issues Detected'}
                            </div>
                            <div className="text-white/80 text-sm">
                                Platform is {systemHealth.overall_status === 'operational' ? 'running smoothly' : 'experiencing problems'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-6 mb-8">
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                        <div className="flex items-center justify-between mb-4">
                            <Activity className="w-8 h-8 text-purple-400" />
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(systemHealth.db_status)}`}>
                                {systemHealth.db_status}
                            </span>
                        </div>
                        <div className="text-2xl font-bold text-white">Database</div>
                        <div className="text-purple-300 text-sm mt-1">PostgreSQL</div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                        <div className="flex items-center justify-between mb-4">
                            <Zap className="w-8 h-8 text-yellow-400" />
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(systemHealth.api_status)}`}>
                                {systemHealth.api_status}
                            </span>
                        </div>
                        <div className="text-2xl font-bold text-white">API</div>
                        <div className="text-purple-300 text-sm mt-1">FastAPI</div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                        <div className="flex items-center justify-between mb-4">
                            <Database className="w-8 h-8 text-blue-400" />
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(systemHealth.ai_service_status)}`}>
                                {systemHealth.ai_service_status}
                            </span>
                        </div>
                        <div className="text-2xl font-bold text-white">AI Service</div>
                        <div className="text-purple-300 text-sm mt-1">OpenAI GPT-4</div>
                    </div>

                    <div className="bg-gradient-to-br from-red-500/20 to-orange-500/20 backdrop-blur-sm rounded-2xl p-6 border-2 border-red-500/50">
                        <div className="flex items-center justify-between mb-4">
                            <AlertTriangle className="w-8 h-8 text-red-400" />
                            <span className="text-red-400 text-3xl font-bold">{criticalErrors.length}</span>
                        </div>
                        <div className="text-xl font-bold text-white">Critical Errors</div>
                        <div className="text-red-300 text-sm mt-1">Requires immediate attention</div>
                    </div>
                </div>

                {/* Error Stats */}
                <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                        <div className="text-4xl font-bold text-white mb-2">{errors.length}</div>
                        <div className="text-purple-300">Total Errors (24h)</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                        <div className="text-4xl font-bold text-orange-400 mb-2">{unresolvedErrors.length}</div>
                        <div className="text-purple-300">Unresolved</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                        <div className="text-4xl font-bold text-green-400 mb-2">
                            {errors.length > 0 ? Math.round((errors.filter(e => e.resolved).length / errors.length) * 100) : 100}%
                        </div>
                        <div className="text-purple-300">Resolution Rate</div>
                    </div>
                </div>

                {/* Recent Errors */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 overflow-hidden">
                    <div className="px-6 py-4 bg-white/5 border-b border-white/10">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <AlertTriangle className="w-6 h-6 text-yellow-400" />
                            Recent Errors (Last 24 Hours)
                        </h2>
                    </div>

                    {errors.length === 0 ? (
                        <div className="p-12 text-center">
                            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                            <div className="text-xl font-semibold text-white mb-2">No Errors Detected!</div>
                            <div className="text-purple-300">System is running perfectly 🎉</div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-white/5 text-purple-300">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-sm font-semibold">Time</th>
                                        <th className="px-6 py-3 text-left text-sm font-semibold">Feature</th>
                                        <th className="px-6 py-3 text-left text-sm font-semibold">Type</th>
                                        <th className="px-6 py-3 text-left text-sm font-semibold">Message</th>
                                        <th className="px-6 py-3 text-left text-sm font-semibold">Severity</th>
                                        <th className="px-6 py-3 text-center text-sm font-semibold">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    {errors.map((error) => (
                                        <tr key={error.error_id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 text-sm text-purple-300 font-mono">
                                                {new Date(error.created_at).toLocaleTimeString()}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-white">
                                                {error.feature_name}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className="px-2 py-1 bg-white/10 text-purple-300 rounded text-xs font-mono">
                                                    {error.error_type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-purple-200 max-w-md truncate">
                                                {error.error_message}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${getSeverityColor(error.severity)}`}>
                                                    {error.severity.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {error.resolved ? (
                                                    <CheckCircle className="w-5 h-5 text-green-400 mx-auto" />
                                                ) : (
                                                    <Clock className="w-5 h-5 text-yellow-400 mx-auto" />
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

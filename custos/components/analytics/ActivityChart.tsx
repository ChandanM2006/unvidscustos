'use client'

import { useEffect, useRef, useState } from 'react'
import {
    LineChart, Line, ResponsiveContainer, XAxis, YAxis,
    CartesianGrid, Tooltip, Area, AreaChart
} from 'recharts'

interface ActivityChartProps {
    data: Array<{
        date: string
        activity_percentage: number
        minutes_spent: number
        questions_answered: number
    }>
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Custom tooltip component
function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload || !payload.length) return null

    const data = payload[0]?.payload
    if (!data) return null

    return (
        <div className="bg-slate-800/95 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
            <p className="text-xs text-purple-300 mb-2 font-medium">{formatDate(data.date)}</p>
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-400" />
                    <span className="text-xs text-purple-200">
                        {data.activity_percentage > 0 ? 'Active' : 'Inactive'}
                    </span>
                </div>
                {data.questions_answered > 0 && (
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-400" />
                        <span className="text-xs text-purple-200">
                            {data.questions_answered} questions
                        </span>
                    </div>
                )}
                {data.minutes_spent > 0 && (
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-xs text-purple-200">
                            {data.minutes_spent} min
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function ActivityChart({ data }: ActivityChartProps) {
    const [isVisible, setIsVisible] = useState(false)
    const chartRef = useRef<HTMLDivElement>(null)

    // Lazy load: only render chart when visible in viewport
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true)
                    observer.disconnect()
                }
            },
            { threshold: 0.1 }
        )

        if (chartRef.current) {
            observer.observe(chartRef.current)
        }

        return () => observer.disconnect()
    }, [])

    // Calculate streak dots for the activity bar
    const activeDays = data.filter(d => d.activity_percentage > 0).length
    const avgMinutes = data.reduce((sum, d) => sum + d.minutes_spent, 0) / 30

    // Format data for chart with labels
    const chartData = data.map(d => ({
        ...d,
        label: formatDate(d.date),
    }))

    return (
        <div ref={chartRef} className="w-full">
            {/* Summary stats */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-white">Activity Trend</h3>
                    <p className="text-xs text-purple-300/60">Last 30 days</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-sm font-bold text-indigo-400">{activeDays}/30</p>
                        <p className="text-[10px] text-purple-300/50">Active Days</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold text-cyan-400">{avgMinutes.toFixed(0)}m</p>
                        <p className="text-[10px] text-purple-300/50">Avg/Day</p>
                    </div>
                </div>
            </div>

            {/* Chart */}
            {isVisible ? (
                <div className="h-48 sm:h-56">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="rgba(255,255,255,0.05)"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="label"
                                tick={{ fontSize: 10, fill: 'rgba(168,162,210,0.5)' }}
                                axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
                                tickLine={false}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: 'rgba(168,162,210,0.5)' }}
                                axisLine={false}
                                tickLine={false}
                                domain={[0, 100]}
                                ticks={[0, 50, 100]}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="activity_percentage"
                                stroke="#6366f1"
                                strokeWidth={2}
                                fill="url(#activityGradient)"
                                dot={false}
                                activeDot={{
                                    r: 4,
                                    fill: '#6366f1',
                                    stroke: '#fff',
                                    strokeWidth: 2,
                                }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="h-48 sm:h-56 bg-white/5 rounded-xl animate-pulse flex items-center justify-center">
                    <p className="text-purple-300/40 text-sm">Loading chart...</p>
                </div>
            )}

            {/* Activity dots (mini heatmap) */}
            <div className="mt-3 flex gap-[3px] flex-wrap">
                {data.map((d, i) => (
                    <div
                        key={i}
                        className={`w-3 h-3 rounded-sm transition-colors ${d.activity_percentage > 0
                            ? d.questions_answered > 20
                                ? 'bg-indigo-400'
                                : d.questions_answered > 10
                                    ? 'bg-indigo-500'
                                    : 'bg-indigo-600'
                            : 'bg-white/5'
                            }`}
                        title={`${formatDate(d.date)}: ${d.activity_percentage > 0 ? 'Active' : 'Inactive'}`}
                    />
                ))}
            </div>
        </div>
    )
}

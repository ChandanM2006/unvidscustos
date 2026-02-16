'use client'

import { useEffect, useState } from 'react'

interface ProgressBarProps {
    current: number
    total: number
    color?: 'indigo' | 'green' | 'red' | 'yellow'
    showLabel?: boolean
    animated?: boolean
}

const colorMap = {
    indigo: 'from-indigo-500 to-purple-500',
    green: 'from-green-500 to-emerald-500',
    red: 'from-red-500 to-rose-500',
    yellow: 'from-yellow-500 to-amber-500',
}

const bgMap = {
    indigo: 'bg-indigo-100',
    green: 'bg-green-100',
    red: 'bg-red-100',
    yellow: 'bg-yellow-100',
}

export default function ProgressBar({
    current,
    total,
    color = 'indigo',
    showLabel = false,
    animated = true,
}: ProgressBarProps) {
    const [width, setWidth] = useState(0)
    const percent = total > 0 ? Math.round((current / total) * 100) : 0

    useEffect(() => {
        // Animate on mount
        const timer = setTimeout(() => setWidth(percent), 50)
        return () => clearTimeout(timer)
    }, [percent])

    return (
        <div className="w-full">
            {showLabel && (
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-500">
                        {current}/{total}
                    </span>
                    <span className="text-xs font-semibold text-gray-700">{percent}%</span>
                </div>
            )}
            <div className={`h-2 rounded-full overflow-hidden ${bgMap[color]} bg-opacity-30`}>
                <div
                    className={`h-full rounded-full bg-gradient-to-r ${colorMap[color]} ${animated ? 'transition-all duration-700 ease-out' : ''
                        }`}
                    style={{ width: `${width}%` }}
                />
            </div>
        </div>
    )
}
